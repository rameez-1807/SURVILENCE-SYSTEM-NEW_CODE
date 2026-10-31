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


import asyncio
import logging
import traceback


@router.post("/auth/token", response_model=Token)
@router.post("/auth/access-token", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    """
    OAuth2 compatible token login, get an access token for future requests.
    Using email as the username.
    """
    clean_username = form_data.username.strip().lower() if form_data.username else ""
    try:
        repo = UserRepository(db)
        user = await repo.get_by_email(email=clean_username)
    except Exception as e:
        logging.error(f"[Auth] Database lookup error for '{clean_username}': {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database connection error during authentication: {type(e).__name__} - {str(e)}",
        )
    
    is_valid = False
    if user and user.hashed_password:
        try:
            is_valid = await asyncio.to_thread(verify_password, form_data.password, user.hashed_password)
        except Exception as e:
            logging.error(f"[Auth] Password verification error for '{clean_username}': {e}")
            is_valid = False

    if not user or not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )

    try:
        access_token = create_access_token(subject=str(user.id))
        return Token(access_token=access_token, token_type="bearer")
    except Exception as e:
        logging.error(f"[Auth] Token generation error: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Token creation failure: {type(e).__name__} - {str(e)}",
        )


@router.get("/me", response_model=UserResponse)
async def read_users_me(
    current_user: CurrentUser,
) -> UserResponse:
    """
    Get current logged in user.
    """
    return UserResponse.model_validate(current_user)
