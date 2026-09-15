import os
from typing import Generator
from sqlmodel import create_engine, SQLModel, Session
from sqlalchemy import inspect, text

# Load database URL from environment or default to local SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./q_sqool.db")

# Render PostgreSQL URL fixes
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+psycopg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    # Additive migration for existing SQLite/PostgreSQL databases. Keep all rows.
    with engine.begin() as connection:
        columns = {column["name"] for column in inspect(connection).get_columns("learningprogress")}
        if "completed_lessons" not in columns:
            connection.execute(text("ALTER TABLE learningprogress ADD COLUMN completed_lessons JSON NOT NULL DEFAULT '[]'"))

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
