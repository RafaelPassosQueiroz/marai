from argon2 import PasswordHasher

from app import security


def test_worker_verifies_an_existing_hash_with_multiple_lanes(monkeypatch):
    password = "senha-de-teste-compatível"
    encoded_hash = PasswordHasher(memory_cost=256, parallelism=4).hash(password)
    monkeypatch.setattr(security, "IS_WORKER", True)

    assert security.verify_password(encoded_hash, password)
    assert not security.verify_password(encoded_hash, "outra senha")
    assert not security.verify_password("hash inválido", password)
