from contextvars import ContextVar
from inspect import signature

from fastapi import HTTPException, Request
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool
from .config import IS_WORKER, settings


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

    def create_worker_engine():
        # Sockets stay in the request that opened them. Hyperdrive pools
        # the separate TLS connections to Aiven.
        return create_engine(
            "postgresql+pg8000://",
            creator=connect_hyperdrive,
            poolclass=NullPool,
            hide_parameters=True,
        )

    engine = None
else:
    from .database_engine import create_database_engine

    engine = create_database_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


if IS_WORKER:
    async def get_db(request: Request):
        global engine
        token = _hyperdrive.set(request.scope["env"].HYPERDRIVE)
        try:
            request_engine = engine
            initializing = request_engine is None
            if initializing:
                # Concurrent cold requests initialize independently. Waiting on
                # another request's I/O via a shared lock can hang in workerd.
                request_engine = create_worker_engine()
            with SessionLocal(bind=request_engine) as db:
                if initializing:
                    try:
                        db.connection()
                    except SQLAlchemyError:
                        raise HTTPException(
                            503, "Banco de dados indisponível."
                        ) from None
                    if engine is None:
                        engine = request_engine
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
