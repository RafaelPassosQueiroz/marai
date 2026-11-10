from datetime import timezone
from fastapi import HTTPException
from sqlalchemy import select
from .models import Character, Conversation
from .services.safety import REFUSALS


def own_character(db, user, character_id):
    char = db.scalar(
        select(Character).where(
            Character.id == character_id, Character.user_id == user.id
        )
    )
    if not char:
        raise HTTPException(404, "Personagem não encontrado.")
    return char


def own_conversation(db, user, conversation_id):
    conv = db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id, Conversation.user_id == user.id
        )
    )
    if not conv:
        raise HTTPException(404, "Conversa não encontrada.")
    return conv


def character_data(char):
    return {
        "id": char.id,
        "name": char.name,
        "appearance": char.appearance,
        "persona": char.persona,
        "voice": char.voice,
    }


def conversation_data(conv, include_messages=True):
    def utc(value):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    data = {
        "id": conv.id,
        "title": conv.title,
        "character_id": conv.character_id,
        "snapshot": conv.snapshot,
        "language": conv.language,
        "level": conv.level,
        "scene": conv.scene,
        "created_at": utc(conv.created_at),
        "updated_at": utc(conv.updated_at),
        "version": conv.version,
    }
    if include_messages:
        messages = list(conv.messages)
        data["awaiting_user"] = bool(messages and messages[-1].provider == "safety")
        data["messages"] = [
            {
                "id": m.id,
                "role": m.role,
                "content": REFUSALS[conv.language]
                if m.provider == "safety"
                else "[Mensagem bloqueada]"
                if (
                    m.provider == "blocked"
                    or (
                        m.role == "user"
                        and index + 1 < len(messages)
                        and messages[index + 1].provider == "safety"
                    )
                )
                else m.content,
                "blocked": m.provider in ("blocked", "safety")
                or (
                    m.role == "user"
                    and index + 1 < len(messages)
                    and messages[index + 1].provider == "safety"
                ),
                "revision": m.revision,
                "created_at": utc(m.created_at),
            }
            for index, m in enumerate(messages)
        ]
    return data
