"""
database.py
SQLite foundation for the HR chatbot. One file (hr_chatbot.db), five tables,
covering everything planned in new-features-task-guide.md:

- ChatSession / ChatMessage — real per-employee chat history (replaces the
  placeholder "Recent" list and localStorage-based state)
- QALog — every question+answer, for Analytics (weekly counts, most-cited
  documents)
- ChecklistItem / EmployeeProgress — HR-managed onboarding checklist
  (replaces the localStorage-only version in OnboardingChecklist.jsx)

This does NOT replace users.json/HR .env auth — that stays as-is (it's a
flat lookup, a database adds nothing there). This is only for the
relational data: sessions with many messages, employees with many
checklist items, that kind of structure.
"""

from datetime import datetime, timezone

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
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

DATABASE_URL = "sqlite:///./hr_chatbot.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # needed for SQLite + FastAPI's threaded requests
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def utcnow():
    return datetime.now(timezone.utc)


# -----------------------------
# Chat history
# -----------------------------
class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    employee_email = Column(String, index=True, nullable=False)
    title = Column(String, default="New Chat")
    created_at = Column(DateTime, default=utcnow)

    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String, nullable=False)          # "user" | "assistant"
    content = Column(Text, nullable=False)
    source = Column(String, nullable=True)          # only set for assistant messages
    created_at = Column(DateTime, default=utcnow)

    session = relationship("ChatSession", back_populates="messages")


# -----------------------------
# Analytics
# -----------------------------
class QALog(Base):
    """
    One row per question asked, independent of ChatMessage — this is what
    Analytics aggregates over (weekly counts, most-cited documents). Kept
    separate from ChatMessage so Analytics queries don't have to join
    through sessions, and so this table can be summarized/trimmed
    independently later if it grows large.
    """
    __tablename__ = "qa_logs"

    id = Column(Integer, primary_key=True, index=True)
    employee_email = Column(String, index=True, nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    source = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow, index=True)


# -----------------------------
# Onboarding checklist
# -----------------------------
class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    suggested_question = Column(Text, nullable=True)  # sent to /chat when the employee taps "Ask"
    created_at = Column(DateTime, default=utcnow)


class EmployeeProgress(Base):
    __tablename__ = "employee_progress"

    id = Column(Integer, primary_key=True, index=True)
    employee_email = Column(String, index=True, nullable=False)
    item_id = Column(Integer, ForeignKey("checklist_items.id"), nullable=False)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)


# -----------------------------
# FastAPI dependency
# -----------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Creates hr_chatbot.db and all tables if they don't exist yet."""
    Base.metadata.create_all(bind=engine)