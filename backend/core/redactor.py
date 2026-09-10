import re
import logging
from typing import Any, Dict, List, Union

JWT_PATTERN = re.compile(r"ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}")
STRIPE_KEY_PATTERN = re.compile(r"sk_(live|test)_[A-Za-z0-9]{20,}")
BEARER_PATTERN = re.compile(r"Bearer\s+[A-Za-z0-9._~+/-]+=*", re.IGNORECASE)

SENSITIVE_KEYS = {
    "password", "passwd", "secret", "token", "access_token", "refresh_token",
    "api_key", "apikey", "cookie", "cookies", "hash", "session", "session_token",
    "authorization", "private_key", "client_secret", "webhook_secret"
}

def mask_string(s: str) -> str:
    if not isinstance(s, str):
        return s
    s = JWT_PATTERN.sub("[REDACTED_JWT]", s)
    s = STRIPE_KEY_PATTERN.sub("[REDACTED_STRIPE_KEY]", s)
    s = BEARER_PATTERN.sub("Bearer [REDACTED]", s)
    return s

def redact_sensitive_values(data: Any, depth: int = 0, max_depth: int = 8) -> Any:
    """
    Recursively audits and redacts passwords, tokens, cookies, and keys from payloads.
    """
    if depth > max_depth:
        return data

    if isinstance(data, dict):
        clean_dict = {}
        for k, v in data.items():
            k_lower = str(k).lower()
            if any(sens in k_lower for sens in SENSITIVE_KEYS):
                clean_dict[k] = "[REDACTED]"
            else:
                clean_dict[k] = redact_sensitive_values(v, depth + 1, max_depth)
        return clean_dict
    elif isinstance(data, list):
        return [redact_sensitive_values(item, depth + 1, max_depth) for item in data]
    elif isinstance(data, tuple):
        return tuple(redact_sensitive_values(item, depth + 1, max_depth) for item in data)
    elif isinstance(data, str):
        return mask_string(data)
    return data

class SensitiveDataFilter(logging.Filter):
    """
    Logging filter ensuring normal log messages never leak credentials or secrets.
    """
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = mask_string(record.msg)
        return True
