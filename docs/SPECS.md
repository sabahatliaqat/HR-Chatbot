# Arch Assistant — Detailed Specifications

Companion to `ARCHITECTURE.md`. This file is the ground truth for what each
module does, every API endpoint, every database table, every frontend
component, and every environment variable — verified by direct code
inspection, not by trusting `project_status.md` (see the note at the bottom).

---

## 1. Backend modules

### `main.py`
App entrypoint. Creates the FastAPI app, runs `init_db()` (creates
`hr_chatbot.db` + tables on first run), seeds 6 default onboarding checklist
items on a fresh database, configures permissive CORS (`allow_origins=["*"]`),
registers all six routers, exposes `GET /` as a liveness check, and patches
the OpenAPI schema so Swagger UI renders a proper file-picker for multipart
uploads instead of a broken text box.

### `auth.py`
Not a route file — shared auth logic imported by `auth_routes.py` and used
as FastAPI dependencies elsewhere.
- `load_users()` / `save_users()` — read/write `users.json`.
- `hash_password()` / `verify_password()` — bcrypt.
- `create_token(email, role)` / `decode_token(token)` — JWT, `HS256`,
  12-hour expiry (`JWT_EXPIRY_HOURS`).
- `validate_password(password)` — min 8 chars, ≥1 letter, ≥1 digit.
- `signup_employee(email, password)` — rejects the reserved HR email and
  duplicate emails, writes a new `users.json` entry with role `"employee"`.
- `login(email, password, requested_role)` — HR branch checks against
  `.env`-configured credentials; employee branch checks `users.json` and
  that the account's actual role matches what was requested.
- `require_role(required_role)` — FastAPI dependency factory; reads the
  `Authorization: Bearer` header, decodes the JWT, 401s on missing/invalid/
  expired token, 403s if the role claim doesn't match.
- `require_login` — same but accepts any authenticated role.
- `get_optional_user` — returns the decoded payload if a valid token is
  present, else `None` (never raises) — used by `/chat` so the endpoint
  degrades gracefully rather than requiring auth outright.

### `auth_routes.py`
`POST /auth/signup`, `POST /auth/login` — see API reference below.

### `database.py`
SQLAlchemy setup: `sqlite:///./hr_chatbot.db`, `SessionLocal` factory,
`get_db()` FastAPI dependency (yields a session, closes in `finally`),
`init_db()` (`Base.metadata.create_all`). Five models — see §3.

### `upload_routes.py`
Document lifecycle endpoints. Holds `ALLOWED_EXTENSIONS = {.pdf, .md, .png,
.jpg, .jpeg}`. Dispatches text extraction by extension, chunks it, embeds
it into FAISS, and maintains `indexed_files.json` as the source of truth for
"what's currently indexed" (with a backward-compat migration path from an
older plain-list format to the current dict-with-metadata format). Every
mutating endpoint calls `rag_chain.clear_rag_caches()` afterward.

### `chat_routes.py`
`POST /chat` and `POST /chat/stream`. Both share `_resolve_session_and_history()`,
which either loads an existing session's prior messages (for multi-turn
context) or creates a new `ChatSession` row immediately (so its id is
durable before the answer is generated). The streaming endpoint uses a
**fresh `SessionLocal()`** for its post-stream DB write rather than the
request-scoped injected session, because a `StreamingResponse` generator
keeps running after the route handler returns, by which point the injected
session's teardown may have already raced ahead — see the in-code comment
for the full explanation. Transient errors (`source == "System Error"`) are
persisted to `ChatMessage` (so the user's own transcript is accurate) but
excluded from `QALog` (so outages don't pollute Analytics).

### `chat_history_routes.py`
Prefix `/chat/sessions`. `GET` (list, newest first), `GET /{id}/messages`,
`DELETE /{id}`. `_get_owned_session()` enforces that a session's
`employee_email` matches the requesting user — one employee can never read
or delete another's session (returns 404, not 403, to avoid confirming the
session even exists).

### `checklist_routes.py`
Three concerns in one file:
1. **Checklist items** (HR manages, everyone reads): `GET/POST /checklist/items`
   (POST is HR-only), `DELETE /checklist/items/{id}` (HR-only, also cascades
   deletes of any `EmployeeProgress` rows referencing that item).
2. **Per-employee progress**: `GET /checklist/progress` (the calling
   employee's own rows), `POST /checklist/progress/{item_id}?completed=bool`
   (upserts a progress row).
3. **HR roster**: `GET /employees` (HR-only) — every employee account from
   `users.json` cross-referenced against their `EmployeeProgress` completion
   count out of the total item count.

### `analytics_routes.py`
`GET /analytics/summary` (HR-only). Computes: total questions ever asked,
total employee accounts, a 7-day daily question-count series, most-cited
documents (cross-referenced against `indexed_files.json` so a *deleted*
document never appears as "most-cited" even though its historical `QALog`
rows still exist), answered vs. "not found" counts (by prefix-matching the
canned not-found message), and an overall checklist completion rate
(`completed / (total_items × total_employees) × 100`).

### `rag_chain.py`
The retrieval + generation pipeline — the most complex module. See §4 for
the full step-by-step.

### `seed_demo_data.py`
Not imported by the app; a manual one-off script (`python seed_demo_data.py`
from `backend/`). Idempotent — skips any employee email that already has
`QALog` rows. Creates 4 demo employees (`sara.ahmed@arcanainfo.com`,
`usman.tariq@arcanainfo.com`, `hina.malik@arcanainfo.com`,
`bilal.raza@arcanainfo.com`, password `Passw0rd1`) with realistic
chat/checklist history spread across the past several days, purely so
Analytics/Employees have non-empty demo data. **Already run** — these
accounts exist in `users.json` and have real `QALog`/`ChatSession`/
`EmployeeProgress` rows as of 2026-07-31.

---

## 2. Full API reference

All routes are mounted with no global prefix except where noted. "Auth"
column: **Public** (no token needed), **Any** (`require_login` — any valid
JWT), **HR** (`require_role("hr")`), **Optional** (`get_optional_user` —
works with or without a token, behaves differently based on which).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/` | Public | Liveness check — `isBackendAlive()` in the frontend. |
| POST | `/auth/signup` | Public | Create an employee account. Body: `{email, password}`. Returns a JWT. |
| POST | `/auth/login` | Public | Body: `{email, password, role}` (`role` = `"employee"` or `"hr"`). Returns a JWT. |
| POST | `/chat` | Optional | Body: `{question, session_id?}`. Non-streaming answer. Persists history + `QALog` only if logged in. |
| POST | `/chat/stream` | Optional | Same body as `/chat`. Returns NDJSON: `{"type":"session",...}` then repeated `{"type":"token",...}` then `{"type":"done",...}`. |
| GET | `/chat/sessions` | Any | List the caller's own chat sessions, newest first. |
| GET | `/chat/sessions/{id}/messages` | Any | Full message list for one of the caller's own sessions. |
| DELETE | `/chat/sessions/{id}` | Any | Delete one of the caller's own sessions (cascades its messages). |
| GET | `/checklist/items` | Any | List all onboarding checklist items. |
| POST | `/checklist/items` | HR | Create a checklist item. Body: `{title, description?, suggested_question?}`. |
| DELETE | `/checklist/items/{id}` | HR | Delete an item (and any progress rows referencing it). |
| GET | `/checklist/progress` | Any | The caller's own completion state per item. |
| POST | `/checklist/progress/{item_id}?completed=bool` | Any | Upsert the caller's completion state for one item. |
| GET | `/employees` | HR | Roster: every employee with `{email, completed_items, total_items}`. |
| GET | `/analytics/summary` | HR | Aggregate usage stats — see `analytics_routes.py` description above. |
| POST | `/upload-documents` | HR | Multipart `files[]`. Extracts, chunks, embeds, updates the registry. Skips already-indexed filenames. |
| DELETE | `/reset-documents` | HR | Wipes `uploads/`, the FAISS index, and the registry. |
| GET | `/indexed-documents` | Public | List currently indexed documents with metadata + total chunk count. |
| DELETE | `/documents/{filename}` | HR | Remove one document's chunks from FAISS, its registry entry, and its uploaded file. |

---

## 3. Database schema (`hr_chatbot.db`, SQLite via SQLAlchemy)

| Table | Columns | Notes |
|---|---|---|
| `chat_sessions` | `id`, `employee_email` (indexed), `title`, `created_at` | One row per conversation. `title` defaults to the first question, truncated to 50 chars. |
| `chat_messages` | `id`, `session_id` (FK → `chat_sessions.id`), `role` (`"user"`\|`"assistant"`), `content`, `source` (assistant-only), `created_at` | Cascade-deletes with its parent session. |
| `qa_logs` | `id`, `employee_email` (indexed), `question`, `answer`, `source`, `created_at` (indexed) | Independent of `chat_messages` — this is what Analytics aggregates over, so its queries don't need to join through sessions. Excludes transient system errors. |
| `checklist_items` | `id`, `title`, `description`, `suggested_question`, `created_at` | `suggested_question` is what gets sent to `/chat` when an employee taps "Ask" next to a task. |
| `employee_progress` | `id`, `employee_email` (indexed), `item_id` (FK → `checklist_items.id`), `completed`, `completed_at` | One row per (employee, item) pair, created on first toggle. |

Employee **auth** (email + bcrypt hash + role) lives outside this database,
in `users.json` — a deliberate design decision, not an oversight (see
`ARCHITECTURE.md` §5).

---

## 4. RAG pipeline (`rag_chain.py`) — step by step

Shared by both `generate_answer()` (returns a dict) and `stream_answer()`
(yields tokens) via a common `_prepare()` function that does everything up
to but not including the actual LLM call.

1. **Meta-question short-circuit.** If the question matches
   `META_QUESTION_KEYWORDS` (e.g. "how many docs do you have", "which
   documents..."), answer directly from `indexed_files.json` — never touches
   vector search, since "what files exist" isn't content inside any
   document.
2. **No-index short-circuit.** If no FAISS index exists yet, return a
   canned "upload documents first" message.
3. **Answer cache check.** Normalized question text (`_normalize_question`
   — lowercased, whitespace-collapsed, trailing punctuation stripped) is
   looked up in an in-process dict cache — **only** when there's no active
   `chat_history` (a context-dependent follow-up must never be served from
   a context-free cache). On hit, skips retrieval and the LLM call entirely.
4. **Retrieval.** Load (or reuse cached) FAISS vector store + a BM25
   retriever built from the same chunks. `similarity_search_with_score(k=8)`
   gets 8 candidates with distance scores.
5. **Hallucination gate #1 — similarity threshold.** If the *best* match's
   distance score is `> 1.2`, reject before calling the LLM at all, with a
   fixed "I'm not designed to help with that" response. This threshold is
   embedding-model-dependent and may need retuning if the embedding model
   ever changes.
6. **Re-ranking (MMR).** `max_marginal_relevance_search(k=4, fetch_k=8)`
   picks a diverse top-4 from the 8 candidates, so the final context isn't
   four near-duplicate chunks all repeating the same sentence.
7. **Hybrid search.** BM25 keyword hits for the same question are folded in
   if their content isn't already present among the MMR results — catches
   exact terms/acronyms embedding similarity sometimes misses. (The
   hallucination gate in step 5 is scored on vector search only, so keyword
   noise can't bypass it.)
8. **Prompt assembly.** Combined chunk contents become the `Context` block;
   a recent-history block (last 6 turns) is included *only* to help
   interpret follow-up questions like "what about IT setup?", with an
   explicit instruction not to treat it as source material. The system
   prompt hard-requires the model to answer only from context or say
   exactly "I'm sorry, I cannot find this information in the uploaded HR
   documents."
9. **Generation.** `generate_answer` calls `llm.invoke()` once;
   `stream_answer` calls `llm.stream()` and yields each token-delta as it
   arrives (`_extract_delta_text` handles Gemini's "thinking" models
   sometimes returning `content` as a list of reasoning/text blocks instead
   of a plain string).
10. **Hallucination gate #2 — groundedness heuristic.** `_groundedness_ratio()`
    computes what fraction of the answer's substantive words (3+ letters,
    minus a stopword list) also appear in the retrieved context. Below
    `0.3`, the answer is swapped for the "not found" fallback — a cheap
    lexical check, not a second LLM call. In the streaming path this can
    only drop the source citation after the fact (tokens are already sent),
    not un-send the text — documented as a known trade-off in the code.
11. **Caching + persistence.** Non-follow-up answers are written back into
    the answer cache. The caller (`chat_routes.py`) persists the exchange
    to `ChatMessage`/`QALog` if the user is authenticated.

**Cache invalidation:** `clear_rag_caches()` resets both the retriever cache
and the answer cache; called from all three mutating endpoints in
`upload_routes.py` so neither can ever serve stale data after a
document upload/delete/reset.

**Quota handling:** any exception containing `RESOURCE_EXHAUSTED` or `429`
is caught and turned into a user-facing "hit today's usage limit" message
instead of a raw stack trace, tagged `source: "System Error"` so it's
excluded from Analytics.

---

## 5. Document processing pipeline (`chunking-embedding/`)

Imported into `backend/` via `sys.path.append()` (not a normal package
import — the folder name has a hyphen, which Python can't import directly).

- **`pdf_processor.py`** — `pdfplumber`, page-by-page text extraction,
  joined with `\n\n`.
- **`markdown_processor.py`** — raw UTF-8 read, no cleaning (heading markers
  must survive intact for the header-aware splitter downstream).
- **`image_processor.py`** — OCR via `pytesseract` (needs the Tesseract
  binary installed separately, path hardcoded at
  `C:\Program Files\Tesseract-OCR\tesseract.exe`). As of 2026-07-31, includes
  a `_preprocess()` step before OCR: grayscale → invert if the image reads
  dark-background-on-average (mean pixel value < 128) → autocontrast →
  upscale to ≥1200px on the long edge via LANCZOS resampling if smaller,
  plus `--oem 3 --psm 6` Tesseract config. This fixed real garbling
  (verified before/after on a dark-background UI mockup: `"BD ARCANA HR AS"`
  → `"ARCANA HR ASSISTANT"`, missing form fields → captured) without
  regressing light-background screenshots.
- **`chunking.py`** — `CHUNK_SIZE=1000`, `CHUNK_OVERLAP=150`. Plain text
  (PDF/OCR output) uses `RecursiveCharacterTextSplitter` with separator
  priority `["\n\n", "\n", ". ", " ", ""]`. Markdown first splits on `#`/`##`/`###`
  headers via `MarkdownHeaderTextSplitter`, then any oversized section is
  re-split with the same character splitter — so `metadata["source"]`
  always maps a chunk back to its originating file.
- **`embeddings.py`** — `models/gemini-embedding-001` (must exactly match
  the embedding model in `rag_chain.py`, or vector spaces won't align —
  a prior model, `text-embedding-004`, was shut down by Google in Jan 2026).
  `create_or_update_index()` creates a new FAISS index or appends to the
  existing one. `delete_document_from_index()` relies on
  `vector_store.docstore._dict` internals (no public delete-by-metadata API
  in this langchain-community version) to find and remove all chunks for a
  given filename. `count_total_chunks()` powers the Documents tab's "Chunks
  Indexed" stat.

---

## 6. Frontend (`frontend/`, React 18 + Vite + Tailwind)

### Routing (`App.jsx`)
No router library — a simple three-way switch on auth state: no user →
`LoginPage`; `user.role === "hr"` → `AdminPage`; otherwise → `ChatPage`.
`apiClient.getStoredUser()` seeds initial state from the JWT already in
`localStorage` so a page refresh doesn't drop a logged-in user back to the
login screen.

### `lib/apiClient.js`
One function per backend route (see §2's table for the exact mapping). JWT
is held in module state, initialized from and persisted to `localStorage`
under key `arch_auth_token`. All HR-only calls attach
`Authorization: Bearer <token>` automatically via `authHeaders()`.

### Employee-facing (`ChatPage.jsx`)
Two views toggled by local state: `'chat'` and `'checklist'`.
- **Chat**: streams answers via `apiClient.streamMessage()` (reads
  `res.body.getReader()`, appends token deltas to a placeholder message),
  loads/switches/deletes sessions via the `/chat/sessions` endpoints
  (rendered in `Sidebar.jsx`), supports downloading the current transcript
  as a `.txt` file, and a local (UI-only) dark-mode toggle.
- **Checklist**: `OnboardingChecklist.jsx` — real backend-backed (not
  localStorage), lets an employee tap "Ask" next to any incomplete task to
  jump into Chat with that task's `suggested_question` pre-submitted.

### HR-facing (`AdminPage.jsx`)
Four tabs, each its own component:
1. **`DocumentsTab.jsx`** — drag-and-drop or browse upload, indexed-file
   table with search/pagination/delete, "Reset All Documents" (with a
   confirm modal), stat cards (total documents, chunks indexed, questions
   answered).
2. **`AnalyticsTab.jsx`** — Recharts bar charts driven by
   `GET /analytics/summary`.
3. **`EmployeesTab.jsx`** — roster table (`GET /employees`) with a progress
   bar per employee and stat cards (total employees, fully onboarded count).
4. **`ChecklistTab.jsx`** — added 2026-07-31. Add-task form (title required,
   description/suggested-question optional) + a table of existing items
   with delete (confirm-modal gated), stat cards (total tasks, tasks with a
   suggested question). This closed the previous gap where
   `POST/DELETE /checklist/items` existed on the backend with no frontend
   caller at all.

### Shared components
`ConfirmModal.jsx` (generic destructive-action confirmation, reused by
Documents/Employees/Checklist tabs and logout), `StatCard.jsx` (animated
count-up number tile), `ChatMessage.jsx` (renders markdown via
`react-markdown`), `TypingIndicator.jsx`.

---

## 7. Environment variables (`backend/.env`)

| Variable | Used by | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | `rag_chain.py`, `chunking-embedding/embeddings.py` | Google Generative AI API key — required, raises at import time if missing. |
| `JWT_SECRET` | `auth.py` | HMAC signing secret for issued JWTs — required, raises at import time if missing. |
| `FAISS_INDEX_PATH` | (present in `.env` but the actual path is hardcoded as `"faiss_index"` / `"./faiss_index"` in code — the env var isn't currently read anywhere) | — |
| `HR_EMAIL` | `auth.py` | The single HR account's login email. |
| `HR_PASSWORD_HASH` | `auth.py` | bcrypt hash of the HR account's password (not the plaintext). |
| `HOST`, `PORT` | intended for `uvicorn` startup config | Not read anywhere in the current code — `uvicorn main:app` is run directly with CLI flags/defaults instead. |

**Gotcha:** `chunking-embedding/embeddings.py` loads its `.env` via
`load_dotenv(find_dotenv(usecwd=True))` specifically because
`chunking-embedding/` is a *sibling* of `backend/`, not an ancestor —
`find_dotenv()`'s default directory-walk (from the calling file's own
location) would never reach `backend/.env` otherwise. This only breaks when
launched plainly (`uvicorn main:app`); running under a debugger can mask the
bug because `python-dotenv` falls back to cwd whenever `sys.gettrace()` is
set.

---

## 8. Feature completion status (as of 2026-07-31)

| Feature | Status |
|---|---|
| Employee signup/login, HR login | ✅ Real, working |
| Document upload/delete/reset (PDF/MD/PNG/JPG/JPEG) | ✅ Real, working |
| RAG chat with hallucination controls | ✅ Real — MMR re-ranking, hybrid BM25+vector search, groundedness heuristic, similarity threshold gate |
| Multi-turn conversation memory | ✅ Real — last 6 turns passed for follow-up interpretation |
| Streaming responses | ✅ Real — `/chat/stream`, NDJSON |
| Answer caching | ✅ Real — in-process, exact-match only (no semantic caching) |
| Per-employee chat history | ✅ Real — backend-persisted, sidebar UI |
| Onboarding checklist (employee view + progress) | ✅ Real — backend-persisted, replaced an earlier localStorage-only version |
| Onboarding checklist (HR management: add/delete tasks) | ✅ Real — `ChecklistTab.jsx`, added 2026-07-31 |
| Analytics dashboard | ✅ Real — real charts (Recharts), backed by `QALog` |
| Employees roster tab | ✅ Real — roster + per-employee checklist completion % |
| Demo data seeding | ✅ Done — `seed_demo_data.py` has been run; 4 demo employees with realistic history exist |
| OCR quality (image uploads) | ✅ Fixed 2026-07-31 — preprocessing added, verified before/after |
| Gemini quota / billing decision | ⚠️ Verified but unresolved — free tier is 20 requests/day for `gemini-3.5-flash`, confirmed exhausted via a live 429 on 2026-07-31; no decision yet on waiting vs. switching models vs. enabling billing |
| pytest test suite | ❌ Not built |
| Docker | ❌ Not built |
| Deployment (Render/Railway/Vercel etc.) | ❌ Not done — dev-only right now |
| HR viewing individual employees' raw chat transcripts | ❌ Open product decision, currently leaning aggregate-only (Analytics) for privacy |

**Important note on `project_status.md` (repo root):** that file has
historically described a mix of real and aspirational state and should not
be trusted at face value — this document (`SPECS.md`) reflects direct code
inspection as of 2026-07-31 and supersedes it for anything the two disagree
on.
