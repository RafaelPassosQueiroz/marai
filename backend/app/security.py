import hashlib
import secrets
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from time import monotonic
from fastapi import Depends, HTTPException, Request, Response
from argon2 import PasswordHasher
from sqlalchemy.orm import Session as DBSession
from .config import settings
from .database import get_db
from .models import Session, User

hasher = PasswordHasher()
COOKIE = "marai_session"
buckets = defaultdict(deque)


def rate_limit(key: str, limit=30, seconds=60):
    clock = monotonic()
    if len(buckets) > 10000:
        for old_key in list(buckets):
            if not buckets[old_key] or clock - buckets[old_key][-1] > 3600:
                del buckets[old_key]
    queue = buckets[key]
    while queue and clock - queue[0] > seconds:
        queue.popleft()
    if len(queue) >= limit:
        raise HTTPException(
            429,
            "Muitas tentativas. Aguarde um pouco.",
            headers={"Retry-After": str(seconds)},
        )
    queue.append(clock)


def current_user(request: Request, db: DBSession = Depends(get_db)):
    raw = request.cookies.get(COOKIE, "")
    session = db.get(Session, hashlib.sha256(raw.encode()).hexdigest())
    if not session:
        raise HTTPException(401, "Entre na sua conta para continuar.")
    expiry = session.expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if expiry < datetime.now(timezone.utc):
        db.delete(session)
        db.commit()
        raise HTTPException(401, "Sua sessão expirou. Entre novamente.")
    user = db.get(User, session.user_id)
    if not user:
        raise HTTPException(401, "Conta não encontrada.")
    return user


def establish_session(db: DBSession, user: User, response: Response):
    raw = secrets.token_urlsafe(48)
    expires = datetime.now(timezone.utc) + timedelta(days=settings.session_days)
    db.add(
        Session(
            token_hash=hashlib.sha256(raw.encode()).hexdigest(),
            user_id=user.id,
            expires_at=expires,
        )
    )
    db.commit()
    response.set_cookie(
        COOKIE,
        raw,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.session_days * 86400,
        path="/",
    )
