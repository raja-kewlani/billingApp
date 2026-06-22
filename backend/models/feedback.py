from pydantic import UUID4
from typing import Optional
from datetime import datetime
from .base import BaseSchema

class FeedbackBase(BaseSchema):
    description: str

class FeedbackCreate(FeedbackBase):
    firm_id: UUID4

class FeedbackUpdate(BaseSchema):
    is_solved: bool

class FeedbackResponse(FeedbackBase):
    id: UUID4
    firm_id: UUID4
    created_by: UUID4
    is_solved: bool
    created_at: datetime
