from __future__ import annotations

from pydantic import BaseModel, Field


class AuthRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=256)


class ConversationRequest(BaseModel):
    title: str = Field(default="New conversation", min_length=1, max_length=120)


class MessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    model: str | None = Field(default=None, min_length=1, max_length=120)


class ApiKeyRequest(BaseModel):
    api_key: str = Field(min_length=20, max_length=512)


class FeedbackRequest(BaseModel):
    rating: int
    reason: str | None = Field(default=None, max_length=500)
