"""
AI Surveillance System - Auth Schemas

Schemas for authentication requests and token responses.
"""

from pydantic import BaseModel


class Token(BaseModel):
    """Schema for returning an access token."""
    access_token: str
    token_type: str


class TokenData(BaseModel):
    """Schema for the decoded payload extracted from a JWT."""
    sub: str | None = None
