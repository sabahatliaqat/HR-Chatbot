# Setup Guide — Arch Assistant (HR Chatbot)

Follow these steps in order. Everything you need to install is listed below —
if a step fails with "command not found", install that prerequisite first.

## 1. Prerequisites (install these first)

| Tool | Version used | Check with |
|---|---|---|
| Python | 3.11+ (project built on 3.13) | `python --version` |
| Node.js | 18+ (project built on 24) | `node --version` |
| npm | comes with Node | `npm --version` |
| Git | any recent | `git --version` |
| Tesseract OCR | any recent | see note below |

**Tesseract OCR (required for scanning uploaded images/screenshots):**
Download and install from
https://github.com/UB-Mannheim/tesseract/wiki (Windows installer).
Install it to the default path `C:\Program Files\Tesseract-OCR\tesseract.exe`
— the code points at that exact path
(`chunking-embedding/image_processor.py`). If you install it somewhere else,
edit that path in the file.## 2. Download the project

GitHub repo: https://github.com/ALI-Z-Ather/Internship-Project

**Option A — git clone (recommended):**

```
git clone https://github.com/ALI-Z-Ather/Internship-Project.git
cd Internship-Project
```

**Option B — download ZIP (no Git needed):**
Open the repo link above → green **Code** button → **Download ZIP** →
extract it anywhere → open a terminal inside the extracted folder.

## 3. What's on GitHub vs. what you must create yourself

The repo only has source code. A few things are intentionally left out
(secrets, and files that get generated automatically) — you must create
these yourself after downloading:

| Not on GitHub | What to do |
|---|---|
| `backend/.env` | Create it yourself — see step 4 below for the exact contents |
| `backend/venv/`, `frontend/node_modules/` | Created automatically when you run `pip install` / `npm install` below |
| `backend/hr_chatbot.db`, `backend/users.json`, `backend/indexed_files.json` | Created automatically the first time you run the backend — nothing to do |
| `backend/faiss_index/` | Created automatically the first time you (as HR) upload a document |
| `backend/uploads/` (actual PDF/image files) | Not included — upload your own HR documents from the Admin dashboard once the app is running |
| Tesseract OCR binary | Must be installed on your OS separately (not part of the repo) — see step 1 above |

Nothing else needs manual setup — all real source code (backend, frontend,
chunking-embedding) is in the repo.

## 4. Backend setup (Python)

```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create a file named `.env` inside `backend/` (it is git-ignored, so you must
make your own) with:

```
GEMINI_API_KEY=your_google_gemini_api_key
FAISS_INDEX_PATH=faiss_index
JWT_SECRET=any_random_long_string
HR_EMAIL=hr@yourcompany.com
HR_PASSWORD_HASH=
HOST=127.0.0.1
PORT=8000
```

- Get a free `GEMINI_API_KEY` from https://aistudio.google.com/apikey.
- `JWT_SECRET` can be any random string (e.g. run
  `python -c "import secrets; print(secrets.token_hex(32))"`).
- `HR_PASSWORD_HASH` is a bcrypt hash of the HR login password, not the raw
  password. Generate it (with the venv still active) with:
  ```
  python -c "from auth import hash_password; print(hash_password('your_hr_password'))"
  ```
  Paste the output into `HR_PASSWORD_HASH`.

Run the backend (keep this terminal open):

```
uvicorn main:app --reload
```

It starts at `http://127.0.0.1:8000`. Check `http://127.0.0.1:8000/docs` opens.

## 5. Frontend setup (React — main UI)

Open a **new** terminal:

```
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:5173`. The backend must already be running
(step 3) — the chat screen calls `http://127.0.0.1:8000` directly.

## Run order every time (after first-time setup above)

```
# Terminal 1 — backend
cd backend
venv\Scripts\activate
uvicorn main:app --reload

# Terminal 2 — frontend
cd frontend
npm run dev
```

Then open `http://localhost:5173` in your browser.

## Notes

- First run creates `hr_chatbot.db`, `users.json`, `indexed_files.json`,
  and `faiss_index/` automatically inside `backend/` — don't worry if
  they're missing at first.
- If PDF/image upload fails, double check Tesseract is installed at the
  exact path above.
- Free-tier Gemini API keys have a low daily request quota — if you get a
  quota error, wait for the daily reset or check
  https://aistudio.google.com/ usage dashboard.
