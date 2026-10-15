"""
seed_demo_data.py
One-off script (not imported by the app) that seeds a few realistic demo
employees with chat history and checklist progress, purely so the Analytics
and Employees dashboards have something to show instead of an empty state.
Safe to re-run — skips any employee email that already exists.

Run from backend/: python seed_demo_data.py
"""

from datetime import datetime, timedelta, timezone

from auth import load_users, save_users, hash_password
from database import SessionLocal, ChatSession, ChatMessage, QALog, ChecklistItem, EmployeeProgress

DEMO_PASSWORD = "Passw0rd1"

DEMO_EMPLOYEES = [
    "sara.ahmed@arcanainfo.com",
    "usman.tariq@arcanainfo.com",
    "hina.malik@arcanainfo.com",
    "bilal.raza@arcanainfo.com",
]

# (question, answer, source, days_ago)
DEMO_EXCHANGES = [
    ("How many days of annual leave do I get?",
     "Confirmed employees are entitled to 18 working days of annual leave per calendar year.",
     "Employee Handbook.pdf", 0),
    ("What is the dress code?",
     "Smart casual attire is required on regular office days; Fridays are casual.",
     "Employee Handbook.pdf", 1),
    ("How do I set up the VPN?",
     "Download GlobalProtect from the internal VPN portal, sign in with your company email, and approve the MFA prompt.",
     "IT Setup Guide.pdf", 1),
    ("Which Wi-Fi network should I connect to?",
     "Connect to the staff Wi-Fi network using your company credentials.",
     "IT Setup Guide.pdf", 2),
    ("What do I need to do on my first day?",
     "Collect your laptop, set up MFA, and connect to the staff Wi-Fi.",
     "task-guide.md", 3),
    ("How do I join my Slack channels?",
     "Your manager will add you to the relevant Slack channels during onboarding.",
     "task-guide.md", 4),
    ("What is the work from home policy?",
     "I'm sorry, I cannot find this information in the uploaded HR documents.",
     "N/A", 5),
]


def seed():
    users = load_users()
    new_emails = [e for e in DEMO_EMPLOYEES if e not in users]
    for email in new_emails:
        users[email] = {"password_hash": hash_password(DEMO_PASSWORD), "role": "employee"}
    if new_emails:
        save_users(users)
        print(f"Added {len(new_emails)} demo employee accounts (password: {DEMO_PASSWORD})")

    db = SessionLocal()
    try:
        item_ids = [i.id for i in db.query(ChecklistItem).order_by(ChecklistItem.id).all()]

        for idx, email in enumerate(DEMO_EMPLOYEES):
            if db.query(QALog).filter(QALog.employee_email == email).first():
                continue  # already seeded

            session = ChatSession(employee_email=email, title=DEMO_EXCHANGES[idx % len(DEMO_EXCHANGES)][0][:50])
            db.add(session)
            db.flush()

            # Each employee gets a handful of exchanges spread across the week
            exchanges = [DEMO_EXCHANGES[(idx + i) % len(DEMO_EXCHANGES)] for i in range(3 + idx % 3)]
            for question, answer, source, days_ago in exchanges:
                created = datetime.now(timezone.utc) - timedelta(days=days_ago, hours=idx)
                db.add(ChatMessage(session_id=session.id, role="user", content=question, created_at=created))
                db.add(ChatMessage(session_id=session.id, role="assistant", content=answer, source=source, created_at=created))
                db.add(QALog(employee_email=email, question=question, answer=answer, source=source, created_at=created))

            # Varying checklist completion per employee (0, 2, 4, all done)
            completed_count = min(idx * 2, len(item_ids))
            for item_id in item_ids[:completed_count]:
                db.add(EmployeeProgress(employee_email=email, item_id=item_id, completed=True, completed_at=datetime.now(timezone.utc)))

        db.commit()
        print("Seeded demo chat history, QALog entries, and checklist progress.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
