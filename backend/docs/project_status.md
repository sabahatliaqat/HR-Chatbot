markdown
# project_status.md

## Project Overview

"Arch Assistant" — a RAG-based internal HR chatbot for a company (Arcana
Info). Employees ask questions about leave, benefits, and IT setup and
get answers grounded in uploaded company documents. HR uploads/manages
those documents and has a dashboard for document management, employee
onboarding tracking, and usage analytics. Originally a 3-person
university/internship project (chunking-embedding, backend, UI), later
extended solo with a full React frontend, JWT auth, and a SQLite
database layer.

## Tech Stack

- **Backend:** Python, FastAPI, Uvicorn
- **LLM:** Google Gemini (`gemini-3-flash` currently set in `rag_chain.py`
  — this project has repeatedly hit free-tier quota limits and had to
  swap model names several times; treat the exact model name as
  volatile, always verify against the account's real quota)
- **Embeddings:** Google Gemini (`gemini-embedding-001`)
- **Vector store:** FAISS (local, file-based)
- **Chunking:** LangChain — `RecursiveCharacterTextSplitter` (PDF/image
  text), `MarkdownHeaderTextSplitter` (.md files)
- **OCR:** `pytesseract` (Python wrapper) — requires the Tesseract OCR
  binary installed separately on the OS, not just pip-installed
- **Auth:** JWT (PyJWT) + bcrypt password hashing. Employee accounts in
  a flat `users.json` file (no SQL — deliberate scope decision). HR is a
  single fixed account configured via `.env`, not self-registered.
- **Database:** SQLite via SQLAlchemy (`database.py`) — used only for
  relational data (chat history, analytics, checklist), not for auth
- **Original UI:** Streamlit (still exists, fully functional, separate
  from the React UI)
- **New UI:** React 18 + Vite + Tailwind CSS — was standalone during UI
  review, has since been merged into the main project folder alongside
  `backend/`, `chunking-embedding/`, `ui/`

## Current Architecture / File Structure

hr-chatbot-project/
├── backend/
│ ├── main.py — FastAPI app, registers all routers, creates DB on startup
│ ├── auth.py — password hashing, JWT, signup/login logic, role-check dependencies
│ ├── auth_routes.py — /auth/signup, /auth/login
│ ├── database.py — SQLAlchemy setup, 5 tables (see below)
│ ├── chat_routes.py — POST /chat (RAG answer; optionally persists to DB if logged in)
│ ├── chat_history_routes.py — /chat/sessions (create/list/delete), /chat/sessions/{id}/messages
│ ├── checklist_routes.py — /checklist/items, /checklist/progress, /employees (HR roster)
│ ├── analytics_routes.py — /analytics/summary (HR only)
│ ├── upload_routes.py — /upload-documents, /reset-documents, /documents/{filename} delete,
│ │ /indexed-documents (all document-management endpoints)
│ ├── rag_chain.py — FAISS retrieval + Gemini answer generation + hallucination controls
│ ├── requirements.txt
│ ├── .env — GEMINI_API_KEY, JWT_SECRET, HR_EMAIL, HR_PASSWORD_HASH
│ ├── users.json — runtime, employee accounts
│ ├── indexed_files.json — runtime, document registry (filename, size, date, status)
│ ├── hr_chatbot.db — runtime, SQLite database
│ └── faiss_index/ — runtime, vector index
├── chunking-embedding/ — NOTE: hyphenated folder name, backend imports its files via
│ │ sys.path.append() (can't import a hyphenated name as a package)
│ ├── pdf_processor.py
│ ├── markdown_processor.py
│ ├── image_processor.py — needs Tesseract binary path set (see Known Issues)
│ ├── chunking.py
│ ├── embeddings.py — FAISS create/update/delete-per-document/count-chunks
│ └── requirements.txt
├── ui/ — Streamlit app (original), still functional
├── docs/
│ └── api_contract.md — full endpoint reference, kept up to date
├── roadmap.md — phased plan
├── new-features-task-guide.md — 4-way task split for the DB-backed features
└── frontend/ — React app
├── index.html
├── public/ — logo, favicon files
├── tailwind.config.js — design tokens (purple gradient theme, Montserrat/Plus Jakarta Sans)
└── src/
├── App.jsx — routes by role (employee -> Chat, hr -> Admin) after login
├── lib/apiClient.js — all backend calls, JWT token handling (persisted to localStorage)
├── pages/
│ ├── LoginPage.jsx — Sign In/Up, role toggle, "Skip login — preview UI only" bypass
│ ├── ChatPage.jsx — Employee view: Chat tab (real sessions) + Checklist tab
│ └── AdminPage.jsx — HR view: Documents / Analytics / Employees tabs
└── components/
├── Sidebar.jsx, ChatMessage.jsx, TypingIndicator.jsx
├── OnboardingChecklist.jsx — real backend-driven (was localStorage)
├── StatCard.jsx, ConfirmModal.jsx
├── AnalyticsTab.jsx, EmployeesTab.jsx — new, DB-backed


**Database tables** (`database.py`): `ChatSession`, `ChatMessage`,
`QALog` (analytics), `ChecklistItem`, `EmployeeProgress`.

## Completed Features (100% working, tested)

- Full RAG pipeline: document upload → chunk → embed → FAISS → retrieval
  → Gemini answer with source citation
- Hallucination controls: similarity threshold, strict prompt, no source
  shown on "not found" answers
- Meta-question handling — "which documents do you have" answered
  directly from the registry, not guessed via vector search
- On-brand refusal for off-topic questions (weather, code requests, etc.)
- Friendly rate-limit error message (instead of raw API error dump)
- JWT auth: signup/login, HR fixed account, password policy
  (8+ chars, letter+number), role-based route protection
- Document management: HR-only upload/reset/delete-single-file, real
  document table (filename/size/date/status), duplicate-upload
  prevention
- SQLite database — built, all 5 tables functionally tested via a real
  FastAPI TestClient (14/14 tests passing, including access-control
  checks)
- Real per-employee chat history: sessions/messages, sidebar shows/loads/
  deletes real conversations (only for real logins, not "Skip login")
- Real Analytics: total/weekly question counts, most-cited documents
  (numbers + simple bars, no chart library yet)
- Real Employees tab: roster with checklist completion %, HR can add/
  remove onboarding checklist tasks via the UI
- Checklist: migrated off localStorage to the real backend, "Ask"
  button sends the employee straight into a real chat exchange
- Complete React UI: Login/Signup, Employee Chat, HR Admin dashboard,
  consistent purple-gradient design system, transition animations,
  custom favicon
- Original Streamlit UI — still fully functional as a separate, simpler
  alternative frontend