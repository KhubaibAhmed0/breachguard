import time
from typing import Dict, List, Any, Optional
from collections import defaultdict
from fastapi import Request, HTTPException, status

class InMemoryRateLimiter:
    """
    Sliding window in-memory rate limiter per key (e.g., client IP or account ID).
    """
    def __init__(self):
        self._requests: Dict[str, List[float]] = defaultdict(list)

    def is_rate_limited(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.time()
        window_start = now - window_seconds
        
        # Clean older entries
        reqs = [t for t in self._requests[key] if t > window_start]
        self._requests[key] = reqs
        
        if len(reqs) >= max_requests:
            return True
            
        self._requests[key].append(now)
        return False

class TTLMemoryCache:
    """
    In-memory key-value cache with time-to-live (TTL) expiration.
    Protects downstream breach intelligence APIs from excessive quota exhaustion.
    """
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}

    def get(self, key: str) -> Optional[Any]:
        now = time.time()
        entry = self._cache.get(key)
        if not entry:
            return None
        if now > entry["expires_at"]:
            del self._cache[key]
            return None
        return entry["value"]

    def set(self, key: str, value: Any, ttl_seconds: int = 1800):
        self._cache[key] = {
            "value": value,
            "expires_at": time.time() + ttl_seconds
        }

# Global instances
rate_limiter = InMemoryRateLimiter()
prospect_cache = TTLMemoryCache()

def get_client_ip(request: Request) -> str:
    """
    Extracts true client IP respecting reverse proxies (Vercel / Cloudflare).
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # First IP in list is the client
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "127.0.0.1"

def check_rate_limit(request: Request, key_prefix: str, max_requests: int, window_seconds: int):
    client_ip = get_client_ip(request)
    rate_key = f"{key_prefix}:{client_ip}"
    if rate_limiter.is_rate_limited(rate_key, max_requests, window_seconds):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum {max_requests} requests per {window_seconds} seconds allowed."
        )
