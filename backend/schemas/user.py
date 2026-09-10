from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    org_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

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
