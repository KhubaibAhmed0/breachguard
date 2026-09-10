from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128, description="Password must be at least 8 characters.")
    org_name: str = Field(..., min_length=2, max_length=100)

class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    org_id: int
    role: str
    org_name: Optional[str] = None
    plan: Optional[str] = "business"
    is_trial: Optional[bool] = False
    trial_days_remaining: Optional[int] = None
    trial_ends_at: Optional[datetime] = None
    created_at: datetime
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
