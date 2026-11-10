import secrets
import hashlib
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select, delete
from sqlalchemy.orm import Session as DBSession
from sqlalchemy.exc import IntegrityError
from argon2.exceptions import VerificationError, InvalidHashError
from ..config import settings
from ..database import get_db
from ..models import User, Session
from ..schemas import Registration, Credentials, UserOutput
from ..security import current_user, establish_session, hasher, COOKIE, rate_limit
from authlib.integrations.starlette_client import OAuth

oauth = OAuth()
if settings.google_client_id and settings.google_client_secret:
    oauth.register(
        name="google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(32))

router = APIRouter()


@router.post("/api/auth/register", response_model=UserOutput)
def register(
    data: Registration,
    request: Request,
    response: Response,
    db: DBSession = Depends(get_db),
):
    rate_limit(f"auth:{request.client.host}", 10, 300)
    user = User(
        name=data.name.strip() or "Amigo",
        email=str(data.email).lower(),
        password_hash=hasher.hash(data.password),
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
def login(
    data: Credentials,
    request: Request,
    response: Response,
    db: DBSession = Depends(get_db),
):
    rate_limit(f"auth:{request.client.host}", 10, 300)
    user = db.scalar(select(User).where(User.email == str(data.email).lower()))
    try:
        # Always verify a hash to reduce email enumeration via timing.
        password_hash = (
            user.password_hash if user and user.password_hash else DUMMY_HASH
        )
        valid = hasher.verify(password_hash, data.password)
    except (VerificationError, InvalidHashError):
        valid = False
    if not valid or not user or not user.password_hash:
        raise HTTPException(401, "E-mail ou senha incorretos.")
    establish_session(db, user, response)
    return user


@router.get("/api/auth/me", response_model=UserOutput)
def me(user: User = Depends(current_user)):
    return user


@router.post("/api/auth/logout")
def logout(request: Request, response: Response, db: DBSession = Depends(get_db)):
    raw = request.cookies.get(COOKIE, "")
    db.execute(
        delete(Session).where(
            Session.token_hash == hashlib.sha256(raw.encode()).hexdigest()
        )
    )
    db.commit()
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.get("/api/auth/google")
async def google_login(request: Request):
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            503, "O login Google precisa de GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET."
        )
    return await oauth.google.authorize_redirect(request, settings.google_redirect_uri)


@router.get("/api/auth/google/callback")
async def google_callback(request: Request, db: DBSession = Depends(get_db)):
    if not settings.google_client_id:
        raise HTTPException(503, "Login Google ainda não configurado.")
    try:
        token = await oauth.google.authorize_access_token(request)
        info = token["userinfo"]
        if not info.get("email_verified"):
            raise ValueError()
    except Exception:
        return RedirectResponse(settings.frontend_url + "/?auth_error=google")
    user = db.scalar(select(User).where(User.google_sub == info["sub"]))
    if not user:
        existing = db.scalar(select(User).where(User.email == info["email"].lower()))
        # Do not silently link an existing password account from an OAuth callback.
        if existing:
            return RedirectResponse(settings.frontend_url + "/?auth_error=existing")
        user = User(
            name=info.get("name", "Amigo")[:80],
            email=info["email"].lower(),
            google_sub=info["sub"],
        )
        db.add(user)
        db.commit()
    response = RedirectResponse(settings.frontend_url)
    establish_session(db, user, response)
    return response
