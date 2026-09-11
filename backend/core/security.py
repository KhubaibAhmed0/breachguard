from datetime import datetime, timedelta
from typing import Any, Union, Optional, Dict
from jose import jwt
import bcrypt
from core.config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(
    subject: Union[str, Any], 
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[Dict[str, Any]] = None
) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    if extra_claims:
        to_encode.update(extra_claims)
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

USED_RESET_TOKENS: Dict[str, float] = {}

def create_reset_token(email: str, expires_minutes: int = 60) -> str:
    now = datetime.utcnow()
    expire = now + timedelta(minutes=expires_minutes)
    to_encode = {
        "exp": expire,
        "sub": email.lower().strip(),
        "purpose": "password_reset",
        "iat": int(now.timestamp())
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def verify_reset_token_payload(token: str) -> Optional[Dict[str, Any]]:
    """
    BG-SEC-11: Validates reset token signature, expiration, and checks consumed state.
    """
    try:
        # Check consumed token cache
        if token in USED_RESET_TOKENS:
            return None

        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("purpose") != "password_reset":
            return None
        return payload
    except Exception:
        return None

def verify_reset_token(token: str) -> Optional[str]:
    payload = verify_reset_token_payload(token)
    return payload.get("sub") if payload else None

def mark_reset_token_used(token: str):
    """
    Marks a reset token as permanently consumed.
    """
    now = datetime.utcnow().timestamp()
    USED_RESET_TOKENS[token] = now
    # Prune tokens older than 2 hours
    expired_keys = [k for k, t in USED_RESET_TOKENS.items() if now - t > 7200]
    for k in expired_keys:
        USED_RESET_TOKENS.pop(k, None)
