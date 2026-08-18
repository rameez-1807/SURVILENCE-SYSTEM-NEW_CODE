"""
AI Surveillance System - Auth API Router

Endpoints for login and current user profile.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, get_db
from app.core.security import create_access_token, verify_password
from app.repositories.user import UserRepository
from app.schemas.auth import Token
from app.schemas.user import UserResponse

router = APIRouter(tags=["Auth"])


@router.post("/auth/token", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    """
    OAuth2 compatible token login, get an access token for future requests.
    Using email as the username.
    """
    repo = UserRepository(db)
    user = await repo.get_by_email(email=form_data.username)
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token = create_access_token(subject=str(user.id))
    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
async def read_users_me(
    current_user: CurrentUser,
) -> UserResponse:
    """
    Get current logged in user.
    """
    return UserResponse.model_validate(current_user)
