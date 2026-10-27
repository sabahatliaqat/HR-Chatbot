from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from routers.upload_routes import router as upload_router
from routers.chat_routes import router as chat_router
from routers.auth_routes import router as auth_router
from routers.chat_history_routes import router as chat_history_router
from routers.checklist_routes import router as checklist_router
from routers.analytics_routes import router as analytics_router

from database import init_db, SessionLocal, ChecklistItem

app = FastAPI(
    title="HR Chatbot Backend",
    description="RAG Based HR Chatbot using FastAPI + Gemini + FAISS",
    version="1.0.0"
)

# Creates hr_chatbot.db and its tables on first run, if they don't exist yet
init_db()

# Seeds the default onboarding tasks once, on a fresh database — these were
# previously hardcoded in the frontend (OnboardingChecklist.jsx) with no
# backend at all; HR can add/remove tasks via /checklist/items from here on.
_DEFAULT_CHECKLIST_ITEMS = [
    ("Collect laptop and set up MFA", "What do I need to do on my first day?"),
    ("Connect to the staff Wi-Fi", "Which Wi-Fi network should I connect to?"),
    ("Join your assigned Slack channels", "How do I join my Slack channels?"),
    ("Set up the VPN", "How do I set up the VPN?"),
    ("Review the annual leave policy", "How many days of annual leave do I get?"),
    ("Read the dress code guidelines", "What is the dress code?"),
]


def _seed_checklist_items():
    db = SessionLocal()
    try:
        if db.query(ChecklistItem).count() == 0:
            for title, question in _DEFAULT_CHECKLIST_ITEMS:
                db.add(ChecklistItem(title=title, suggested_question=question))
            db.commit()
    finally:
        db.close()


_seed_checklist_items()

# ---------------- CORS ---------------- #
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------- Routes ---------------- #
app.include_router(upload_router)
app.include_router(chat_router)
app.include_router(auth_router)
app.include_router(chat_history_router)
app.include_router(checklist_router)
app.include_router(analytics_router)

# --------------- Home ------------------ #
@app.get("/")
def home():
    return {
        "status": "Running",
        "message": "HR Chatbot Backend is Live"
    }

# -------------------------------------------------------------
# 🛠️ SWAGGER UI FILE UPLOAD BUG FIX (Expert Workaround)
# This patch forces Swagger UI to render the proper "Choose File"
# button instead of a broken text box for multi-file uploads.
# -------------------------------------------------------------
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    # Fix the components schema to change application/octet-stream back to binary format
    for component in openapi_schema.get("components", {}).get("schemas", {}).values():
        for prop in component.get("properties", {}).values():
            if prop.get("contentMediaType") == "application/octet-stream":
                del prop["contentMediaType"]
                prop["format"] = "binary"
            items = prop.get("items", {})
            if items.get("contentMediaType") == "application/octet-stream":
                del items["contentMediaType"]
                items["format"] = "binary"
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi