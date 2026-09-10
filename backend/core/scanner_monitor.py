import time
import logging
from collections import defaultdict
from typing import Dict, List, Any
from fastapi import HTTPException, status

logger = logging.getLogger('breachguard.scanner_monitor')

class ScannerAbuseMonitor:
    def __init__(self, window_seconds: int = 600):
        self.window_seconds = window_seconds
        # ip -> list of {timestamp, domain, status, provider_lookups}
        self.history = defaultdict(list)
        self.flagged_ips = {}

    def _cleanup_old_entries(self, ip: str, now: float):
        self.history[ip] = [e for e in self.history[ip] if (now - e['timestamp']) < self.window_seconds]
        # Clean up stale flagged status if older than window
        if ip in self.flagged_ips and (now - self.flagged_ips[ip]['timestamp']) > self.window_seconds:
            del self.flagged_ips[ip]

    def record_scan_attempt(self, ip: str, domain: str, status: str = 'success', provider_lookups: int = 0):
        now = time.time()
        self._cleanup_old_entries(ip, now)
        self.history[ip].append({
            'timestamp': now,
            'domain': domain.lower(),
            'status': status,
            'provider_lookups': provider_lookups
        })

    def check_scanner_abuse(self, ip: str):
        now = time.time()
        self._cleanup_old_entries(ip, now)

        if ip in self.flagged_ips:
            reason = self.flagged_ips[ip]['reason']
            logger.warning(f'[SCANNER_ABUSE_MONITOR] Blocked request from flagged IP {ip}: {reason}')
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f'Automated scanning abuse detected ({reason}). Access temporarily suspended.'
            )

        events = self.history.get(ip, [])
        if not events:
            return

        # 1. Check for rapid multi-domain reconnaissance (scraping)
        unique_domains = len(set(e['domain'] for e in events))
        if unique_domains > 12:
            reason = 'Multi-domain reconnaissance pattern'
            self.flagged_ips[ip] = {'timestamp': now, 'reason': reason}
            logger.critical(f'[SCANNER_ABUSE_ALERT] IP {ip} triggered {reason} with {unique_domains} distinct domains in {self.window_seconds}s')
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail='Excessive scanning across multiple domains detected. Security cooldown activated.'
            )

        # 2. Check for fuzzing / input probing (>5 failures in window)
        failed_requests = sum(1 for e in events if e['status'] in ('failed', 'invalid_input', 'blocked_ssrf'))
        if failed_requests >= 5:
            reason = 'Repeated malformed or restricted scan queries'
            self.flagged_ips[ip] = {'timestamp': now, 'reason': reason}
            logger.critical(f'[SCANNER_ABUSE_ALERT] IP {ip} triggered {reason} with {failed_requests} failed requests')
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail='Repeated malformed queries detected. Security cooldown activated.'
            )

        # 3. Provider Quota Protection (>20 provider lookups in window)
        total_provider_calls = sum(e.get('provider_lookups', 0) for e in events)
        if total_provider_calls >= 20:
            reason = 'Upstream provider quota threshold reached'
            self.flagged_ips[ip] = {'timestamp': now, 'reason': reason}
            logger.critical(f'[SCANNER_ABUSE_ALERT] IP {ip} triggered {reason} with {total_provider_calls} provider calls')
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail='Scanner quota limit reached for this network. Please wait before scanning again.'
            )

    def get_metrics(self) -> Dict[str, Any]:
        now = time.time()
        active_ips = [ip for ip, events in self.history.items() if any((now - e['timestamp']) < self.window_seconds for e in events)]
        return {
            'active_monitored_ips': len(active_ips),
            'flagged_ips_count': len(self.flagged_ips),
            'flagged_ips': list(self.flagged_ips.keys())
        }

scanner_monitor = ScannerAbuseMonitor()
