import hashlib
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse
from sqlalchemy import select, delete
from sqlalchemy.orm import Session as DBSession
from sqlalchemy.exc import IntegrityError
from ..config import IS_WORKER, settings
from ..database import get_db, inline_on_workers
from ..models import User, Session
from ..schemas import Registration, Credentials, UserOutput
from ..security import (
    COOKIE,
    DUMMY_HASH,
    client_ip,
    current_user,
    establish_session,
    hasher,
    rate_limit,
    verify_password,
)
from authlib.integrations.starlette_client import OAuth

oauth = OAuth()
google_enabled = bool(
    settings.google_client_id
    and settings.google_client_secret
    and (not IS_WORKER or settings.oauth_state_secret)
)
if google_enabled:
    oauth.register(
        name="google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )
router = APIRouter()


async def password_work(request: Request, operation, *args):
    if not IS_WORKER:
        return await run_in_threadpool(operation, *args)
    try:
        worker = request.scope["env"].PASSWORD_KDF.getByName("marai-auth")
        return await getattr(worker, operation.__name__)(*args)
    except Exception:
        raise HTTPException(503, "O login está temporariamente indisponível.") from None


@router.post("/api/auth/register", response_model=UserOutput)
async def register(
    data: Registration,
    request: Request,
    response: Response,
    db: DBSession = Depends(get_db),
):
    rate_limit(f"auth:{client_ip(request)}", 10, 300)
    user = User(
        name=data.name.strip() or "Amigo",
        email=str(data.email).lower(),
        password_hash=await password_work(request, hasher.hash, data.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409, "Já existe uma conta com esse e-mail. Entre na sua conta."
        )
    establish_session(db, user, response)
    return user


@router.post("/api/auth/login", response_model=UserOutput)
async def login(
    data: Credentials,
    request: Request,
    response: Response,
    db: DBSession = Depends(get_db),
):
    rate_limit(f"auth:{client_ip(request)}", 10, 300)
    user = db.scalar(select(User).where(User.email == str(data.email).lower()))
    # Always verify a hash to reduce email enumeration via timing.
    password_hash = user.password_hash if user and user.password_hash else DUMMY_HASH
    valid = await password_work(request, verify_password, password_hash, data.password)
    if not valid or not user or not user.password_hash:
        raise HTTPException(401, "E-mail ou senha incorretos.")
    establish_session(db, user, response)
    return user


@router.get("/api/auth/me", response_model=UserOutput)
async def me(user: User = Depends(current_user)):
    return user


@router.post("/api/auth/logout")
@inline_on_workers
def logout(request: Request, response: Response, db: DBSession = Depends(get_db)):
    raw = request.cookies.get(COOKIE, "")
    db.execute(
        delete(Session).where(
            Session.token_hash == hashlib.sha256(raw.encode()).hexdigest()
        )
    )
    db.commit()
    response.delete_cookie(
        COOKIE, path="/", httponly=True, secure=settings.cookie_secure, samesite="lax"
    )
    return {"ok": True}


@router.get("/api/auth/google")
async def google_login(request: Request):
    if not google_enabled:
        raise HTTPException(
            503,
            "O login Google precisa de GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET."
            + (" No Worker, configure também OAUTH_STATE_SECRET." if IS_WORKER else ""),
        )
    redirect_uri = settings.google_redirect_uri
    if IS_WORKER:
        redirect_uri = str(request.url_for("google_callback"))
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/api/auth/google/callback")
async def google_callback(request: Request, db: DBSession = Depends(get_db)):
    if not google_enabled:
        raise HTTPException(503, "Login Google ainda não configurado.")
    frontend = "/" if IS_WORKER else settings.frontend_url.rstrip("/") + "/"
    try:
        token = await oauth.google.authorize_access_token(request)
        info = token["userinfo"]
        if not info.get("email_verified"):
            raise ValueError()
    except Exception:
        return RedirectResponse(frontend + "?auth_error=google")
    user = db.scalar(select(User).where(User.google_sub == info["sub"]))
    if not user:
        existing = db.scalar(select(User).where(User.email == info["email"].lower()))
        # Do not silently link an existing password account from an OAuth callback.
        if existing:
            return RedirectResponse(frontend + "?auth_error=existing")
        user = User(
            name=info.get("name", "Amigo")[:80],
            email=info["email"].lower(),
            google_sub=info["sub"],
        )
        db.add(user)
        db.commit()
    response = RedirectResponse(frontend)
    establish_session(db, user, response)
    return response
