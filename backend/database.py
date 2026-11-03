"""
database.py
Neon PostgreSQL database foundation for the HR chatbot.
"""

import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
)
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("NEON_DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "PostgreSQL connection string not found. "
        "Add DATABASE_URL to your backend .env file."
    )

database_url = make_url(DATABASE_URL)

if database_url.drivername in ("postgres", "postgresql"):
    database_url = database_url.set(drivername="postgresql+psycopg")

if database_url.drivername != "postgresql+psycopg":
    raise ValueError(
        "Invalid database driver. Please use a Neon PostgreSQL connection string."
    )

engine = create_engine(
    database_url,
    pool_pre_ping=True,
    pool_recycle=300,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def utcnow():
    return datetime.now(timezone.utc)


# Chat history
class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    employee_email = Column(String, index=True, nullable=False)
    title = Column(String, default="New Chat")
    created_at = Column(DateTime, default=utcnow)

    messages = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    source = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    session = relationship("ChatSession", back_populates="messages")


# Analytics
class QALog(Base):
    __tablename__ = "qa_logs"

    id = Column(Integer, primary_key=True, index=True)
    employee_email = Column(String, index=True, nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    source = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow, index=True)


# Onboarding checklist
class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    suggested_question = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)


class EmployeeProgress(Base):
    __tablename__ = "employee_progress"

    id = Column(Integer, primary_key=True, index=True)
    employee_email = Column(String, index=True, nullable=False)
    item_id = Column(Integer, ForeignKey("checklist_items.id"), nullable=False)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)


# FastAPI dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Creates PostgreSQL tables if they do not already exist."""
    Base.metadata.create_all(bind=engine)
