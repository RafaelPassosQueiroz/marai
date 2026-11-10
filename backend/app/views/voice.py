from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession
from ..config import settings
from ..database import get_db
from ..models import User, Message
from ..security import current_user, rate_limit
from ..repositories import own_conversation
from ..services.voice import transcribe, synthesize, audio_duration
from ..services.safety import is_blocked, REFUSALS

router = APIRouter()


@router.post("/api/conversations/{conversation_id}/transcribe")
async def transcription(
    conversation_id: str,
    audio: UploadFile = File(...),
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    conv = own_conversation(db, user, conversation_id)
    rate_limit(f"audio:{user.id}", 20, 60)
    mime = (audio.content_type or "").split(";")[0]
    extensions = {
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/mp4": "m4a",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "audio/x-wav": "wav",
    }
    if mime not in extensions:
        raise HTTPException(415, "Formato de áudio não suportado.")
    data = await audio.read(settings.max_audio_bytes + 1)
    await audio.close()
    if len(data) > settings.max_audio_bytes:
        raise HTTPException(413, "Áudio muito grande. Grave uma mensagem mais curta.")
    if len(data) < 500:
        raise HTTPException(422, "O áudio está vazio ou muito curto. Grave novamente.")
    duration = audio_duration(data, mime)
    if duration and duration > settings.max_audio_seconds + 2:
        raise HTTPException(413, "O áudio deve ter até dois minutos.")
    result = await transcribe(
        data, f"recording.{extensions[mime]}", mime, conv.language
    )
    return {"text": result}


@router.post("/api/conversations/{conversation_id}/messages/{message_id}/speech")
async def speech(
    conversation_id: str,
    message_id: str,
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    conv = own_conversation(db, user, conversation_id)
    msg = db.scalar(
        select(Message).where(
            Message.id == message_id,
            Message.conversation_id == conv.id,
            Message.role == "assistant",
        )
    )
    if not msg:
        raise HTTPException(404, "Resposta não encontrada.")
    rate_limit(f"voice:{user.id}", 30, 60)
    if msg.provider != "safety" and await is_blocked(msg.content, direction="output"):
        raise HTTPException(422, REFUSALS[conv.language])
    return await synthesize(
        REFUSALS[conv.language] if msg.provider == "safety" else msg.content,
        conv.language,
        conv.snapshot["voice"],
        conv.level,
    )
