import secrets
import hashlib
import logging
from datetime import datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from core.database import get_db
from models.user import User
from models.api_key import ApiKey
from schemas.api_key import ApiKeyCreate, ApiKeyResponse, ApiKeyCreatedResponse, ALLOWED_SCOPES
from routers.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/keys", tags=["API Keys"])

def generate_secure_api_key() -> tuple[str, str, str]:
    """
    Generates a cryptographically random API key.
    Returns: (raw_key, key_prefix, hashed_key)
    """
    token = secrets.token_urlsafe(32)
    raw_key = f"bg_live_{token}"
    key_prefix = f"bg_live_{token[:6]}...{token[-4:]}"
    hashed_key = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
    return raw_key, key_prefix, hashed_key

@router.post("", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    req: ApiKeyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate a new scoped API key. The raw secret key is returned ONLY ONCE.
    Only the SHA-256 hash and masked prefix are persisted in the database.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only organization admins can create API keys.")

    # Validate scopes
    for scope in req.scopes:
        if scope not in ALLOWED_SCOPES:
            raise HTTPException(status_code=400, detail=f"Invalid scope: {scope}. Allowed: {list(ALLOWED_SCOPES)}")

    raw_key, key_prefix, hashed_key = generate_secure_api_key()

    expires_at = None
    if req.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=req.expires_in_days)

    api_key_record = ApiKey(
        org_id=current_user.org_id,
        created_by_user_id=current_user.id,
        name=req.name.strip(),
        key_prefix=key_prefix,
        hashed_key=hashed_key,
        scopes=",".join(req.scopes),
        expires_at=expires_at,
        revoked=False
    )
    db.add(api_key_record)
    await db.commit()
    await db.refresh(api_key_record)

    logger.info(
        f"[SECURITY_AUDIT] API key created: id={api_key_record.id}, org_id={current_user.org_id}, "
        f"prefix={key_prefix}, scopes={req.scopes}"
    )

    return ApiKeyCreatedResponse(
        id=api_key_record.id,
        name=api_key_record.name,
        key_prefix=api_key_record.key_prefix,
        scopes=[s.strip() for s in api_key_record.scopes.split(",") if s.strip()],
        created_at=api_key_record.created_at,
        expires_at=api_key_record.expires_at,
        revoked=api_key_record.revoked,
        last_used_at=api_key_record.last_used_at,
        raw_key=raw_key
    )

@router.get("", response_model=List[ApiKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all API keys for the current organization. Secret material and hashes are NEVER returned.
    """
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.org_id == current_user.org_id)
        .order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()

    return [
        ApiKeyResponse(
            id=k.id,
            name=k.name,
            key_prefix=k.key_prefix,
            scopes=[s.strip() for s in k.scopes.split(",") if s.strip()],
            created_at=k.created_at,
            expires_at=k.expires_at,
            revoked=k.revoked,
            last_used_at=k.last_used_at
        )
        for k in keys
    ]

@router.post("/{key_id}/rotate", response_model=ApiKeyCreatedResponse)
async def rotate_api_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Rotate an API key: Revokes the previous key and issues a newly generated key with the same metadata/scopes.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only organization admins can rotate API keys.")

    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.org_id == current_user.org_id)
    )
    old_key = result.scalars().first()
    if not old_key:
        raise HTTPException(status_code=404, detail="API key not found.")

    # Revoke old key
    old_key.revoked = True
    old_key.revoked_at = datetime.utcnow()

    # Issue new key
    raw_key, key_prefix, hashed_key = generate_secure_api_key()
    new_key = ApiKey(
        org_id=current_user.org_id,
        created_by_user_id=current_user.id,
        name=f"{old_key.name} (Rotated)",
        key_prefix=key_prefix,
        hashed_key=hashed_key,
        scopes=old_key.scopes,
        expires_at=old_key.expires_at,
        revoked=False
    )
    db.add(new_key)
    await db.commit()
    await db.refresh(new_key)

    logger.info(
        f"[SECURITY_AUDIT] API key rotated: old_id={old_key.id}, new_id={new_key.id}, "
        f"org_id={current_user.org_id}, new_prefix={key_prefix}"
    )

    return ApiKeyCreatedResponse(
        id=new_key.id,
        name=new_key.name,
        key_prefix=new_key.key_prefix,
        scopes=[s.strip() for s in new_key.scopes.split(",") if s.strip()],
        created_at=new_key.created_at,
        expires_at=new_key.expires_at,
        revoked=new_key.revoked,
        last_used_at=new_key.last_used_at,
        raw_key=raw_key
    )

@router.delete("/{key_id}", status_code=status.HTTP_200_OK)
async def revoke_api_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Revoke an active API key immediately.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only organization admins can revoke API keys.")

    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.org_id == current_user.org_id)
    )
    target_key = result.scalars().first()
    if not target_key:
        raise HTTPException(status_code=404, detail="API key not found.")

    target_key.revoked = True
    target_key.revoked_at = datetime.utcnow()
    await db.commit()

    logger.info(
        f"[SECURITY_AUDIT] API key revoked: id={target_key.id}, org_id={current_user.org_id}, "
        f"prefix={target_key.key_prefix}"
    )
    return {"message": "API key successfully revoked", "id": target_key.id, "revoked": True}
