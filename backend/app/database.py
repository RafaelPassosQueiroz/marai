from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .config import settings
from .database_engine import create_database_engine


class Base(DeclarativeBase):
    pass


engine = create_database_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db():
    with SessionLocal() as db:
        yield db
