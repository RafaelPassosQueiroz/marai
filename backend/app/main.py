"""Marai HTTP application composition; business state lives in ViewModels."""

import secrets
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session as DBSession
from .config import settings, ROOT
from .database import get_db, engine
from .views import auth, characters, conversations, translation, voice

app = FastAPI(title="Marai", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)
# Only OAuth state uses this signed cookie. Persistent login uses revocable server-side sessions.
state_path = ROOT / ".runtime" / "oauth-state-secret"
state_path.parent.mkdir(exist_ok=True)
if not state_path.exists():
    state_path.write_text(secrets.token_urlsafe(48), encoding="utf-8")
app.add_middleware(
    SessionMiddleware,
    secret_key=state_path.read_text().strip(),
    session_cookie="marai_oauth",
    same_site="lax",
    https_only=settings.cookie_secure,
)


@app.middleware("http")
async def request_safety(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        origin = request.headers.get("origin")
        if origin and origin not in (
            settings.frontend_url,
            str(request.base_url).rstrip("/"),
        ):
            return JSONResponse(
                {"detail": "Origem da solicitação não permitida."}, status_code=403
            )
        size = request.headers.get("content-length")
        if size and int(size) > settings.max_audio_bytes + 65536:
            return JSONResponse({"detail": "Arquivo muito grande."}, status_code=413)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "camera=(), geolocation=(), microphone=(self)"
    )
    response.headers["X-Frame-Options"] = "DENY"
    if request.url.path.startswith("/api"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/health")
def health(db: DBSession = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(503, "Banco de dados indisponível. Inicie o PostgreSQL.")
    return {
        "status": "ok",
        "database": "postgresql"
        if engine.dialect.name == "postgresql"
        else engine.dialect.name,
    }


@app.get("/api/config")
def config():
    return {
        "google_enabled": bool(
            settings.google_client_id and settings.google_client_secret
        ),
        "max_audio_seconds": settings.max_audio_seconds,
        "max_audio_bytes": settings.max_audio_bytes,
        "ai_configured": bool(settings.gemini_api_key or settings.groq_api_key),
        "voice_provider": settings.tts_provider,
    }


for router in (auth.router, characters.router, conversations.router, voice.router, translation.router):
    app.include_router(router)

# Built frontend is served by FastAPI as a single-origin local application.
dist = ROOT / "frontend" / "dist"
if dist.exists():
    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}")
    def frontend(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Rota não encontrada.")
        candidate = (dist / path).resolve()
        if candidate.is_relative_to(dist.resolve()) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(dist / "index.html")
