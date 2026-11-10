"""Conversation ViewModel: validated actions, context, policy and atomic state transitions."""

import json

from fastapi import HTTPException
from sqlalchemy import select, update
from ..models import Message, Operation, now
from ..security import rate_limit
from ..services.safety import is_blocked, REFUSALS
from ..services.dialogue import reply, summarize, allowed_history
from ..repositories import own_conversation, conversation_data
from ..models import Conversation

active_operations: set[str] = set()


async def submit_turn(conversation_id, data, user, db):
    conv = own_conversation(db, user, conversation_id)
    previous_op = db.scalar(
        select(Operation).where(
            Operation.conversation_id == conv.id,
            Operation.request_id == data.request_id,
        )
    )
    if previous_op:
        return conversation_data(conv)
    rate_limit(f"turn:{user.id}", 25, 60)
    if conv.id in active_operations or conv.version != data.expected_version:
        raise HTTPException(
            409, "A conversa foi atualizada. Recarregue antes de continuar."
        )
    if (
        conv.messages
        and conv.messages[-1].provider == "safety"
        and data.action in ("regenerate", "topic")
    ):
        # No button/API action can continue the dialogue instead of a reformulated user turn.
        return conversation_data(conv)
    active_operations.add(conv.id)
    try:
        messages = list(conv.messages)
        old_version = conv.version
        last = messages[-1] if messages else None
        if data.action == "start" and messages:
            raise HTTPException(409, "Esta conversa já foi iniciada.")
        if data.action == "message" and not data.text.strip():
            raise HTTPException(422, "Sua mensagem está vazia.")
        if data.action == "regenerate" and (not last or last.role != "assistant"):
            raise HTTPException(409, "Não há uma resposta disponível para substituir.")
        if data.action == "regenerate":
            messages = messages[:-1]
        history = "\n".join(f"{m.role}: {m.content}" for m in messages[-6:])
        blocked = False
        if data.action == "message":
            blocked = await is_blocked(data.text, history)
            new_user = Message(
                conversation_id=conv.id,
                role="user",
                content=data.text.strip(),
                sequence=len(messages),
                provider="blocked" if blocked else "user",
            )
        # Regeneration cannot turn a rejected sexual request into permitted content.
        elif data.action == "regenerate" and messages and messages[-1].role == "user":
            blocked = await is_blocked(messages[-1].content, history)
        if not blocked:
            # Also cover identities saved before the current policy existed.
            profile = {
                "name": conv.snapshot["name"],
                "persona": conv.snapshot["persona"],
            }
            blocked = await is_blocked(
                json.dumps(profile, ensure_ascii=False), direction="persona"
            )
        if blocked:
            answer, provider = REFUSALS[conv.language], "safety"
        else:
            if conv.summary and await is_blocked(conv.summary, direction="memory"):
                conv.summary, conv.summary_count = "", 0
            if len(messages) - conv.summary_count > 40:
                to_summarize = allowed_history(messages[conv.summary_count : -20])
                summary = (
                    await summarize(conv.summary, to_summarize)
                    if to_summarize
                    else conv.summary
                )
                conv.summary = (
                    ""
                    if summary and await is_blocked(summary, direction="memory")
                    else summary
                )
                conv.summary_count = len(messages) - 20
            context_messages = allowed_history(messages[conv.summary_count :])
            if data.action == "message":
                context_messages = [*context_messages, new_user]
            answer, provider = await reply(
                conv, context_messages, data.action, last.content if last else ""
            )
            if await is_blocked(answer, history, direction="output"):
                answer, provider = REFUSALS[conv.language], "safety"
        if provider == "safety":
            # Never carry a rejected attempt (or a compromised old summary) into future turns.
            conv.summary, conv.summary_count = "", 0
            if data.action == "message":
                new_user.provider = "blocked"
        # Compare-and-swap protects against other workers/tabs modifying the same version.
        changed = db.execute(
            update(Conversation)
            .where(Conversation.id == conv.id, Conversation.version == old_version)
            .values(version=old_version + 1, updated_at=now())
        )
        if changed.rowcount != 1:
            db.rollback()
            raise HTTPException(
                409, "A conversa mudou em outra janela. Recarregue para continuar."
            )
        if data.action == "message":
            db.add(new_user)
            if (
                not any(m.role == "user" and m.provider != "blocked" for m in messages)
                and provider != "safety"
            ):
                conv.title = data.text.strip()[:75]
        if data.action == "regenerate":
            last.content, last.provider, last.revision = (
                answer,
                provider,
                last.revision + 1,
            )
        else:
            sequence = len(messages) + (1 if data.action == "message" else 0)
            db.add(
                Message(
                    conversation_id=conv.id,
                    role="assistant",
                    content=answer,
                    sequence=sequence,
                    provider=provider,
                )
            )
        db.add(
            Operation(
                conversation_id=conv.id,
                request_id=data.request_id,
                version=old_version + 1,
            )
        )
        db.commit()
        db.refresh(conv)
        db.expire(conv, ["messages"])
        return conversation_data(conv)
    except Exception:
        db.rollback()
        raise
    finally:
        active_operations.discard(conversation_id)
