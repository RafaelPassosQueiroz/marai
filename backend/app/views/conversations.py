from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession
from ..database import get_db
from ..models import User, Conversation
from ..schemas import ConversationInput, TurnInput, RenameInput
from ..security import current_user
from ..repositories import (
    own_character,
    own_conversation,
    character_data,
    conversation_data,
)
from ..viewmodels.conversation import submit_turn

router = APIRouter()


@router.get("/api/conversations")
def conversations(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    return [
        conversation_data(c, False)
        for c in db.scalars(
            select(Conversation)
            .where(Conversation.user_id == user.id)
            .order_by(Conversation.updated_at.desc())
        )
    ]


@router.post("/api/conversations")
def create_conversation(
    data: ConversationInput,
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    char = own_character(db, user, data.character_id)
    conv = Conversation(
        user_id=user.id,
        character_id=char.id,
        snapshot=character_data(char),
        language=data.language,
        level=data.level,
        scene=data.scene,
        title=f"Conversa com {char.name}",
    )
    db.add(conv)
    db.commit()
    return conversation_data(conv)


@router.get("/api/conversations/{conversation_id}")
def get_conversation(
    conversation_id: str,
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    return conversation_data(own_conversation(db, user, conversation_id))


@router.patch("/api/conversations/{conversation_id}")
def rename(
    conversation_id: str,
    data: RenameInput,
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    conv = own_conversation(db, user, conversation_id)
    conv.title = data.title.strip() or "Conversa"
    db.commit()
    return conversation_data(conv)


@router.delete("/api/conversations/{conversation_id}")
def remove(
    conversation_id: str,
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    conv = own_conversation(db, user, conversation_id)
    db.delete(conv)
    db.commit()
    return {"ok": True}


@router.post("/api/conversations/{conversation_id}/turn")
async def turn(
    conversation_id: str,
    data: TurnInput,
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    return await submit_turn(conversation_id, data, user, db)
