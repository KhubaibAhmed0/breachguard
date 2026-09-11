from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from core.database import get_db
from core.security import (
    get_password_hash, verify_password, create_access_token,
    create_reset_token, verify_reset_token,
    verify_reset_token_payload, mark_reset_token_used
)
from schemas.user import (
    UserCreate, UserLogin, UserResponse, Token,
    ForgotPasswordRequest, ResetPasswordRequest
)
from models.user import User
from models.organization import Organization
from routers.deps import get_current_user
from fastapi.security import OAuth2PasswordRequestForm
from core.config import settings
from services.email_service import send_email, render_password_reset_email

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

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from core.rate_limiter import check_rate_limit
import asyncio
import os

def set_auth_cookie(response: Response, token: str):
    """
    BG-SEC-12: Configures HttpOnly, Secure, SameSite=Lax authentication cookie.
    """
    is_prod = bool(
        os.environ.get("VERCEL") 
        or os.environ.get("ENVIRONMENT") == "production" 
        or os.environ.get("NODE_ENV") == "production"
    )
    response.set_cookie(
        key="bg_session",
        value=token,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )

@router.post("/login", response_model=Token)
async def login(
    request: Request, 
    response: Response, 
    login_data: UserLogin, 
    db: AsyncSession = Depends(get_db)
):
    # Rate limit per IP (10 requests per minute)
    check_rate_limit(request, "login", max_requests=10, window_seconds=60)

    result = await db.execute(select(User).where(User.email == login_data.email))
    user = result.scalars().first()
    
    # Generic error and constant-time execution guard
    is_valid = False
    if user:
        is_valid = verify_password(login_data.password, user.hashed_password)
    else:
        # Dummy verification to prevent timing attack on non-existent users
        verify_password("dummy_password_constant_time", "$2b$12$KIXb.Q9LzGq7kQc1fQvM1eN1Z0G6yv4X8Yqf6J5v8B3u6f7i8k9yO")

    if not is_valid or not user:
        await asyncio.sleep(0.3)  # Progressive mitigation against brute-force
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    
    access_token = create_access_token(subject=user.id)
    set_auth_cookie(response, access_token)
    return {"access_token": access_token, "token_type": "bearer"}  # nosec B105

@router.post("/token", response_model=Token)
async def token_login(
    request: Request, 
    response: Response, 
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: AsyncSession = Depends(get_db)
):
    # Rate limit per IP (10 requests per minute)
    check_rate_limit(request, "login", max_requests=10, window_seconds=60)

    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()
    
    is_valid = False
    if user:
        is_valid = verify_password(form_data.password, user.hashed_password)
    else:
        verify_password("dummy_password_constant_time", "$2b$12$KIXb.Q9LzGq7kQc1fQvM1eN1Z0G6yv4X8Yqf6J5v8B3u6f7i8k9yO")

    if not is_valid or not user:
        await asyncio.sleep(0.3)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    
    access_token = create_access_token(subject=user.id)
    set_auth_cookie(response, access_token)
    return {"access_token": access_token, "token_type": "bearer"}  # nosec B105

@router.post("/logout")
async def logout(response: Response):
    """
    BG-SEC-12: Clears HttpOnly session cookie on logout.
    """
    response.delete_cookie(key="bg_session", path="/")
    return {"status": "success", "message": "Logged out successfully"}

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

@router.post("/forgot-password")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Dispatches a secure time-limited password reset link via email.
    Always returns uniform message to prevent user enumeration attacks.
    """
    check_rate_limit(request, "forgot-password", max_requests=5, window_seconds=300)

    clean_email = body.email.lower().strip()
    result = await db.execute(select(User).where(User.email == clean_email))
    user = result.scalars().first()

    if user:
        reset_token = create_reset_token(user.email, expires_minutes=60)
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
        html_body = render_password_reset_email(reset_url=reset_url, user_email=user.email)
        try:
            await send_email(
                to_email=user.email,
                subject="Reset Your BreachGuard Password",
                html_body=html_body,
                text_body=f"Reset your password at: {reset_url}"
            )
        except Exception as e:
            # Safe logging; do not leak to client
            import logging
            logging.getLogger("breachguard.auth").error(f"Failed to dispatch password reset email: {e}")

    return {
        "status": "success",
        "message": "If that email address is registered, a password reset link has been dispatched."
    }

@router.post("/reset-password")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Validates reset token and securely updates user password.
    """
    check_rate_limit(request, "reset-password", max_requests=5, window_seconds=300)

    payload = verify_reset_token_payload(body.token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The password reset link is invalid, expired, or has already been used. Please request a new link."
        )

    user_email = payload.get("sub")
    iat_ts = payload.get("iat")

    result = await db.execute(select(User).where(User.email == user_email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid account reference."
        )

    # BG-SEC-11: Reject reset if password was modified after token generation
    if user.password_changed_at and iat_ts:
        user_changed_ts = int(user.password_changed_at.timestamp())
        if user_changed_ts > iat_ts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This password reset token has already been used. Please request a new link."
            )

    # Update password and update password_changed_at timestamp
    user.hashed_password = get_password_hash(body.new_password)
    user.password_changed_at = datetime.utcnow()
    await db.commit()

    # Invalidate token in single-use cache
    mark_reset_token_used(body.token)

    return {
        "status": "success",
        "message": "Your password has been successfully updated. You may now sign in."
    }
