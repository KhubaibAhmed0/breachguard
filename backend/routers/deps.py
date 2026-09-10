from datetime import datetime
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from core.database import get_db
from core.config import settings
from models.user import User
from models.organization import Organization

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
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
        # Verify tenant organization belongs to this user's MSP org
        t_res = await db.execute(
            select(Organization).where(Organization.id == int(scoped_org_id))
        )
        tenant_org = t_res.scalars().first()
        if not tenant_org:
            raise HTTPException(status_code=403, detail="Scoped tenant organization not found")
        
        # Check permissions: user's org must be parent MSP of the tenant
        if tenant_org.parent_org_id != user.org_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this tenant")
        
        # Scope user context to this tenant
        user.org_id = tenant_org.id
        user.organization = tenant_org

    # Check trial expiration
    if user.organization and getattr(user.organization, "is_trial", False):
        t_end = getattr(user.organization, "trial_ends_at", None)
        if t_end and t_end < datetime.utcnow():
            user.organization.plan = "essential"
            user.organization.is_trial = False

    return user
