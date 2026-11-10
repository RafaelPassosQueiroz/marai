from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..models import User
from ..security import current_user, rate_limit
from ..services.translation import TranslationError, translate

router = APIRouter()


class TranslationInput(BaseModel):
    text: str = Field(max_length=500)
    source: str = Field(max_length=10)
    target: str = Field(max_length=10)


@router.post("/api/translate")
async def translation(data: TranslationInput, user: User = Depends(current_user)):
    rate_limit(f"translation:{user.id}", 20, 60)
    try:
        return await translate(data.text, data.source, data.target)
    except TranslationError as error:
        raise HTTPException(error.status, str(error)) from None
