from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, ChatSession, ChatMessage
from auth import require_login

router = APIRouter(prefix="/chat/sessions", tags=["Chat History"])


class SessionOut(BaseModel):
    id: int
    title: str
    created_at: str


class MessageOut(BaseModel):
    role: str
    content: str
    source: str | None
    created_at: str


def _get_owned_session(db: Session, session_id: int, employee_email: str) -> ChatSession:
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session or session.employee_email != employee_email:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    return session


@router.get("", response_model=list[SessionOut])
def list_sessions(user: dict = Depends(require_login), db: Session = Depends(get_db)):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.employee_email == user["email"])
        .order_by(ChatSession.created_at.desc())
        .all()
    )
    return [
        SessionOut(id=s.id, title=s.title, created_at=s.created_at.isoformat())
        for s in sessions
    ]


@router.get("/{session_id}/messages", response_model=list[MessageOut])
def get_session_messages(session_id: int, user: dict = Depends(require_login), db: Session = Depends(get_db)):
    session = _get_owned_session(db, session_id, user["email"])
    return [
        MessageOut(role=m.role, content=m.content, source=m.source, created_at=m.created_at.isoformat())
        for m in session.messages
    ]


@router.delete("/{session_id}")
def delete_session(session_id: int, user: dict = Depends(require_login), db: Session = Depends(get_db)):
    session = _get_owned_session(db, session_id, user["email"])
    db.delete(session)
    db.commit()
    return {"success": True}
                                                                                                                                                                                                                                                                                                                