import base64
import hashlib
import hmac
import secrets
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from time import monotonic
from fastapi import Depends, HTTPException, Request, Response
from argon2 import Parameters, PasswordHasher, extract_parameters
from argon2.exceptions import InvalidHashError, VerificationError
from argon2.low_level import core, ffi, lib
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DBSession
from .config import IS_WORKER, settings
from .database import get_db, inline_on_workers
from .models import Session, User

hasher = PasswordHasher()
# A public PHC value with a random salt and digest. Unknown accounts still
# incur a full Argon2id verification with the existing password parameters.
DUMMY_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$QxTK1BD4FD7hwBlYVLYiKw$"
    "78pDLqj3+wHxVC6B4sA4kefO/651lHj0saUvLM7EWmY"
)
COOKIE = "marai_session"
buckets = defaultdict(deque)


def _verify_serial_argon2(encoded_hash: str, password: str, params: Parameters) -> bool:
    def decode_phc(value: str) -> bytes:
        return base64.b64decode(value + "=" * (-len(value) % 4), validate=True)

    salt, expected = map(decode_phc, encoded_hash.split("$")[-2:])
    password_bytes = password.encode(hasher.encoding)
    salt_buffer = ffi.new("uint8_t[]", salt)
    password_buffer = ffi.new("uint8_t[]", password_bytes)
    output = ffi.new("uint8_t[]", len(expected))
    # The stored lane count is part of the hash. Only the number of native
    # threads is reduced so Pyodide can process those lanes sequentially.
    context = ffi.new(
        "argon2_context *",
        {
            "out": output,
            "outlen": len(expected),
            "pwd": password_buffer,
            "pwdlen": len(password_bytes),
            "salt": salt_buffer,
            "saltlen": len(salt),
            "t_cost": params.time_cost,
            "m_cost": params.memory_cost,
            "lanes": params.parallelism,
            "threads": 1,
            "version": params.version,
            "flags": lib.ARGON2_FLAG_CLEAR_PASSWORD,
        },
    )
    return core(context, params.type.value) == lib.ARGON2_OK and hmac.compare_digest(
        bytes(ffi.buffer(output)), expected
    )


def verify_password(encoded_hash: str, password: str) -> bool:
    try:
        if IS_WORKER:
            params = extract_parameters(encoded_hash)
            if params.parallelism > 1:
                return _verify_serial_argon2(encoded_hash, password, params)
        return hasher.verify(encoded_hash, password)
    except (VerificationError, InvalidHashError, ValueError, OverflowError):
        return False


def client_ip(request: Request) -> str:
    if IS_WORKER:
        return request.headers.get("cf-connecting-ip") or "unknown"
    return request.client.host if request.client else "unknown"


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


@inline_on_workers
def current_user(request: Request, db: DBSession = Depends(get_db)):
    raw = request.cookies.get(COOKIE, "")
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    if IS_WORKER:
        # Use the database clock for expiry. Hyperdrive treats queries with
        # NOW() as uncacheable, so a revoked session cannot survive in its cache.
        row = db.execute(
            select(Session, func.now()).where(Session.token_hash == token_hash)
        ).one_or_none()
        session, current_time = row or (None, None)
    else:
        session = db.get(Session, token_hash)
        current_time = datetime.now(timezone.utc)
    if not session:
        raise HTTPException(401, "Entre na sua conta para continuar.")
    expiry = session.expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if expiry < current_time:
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
