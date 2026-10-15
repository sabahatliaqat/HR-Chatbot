import json
import os
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, QALog, ChecklistItem, EmployeeProgress
from auth import require_role, load_users

NOT_FOUND_PREFIX = "I'm sorry, I cannot find this information"

router = APIRouter(prefix="/analytics", tags=["Analytics"])

INDEXED_REGISTRY_PATH = "indexed_files.json"


def _currently_indexed_filenames() -> set[str]:
    if not os.path.exists(INDEXED_REGISTRY_PATH):
        return set()
    with open(INDEXED_REGISTRY_PATH, "r") as f:
        data = json.load(f)
    return set(data.keys()) if isinstance(data, dict) else set(data)


class DailyCount(BaseModel):
    date: str  # "YYYY-MM-DD"
    count: int


class DocumentCount(BaseModel):
    document: str
    count: int


class AnalyticsSummary(BaseModel):
    total_questions: int
    total_employees: int
    questions_last_7_days: list[DailyCount]
    most_cited_documents: list[DocumentCount]
    answered_count: int
    not_found_count: int
    checklist_completion_rate: float  # 0-100


@router.get("/summary", response_model=AnalyticsSummary, dependencies=[Depends(require_role("hr"))])
def get_summary(db: Session = Depends(get_db)):
    total_questions = db.query(QALog).count()
    total_employees = sum(1 for info in load_users().values() if info.get("role") == "employee")

    today = datetime.now(timezone.utc).date()
    since = datetime.combine(today - timedelta(days=6), datetime.min.time(), tzinfo=timezone.utc)
    recent_logs = db.query(QALog).filter(QALog.created_at >= since).all()

    counts_by_day = Counter(log.created_at.date() for log in recent_logs)
    daily = [
        DailyCount(date=str(today - timedelta(days=offset)), count=counts_by_day.get(today - timedelta(days=offset), 0))
        for offset in range(6, -1, -1)
    ]

    indexed_now = _currently_indexed_filenames()
    doc_counter = Counter()
    for log in db.query(QALog).all():
        if not log.source or log.source in ("N/A", "System Error", "No documents uploaded"):
            continue
        for doc in log.source.split(","):
            doc = doc.strip()
            # Only count documents still indexed today — a deleted document
            # showing up as "most-cited" reads as a bug, not history.
            if doc and doc in indexed_now:
                doc_counter[doc] += 1

    # No cap — every currently-indexed document that's actually been cited
    # by at least one answered question should show up here, not just a
    # top-N slice.
    most_cited = [DocumentCount(document=doc, count=count) for doc, count in doc_counter.most_common()]

    not_found_count = (
        db.query(QALog).filter(QALog.answer.like(f"{NOT_FOUND_PREFIX}%")).count()
    )
    answered_count = total_questions - not_found_count

    total_items = db.query(ChecklistItem).count()
    completed_count = db.query(EmployeeProgress).filter(EmployeeProgress.completed.is_(True)).count()
    possible_slots = total_items * total_employees
    checklist_completion_rate = round(completed_count / possible_slots * 100, 1) if possible_slots else 0.0

    return AnalyticsSummary(
        total_questions=total_questions,
        total_employees=total_employees,
        questions_last_7_days=daily,
        most_cited_documents=most_cited,
        answered_count=answered_count,
        not_found_count=not_found_count,
        checklist_completion_rate=checklist_completion_rate,
    )

