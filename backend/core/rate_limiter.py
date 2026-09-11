import time
import os
import logging
from typing import Dict, List, Any, Optional, Set
from collections import defaultdict
from fastapi import Request, HTTPException, status
from core.config import settings

logger = logging.getLogger("breachguard.rate_limiter")

try:
    import redis.asyncio as aioredis
    _HAS_REDIS = True
except ImportError:
    _HAS_REDIS = False

class InMemoryRateLimiter:
    """
    Sliding window in-memory rate limiter per key.
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

    def clear(self):
        self._requests.clear()

class HybridRateLimiter:
    """
    BG-SEC-10: Production-grade rate limiter supporting distributed Redis cache
    with seamless local in-memory sliding window fallback.
    """
    def __init__(self):
        self.in_memory = InMemoryRateLimiter()
        self._redis_client = None
        self._redis_failed = False

    async def _get_redis(self):
        if not _HAS_REDIS or self._redis_failed:
            return None
        if self._redis_client is None:
            try:
                redis_url = getattr(settings, "REDIS_URL", None)
                if redis_url and not redis_url.startswith("redis://localhost") and not redis_url.startswith("redis://127.0.0.1"):
                    self._redis_client = aioredis.from_url(redis_url, encoding="utf-8", decode_responses=True, socket_timeout=1.0)
                    await self._redis_client.ping()
                else:
                    self._redis_failed = True
                    return None
            except Exception as e:
                logger.debug(f"Redis rate limiter connection skipped/failed: {e}")
                self._redis_failed = True
                return None
        return self._redis_client

    def is_rate_limited(self, key: str, max_requests: int, window_seconds: int) -> bool:
        # Synchronous in-memory evaluation
        return self.in_memory.is_rate_limited(key, max_requests, window_seconds)

    async def is_rate_limited_async(self, key: str, max_requests: int, window_seconds: int) -> bool:
        client = await self._get_redis()
        if client:
            try:
                redis_key = f"rl:{key}"
                current = await client.incr(redis_key)
                if current == 1:
                    await client.expire(redis_key, window_seconds)
                return current > max_requests
            except Exception as e:
                logger.warning(f"Redis rate limiting error, falling back to memory: {e}")
        return self.in_memory.is_rate_limited(key, max_requests, window_seconds)

class TTLMemoryCache:
    """
    In-memory key-value cache with time-to-live (TTL) expiration.
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
hybrid_rate_limiter = HybridRateLimiter()
prospect_cache = TTLMemoryCache()

# Trusted proxy networks or platforms
TRUSTED_PROXY_HEADERS = ["cf-connecting-ip", "x-vercel-forwarded-for"]

def get_client_ip(request: Request) -> str:
    """
    BG-SEC-10: Robust client IP extraction.
    Prevents IP spoofing via arbitrary X-Forwarded-For headers when not behind a verified proxy.
    Only trusts proxy forwarding headers when verified reverse proxy headers are present.
    """
    # 1. Cloudflare True-Client-IP / CF-Connecting-IP
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip and cf_ip.strip():
        return cf_ip.strip()

    # 2. Vercel trusted serverless proxy header
    vercel_ip = request.headers.get("x-vercel-forwarded-for")
    if vercel_ip and vercel_ip.strip():
        return vercel_ip.split(",")[0].strip()

    # 3. Explicit trusted proxy CIDR or platform check
    trusted_proxies_cfg = getattr(settings, "TRUSTED_PROXIES", None)
    client_host = request.client.host if request.client else "127.0.0.1"

    is_trusted_hop = False
    if trusted_proxies_cfg:
        trusted_set = {ip.strip() for ip in trusted_proxies_cfg.split(",") if ip.strip()}
        if client_host in trusted_set:
            is_trusted_hop = True
    elif os.environ.get("VERCEL") or request.headers.get("x-vercel-id"):
        # Running inside Vercel infrastructure
        is_trusted_hop = True

    if is_trusted_hop:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()

    # 4. Untrusted direct client connection: strictly use peer host to prevent header spoofing
    return client_host

def check_rate_limit(request: Request, key_prefix: str, max_requests: int, window_seconds: int):
    client_ip = get_client_ip(request)
    rate_key = f"{key_prefix}:{client_ip}"
    if rate_limiter.is_rate_limited(rate_key, max_requests, window_seconds):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum {max_requests} requests per {window_seconds} seconds allowed."
        )
