from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, ChecklistItem, EmployeeProgress, ChatSession, ChatMessage
from auth import require_login, require_role, load_users

router = APIRouter(tags=["Checklist"])


# -----------------------------
# Models
# -----------------------------
class ChecklistItemOut(BaseModel):
    id: int
    title: str
    description: str | None
    suggested_question: str | None


class ChecklistItemIn(BaseModel):
    title: str
    description: str | None = None
    suggested_question: str | None = None


class ProgressOut(BaseModel):
    item_id: int
    completed: bool


class EmployeeOut(BaseModel):
    email: str
    completed_items: int
    total_items: int


class EmployeeSessionOut(BaseModel):
    id: int
    title: str
    created_at: str


class EmployeeMessageOut(BaseModel):
    role: str
    content: str
    source: str | None
    created_at: str


# -----------------------------
# Checklist items (HR manages, everyone reads)
# -----------------------------
@router.get("/checklist/items", response_model=list[ChecklistItemOut])
def list_items(user: dict = Depends(require_login), db: Session = Depends(get_db)):
    items = db.query(ChecklistItem).order_by(ChecklistItem.created_at).all()
    return [
        ChecklistItemOut(
            id=i.id, title=i.title, description=i.description, suggested_question=i.suggested_question
        )
        for i in items
    ]


@router.post("/checklist/items", response_model=ChecklistItemOut, dependencies=[Depends(require_role("hr"))])
def create_item(payload: ChecklistItemIn, db: Session = Depends(get_db)):
    item = ChecklistItem(
        title=payload.title,
        description=payload.description,
        suggested_question=payload.suggested_question,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ChecklistItemOut(
        id=item.id, title=item.title, description=item.description, suggested_question=item.suggested_question
    )


@router.delete("/checklist/items/{item_id}", dependencies=[Depends(require_role("hr"))])
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found.")
    db.query(EmployeeProgress).filter(EmployeeProgress.item_id == item_id).delete(synchronize_session=False)
    db.delete(item)
    db.commit()
    return {"success": True}


# -----------------------------
# Per-employee progress
# -----------------------------
@router.get("/checklist/progress", response_model=list[ProgressOut])
def get_progress(user: dict = Depends(require_login), db: Session = Depends(get_db)):
    rows = db.query(EmployeeProgress).filter(EmployeeProgress.employee_email == user["email"]).all()
    return [ProgressOut(item_id=r.item_id, completed=r.completed) for r in rows]


@router.post("/checklist/progress/{item_id}", response_model=ProgressOut)
def set_progress(
    item_id: int,
    completed: bool = True,
    user: dict = Depends(require_login),
    db: Session = Depends(get_db),
):
    if not db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first():
        raise HTTPException(status_code=404, detail="Checklist item not found.")

    row = (
        db.query(EmployeeProgress)
        .filter(EmployeeProgress.employee_email == user["email"], EmployeeProgress.item_id == item_id)
        .first()
    )
    if row is None:
        row = EmployeeProgress(employee_email=user["email"], item_id=item_id)
        db.add(row)

    row.completed = completed
    row.completed_at = datetime.now(timezone.utc) if completed else None
    db.commit()
    return ProgressOut(item_id=item_id, completed=completed)


# -----------------------------
# HR roster (employee list + checklist completion)
# -----------------------------
@router.get("/employees", response_model=list[EmployeeOut], dependencies=[Depends(require_role("hr"))])
def list_employees(db: Session = Depends(get_db)):
    total_items = db.query(ChecklistItem).count()
    emails = [email for email, info in load_users().items() if info.get("role") == "employee"]

    result = []
    for email in emails:
        completed = (
            db.query(EmployeeProgress)
            .filter(EmployeeProgress.employee_email == email, EmployeeProgress.completed.is_(True))
            .count()
        )
        result.append(EmployeeOut(email=email, completed_items=completed, total_items=total_items))
    return result


# -----------------------------
# HR view into an individual employee's chat history — a deliberate privacy
# trade-off (previously Analytics only exposed aggregates, e.g. most-cited
# documents, not individual conversations). Read-only from HR's side: no
# edit/delete of an employee's own chat data through these routes.
# -----------------------------
@router.get(
    "/employees/{email}/sessions",
    response_model=list[EmployeeSessionOut],
    dependencies=[Depends(require_role("hr"))],
)
def list_employee_sessions(email: str, db: Session = Depends(get_db)):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.employee_email == email)
        .order_by(ChatSession.created_at.desc())
        .all()
    )
    return [
        EmployeeSessionOut(id=s.id, title=s.title, created_at=s.created_at.isoformat())
        for s in sessions
    ]


@router.get(
    "/employees/{email}/sessions/{session_id}/messages",
    response_model=list[EmployeeMessageOut],
    dependencies=[Depends(require_role("hr"))],
)
def get_employee_session_messages(email: str, session_id: int, db: Session = Depends(get_db)):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.employee_email == email)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    return [
        EmployeeMessageOut(role=m.role, content=m.content, source=m.source, created_at=m.created_at.isoformat())
        for m in session.messages
    ]
