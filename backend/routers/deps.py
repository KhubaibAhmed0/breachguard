import hashlib
import logging
from datetime import datetime
from typing import Optional, List
from fastapi import Depends, HTTPException, Header, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.config import settings
from models.user import User
from models.organization import Organization
from models.api_key import ApiKey

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. Check for API Key authentication (either via X-API-Key header or Bearer bg_live_...)
    api_key_str = None
    if x_api_key and x_api_key.startswith("bg_live_"):
        api_key_str = x_api_key
    elif token and token.startswith("bg_live_"):
        api_key_str = token

    if api_key_str:
        hashed = hashlib.sha256(api_key_str.encode("utf-8")).hexdigest()
        result = await db.execute(
            select(ApiKey).where(ApiKey.hashed_key == hashed)
        )
        api_key_record = result.scalars().first()

        if not api_key_record or api_key_record.revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked API key"
            )

        if api_key_record.expires_at and api_key_record.expires_at < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key has expired"
            )

        # Update last_used_at timestamp without logging the secret key
        api_key_record.last_used_at = datetime.utcnow()
        await db.commit()

        # Load the tenant organization
        org_res = await db.execute(
            select(Organization).where(Organization.id == api_key_record.org_id)
        )
        org = org_res.scalars().first()
        if not org:
            raise HTTPException(status_code=403, detail="Associated organization not found")

        # Load or represent authenticated user for this key
        user = None
        if api_key_record.created_by_user_id:
            u_res = await db.execute(
                select(User)
                .options(selectinload(User.organization))
                .where(User.id == api_key_record.created_by_user_id)
            )
            user = u_res.scalars().first()

        if not user:
            user = User(
                id=api_key_record.created_by_user_id or 0,
                email=f"apikey-{api_key_record.key_prefix}@service.breachguard",
                role="admin",
                org_id=api_key_record.org_id
            )

        user.organization = org
        user.org_id = org.id
        # Attach scopes to user context
        user.api_scopes = [s.strip() for s in api_key_record.scopes.split(",") if s.strip()]
        return user

    # 2. Standard JWT Authentication
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        scoped_org_id = payload.get("org_id")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    result = await db.execute(
        select(User)
        .options(selectinload(User.organization))
        .where(User.id == int(user_id))
    )
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    
    # If this token is scoped to a specific child tenant under MSP
    if scoped_org_id is not None and scoped_org_id != user.org_id:
        t_res = await db.execute(
            select(Organization).where(Organization.id == int(scoped_org_id))
        )
        tenant_org = t_res.scalars().first()
        if not tenant_org:
            raise HTTPException(status_code=403, detail="Scoped tenant organization not found")
        
        if tenant_org.parent_org_id != user.org_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this tenant")
        
        user.org_id = tenant_org.id
        user.organization = tenant_org

    # Check trial expiration
    if user.organization and getattr(user.organization, "is_trial", False):
        t_end = getattr(user.organization, "trial_ends_at", None)
        if t_end and t_end < datetime.utcnow():
            user.organization.plan = "essential"
            user.organization.is_trial = False

    user.api_scopes = None  # Full access (interactive user session)
    return user

def require_scope(required_scope: str):
    """
    Dependency factory to verify API key permission scopes.
    Standard interactive JWT sessions bypass scope checks.
    """
    async def scope_dependency(current_user: User = Depends(get_current_user)) -> User:
        scopes: Optional[List[str]] = getattr(current_user, "api_scopes", None)
        if scopes is not None:
            if required_scope not in scopes and "*" not in scopes:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"API key missing required permission scope: '{required_scope}'"
                )
        return current_user
    return scope_dependency

