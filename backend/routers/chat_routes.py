import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from rag_chain import generate_answer, stream_answer
from database import get_db, SessionLocal, ChatSession, ChatMessage, QALog
from auth import get_optional_user

router = APIRouter(tags=["Chat"])


# -----------------------------
# Request Model
# -----------------------------
class ChatRequest(BaseModel):
    question: str
    session_id: int | None = None


# -----------------------------
# Response Model
# -----------------------------
class ChatResponse(BaseModel):
    success: bool
    question: str
    answer: str
    source: str
    session_id: int | None = None


def _session_title(question: str) -> str:
    title = question.strip()
    return title[:47] + "..." if len(title) > 50 else title


def _resolve_session_and_history(db: Session, user: dict | None, request: "ChatRequest"):
    """
    Looks up (or creates) the ChatSession for a logged-in user and loads
    prior messages for multi-turn context. Returns (session, chat_history)
    — both None when there's no logged-in user (guest/stateless mode).
    The session row is committed immediately so its id is durable even
    though the generated answer may still be a few seconds away.
    """
    if user is None:
        return None, None

    employee_email = user["email"]

    if request.session_id is not None:
        session = (
            db.query(ChatSession)
            .filter(ChatSession.id == request.session_id, ChatSession.employee_email == employee_email)
            .first()
        )
        if session is None:
            raise HTTPException(status_code=404, detail="Chat session not found.")

        prior_messages = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == session.id)
            .order_by(ChatMessage.created_at)
            .all()
        )
        chat_history = [{"role": m.role, "content": m.content} for m in prior_messages] if prior_messages else None
    else:
        session = ChatSession(employee_email=employee_email, title=_session_title(request.question))
        db.add(session)
        db.commit()
        chat_history = None

    return session, chat_history


# -----------------------------
# Chat Endpoint
# -----------------------------
@router.post(
    "/chat",
    response_model=ChatResponse
)
async def chat(
    request: ChatRequest,
    user: dict | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):

    try:
        session, chat_history = _resolve_session_and_history(db, user, request)

        result = generate_answer(request.question, chat_history=chat_history)

        if user is not None:
            db.add(ChatMessage(session_id=session.id, role="user", content=request.question))
            db.add(ChatMessage(
                session_id=session.id,
                role="assistant",
                content=result["answer"],
                source=result["source"],
            ))
            # Transient failures (quota/API outages) shouldn't count as real
            # Q&A in Analytics — they're not a signal about document
            # coverage or chatbot usage, just the provider being unavailable.
            if result["source"] != "System Error":
                db.add(QALog(
                    employee_email=user["email"],
                    question=request.question,
                    answer=result["answer"],
                    source=result["source"],
                ))
            db.commit()

        return ChatResponse(
            success=True,
            question=request.question,
            answer=result["answer"],
            source=result["source"],
            session_id=session.id if session else None,
        )

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(

            status_code=500,

            detail=str(e)

        )


# -----------------------------
# Streaming Chat Endpoint — same behavior as /chat, but the answer arrives
# token-by-token (newline-delimited JSON) instead of one final blob.
# -----------------------------
@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    user: dict | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    session, chat_history = _resolve_session_and_history(db, user, request)
    session_id = session.id if session else None
    employee_email = user["email"] if user is not None else None

    def event_generator():
        yield json.dumps({"type": "session", "session_id": session_id}) + "\n"

        final_answer = None
        final_source = None
        for event in stream_answer(request.question, chat_history=chat_history):
            if event["type"] == "done":
                final_answer = event["answer"]
                final_source = event["source"]
            yield json.dumps(event) + "\n"

        # Persisting after the request-scoped `db` dependency may already
        # be torn down (StreamingResponse finishes sending well after the
        # route handler returns) — use a fresh, self-contained session
        # instead of relying on the injected one still being open.
        if employee_email is not None and final_answer is not None:
            write_db = SessionLocal()
            try:
                write_db.add(ChatMessage(session_id=session_id, role="user", content=request.question))
                write_db.add(ChatMessage(
                    session_id=session_id, role="assistant", content=final_answer, source=final_source
                ))
                if final_source != "System Error":
                    write_db.add(QALog(
                        employee_email=employee_email,
                        question=request.question,
                        answer=final_answer,
                        source=final_source,
                    ))
                write_db.commit()
            finally:
                write_db.close()

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")