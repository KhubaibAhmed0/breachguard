from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from core.database import get_db
from core.security import get_password_hash, verify_password, create_access_token
from schemas.user import UserCreate, UserLogin, UserResponse, Token
from models.user import User
from models.organization import Organization
from routers.deps import get_current_user
from fastapi.security import OAuth2PasswordRequestForm

router = APIRouter()

from datetime import datetime, timedelta

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    trial_end = datetime.utcnow() + timedelta(days=7)
    org = Organization(
        name=user_in.org_name,
        plan="business",
        is_trial=True,
        trial_ends_at=trial_end
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)
    
    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        org_id=org.id,
        role="admin"
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=user.id,
        email=user.email,
        org_id=user.org_id,
        role=user.role,
        org_name=org.name,
        plan=org.plan,
        is_trial=True,
        trial_days_remaining=7,
        trial_ends_at=trial_end,
        created_at=user.created_at
    )

@router.post("/login", response_model=Token)
async def login(login_data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == login_data.email))
    user = result.scalars().first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = create_access_token(subject=user.id)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/token", response_model=Token)
async def token_login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = create_access_token(subject=user.id)
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    org = current_user.organization
    days_left = None
    is_trial = False
    plan = "essential"
    org_name = None
    trial_ends_at = None

    if org:
        org_name = org.name
        plan = org.plan
        trial_ends_at = getattr(org, "trial_ends_at", None)
        raw_is_trial = bool(getattr(org, "is_trial", False))

        if trial_ends_at:
            now = datetime.utcnow()
            if trial_ends_at > now and raw_is_trial:
                days_left = max(1, (trial_ends_at - now).days + 1)
                is_trial = True
            else:
                days_left = 0
                is_trial = False
                plan = "essential"
        else:
            is_trial = False
            days_left = None

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        org_id=current_user.org_id,
        role=current_user.role,
        org_name=org_name,
        plan=plan,
        is_trial=is_trial,
        trial_days_remaining=days_left,
        trial_ends_at=trial_ends_at,
        created_at=current_user.created_at
    )
