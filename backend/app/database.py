from asyncio import Lock
from contextvars import ContextVar
from inspect import signature

from fastapi import HTTPException, Request
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool
from .config import IS_WORKER, settings
from .database_engine import create_database_engine


class Base(DeclarativeBase):
    pass


if IS_WORKER:
    from pg8000.dbapi import connect

    _hyperdrive = ContextVar("marai_hyperdrive")

    def connect_hyperdrive():
        binding = _hyperdrive.get()
        return connect(
            host=binding.host,
            port=int(binding.port),
            user=binding.user,
            password=binding.password,
            database=binding.database,
            ssl_context=False,
            timeout=10,
        )

    # The socket to the binding is request-scoped. Hyperdrive pools and uses
    # TLS for the separate connection from Cloudflare to Aiven.
    engine = create_engine(
        "postgresql+pg8000://",
        creator=connect_hyperdrive,
        poolclass=NullPool,
        hide_parameters=True,
    )
else:
    engine = create_database_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


if IS_WORKER:
    _initialize_engine = Lock()
    _engine_ready = False

    async def get_db(request: Request):
        global _engine_ready
        token = _hyperdrive.set(request.scope["env"].HYPERDRIVE)
        try:
            with SessionLocal() as db:
                if not _engine_ready:
                    # The first connection initializes shared dialect metadata.
                    async with _initialize_engine:
                        if not _engine_ready:
                            try:
                                db.connection()
                            except SQLAlchemyError:
                                raise HTTPException(
                                    503, "Banco de dados indisponível."
                                ) from None
                            _engine_ready = True
                yield db
        finally:
            _hyperdrive.reset(token)
else:
    def get_db():
        with SessionLocal() as db:
            yield db


def inline_on_workers(function):
    if not IS_WORKER:
        return function

    # FastAPI resolves this signature for validation and dependency injection.
    # Workers provides sockets without requiring a native thread pool.
    async def call(*args, **kwargs):
        return function(*args, **kwargs)

    call.__name__ = function.__name__
    call.__doc__ = function.__doc__
    call.__signature__ = signature(function)
    return call
