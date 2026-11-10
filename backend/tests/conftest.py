import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.database import Base, get_db
from app.main import app
from app.security import buckets


@pytest.fixture
def client(monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)

    def db():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = db
    buckets.clear()
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def ai(monkeypatch):
    from app.viewmodels import conversation as conversation_vm
    from app.views import characters

    calls = []

    async def safe(text, context="", direction="input"):
        return "BLOCK_THIS" in text

    async def reply(conv, messages, action, previous=""):
        calls.append(
            {
                "action": action,
                "previous": previous,
                "messages": [m.content for m in messages],
            }
        )
        return f"Generated answer {len(calls)}. What do you think?", "test"

    monkeypatch.setattr(conversation_vm, "is_blocked", safe)
    monkeypatch.setattr(characters, "is_blocked", safe)
    monkeypatch.setattr(conversation_vm, "reply", reply)
    return calls


def register(client, email="a@example.com"):
    response = client.post(
        "/api/auth/register",
        json={"name": "Teste", "email": email, "password": "test-password-123"},
    )
    assert response.status_code == 200, response.text
    return response.json()


def character(client):
    response = client.post("/api/characters", json={"name": "Liam"})
    assert response.status_code == 200, response.text
    return response.json()


def conversation(client, char):
    response = client.post(
        "/api/conversations",
        json={
            "character_id": char["id"],
            "language": "en",
            "level": "B1",
            "scene": "park",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()
