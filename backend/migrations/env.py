import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from alembic import context
from sqlalchemy import pool
from app.config import settings
from app.database import Base
from app.database_engine import create_database_engine
from app import models

target_metadata = Base.metadata


def run():
    if context.is_offline_mode():
        context.configure(
            url=settings.database_url,
            target_metadata=target_metadata,
            literal_binds=True,
        )
        with context.begin_transaction():
            context.run_migrations()
    else:
        engine = create_database_engine(settings.database_url, poolclass=pool.NullPool)
        with engine.connect() as connection:
            context.configure(connection=connection, target_metadata=target_metadata)
            with context.begin_transaction():
                context.run_migrations()


run()
