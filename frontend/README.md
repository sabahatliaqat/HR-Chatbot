# Arcana HR Assistant — React Frontend

Converted from the Stitch-exported HTML into a real, runnable React app
(Vite + Tailwind), with fixes applied and wired to the real backend.

## Setup

```
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:5173`. Make sure the FastAPI backend is running
first (`uvicorn main:app --reload` inside `backend/`) — the chat screen
calls it directly at `http://127.0.0.1:8000`.

## What's real vs. still a stub

**Actually wired and working:**
- Chat screen (`ChatPage.jsx`) calls the real `/chat` endpoint — type a
  question, get a real answer from your backend, with the source chip.
- Admin dashboard (`AdminPage.jsx`) — real drag-and-drop upload to
  `/upload-documents`, real document list from the new `/indexed-documents`
  endpoint, real "Reset All Documents" wired to `/reset-documents`. HR
  Admin login routes here automatically (`App.jsx` checks `user.role`).
- Backend-down detection (disables input, shows a message) — same as the
  Streamlit UI had.
- Dark mode toggle is functional (adds/removes a `dark` class on `<html>`;
  Tailwind's `darkMode: 'class'` is already configured, but dark-variant
  styles haven't been added to every element yet — the toggle works, the
  full dark palette still needs filling in).
- "New Chat" clears the on-screen conversation.

**Still stubs — need backend work first:**
- `loginRequest()` in `src/lib/apiClient.js` doesn't call a real endpoint
  yet, because `/auth/login` and `/auth/signup` don't exist on the backend
  yet (that's Phase 1 in `roadmap.md`). Right now it just resolves locally
  so the login → chat/admin flow can be built and clicked through. Once
  the auth endpoints exist, replace the body of `loginRequest()` with a
  real `fetch()` call and store the returned JWT.
- The sidebar's "Recent" conversation list (`Sidebar.jsx`) is static
  placeholder data — the backend doesn't have a multi-thread conversation
  concept yet (each `/chat` call is stateless, no history saved
  server-side). Wire this once that exists.
- Admin dashboard's "Chunks Indexed" and "Questions Answered" stat cards
  intentionally show "—" instead of a fake number — the backend doesn't
  track either yet. Questions Answered needs the Phase 3 logging work;
  Chunks Indexed needs a small stats endpoint.
- Admin dashboard's "Analytics" and "Employees" nav tabs are visible but
  inert (`cursor-not-allowed`) — no pages exist for them yet.
- Per-file delete isn't in the document table — the backend can only
  reset *all* documents at once (`/reset-documents`), there's no
  single-file delete endpoint yet.

## Changes made from the raw Stitch export

- **Fixed:** replaced the Stitch preview image URLs
  (`lh3.googleusercontent.com/aida-public/...`) with a simple icon-based
  `BrandMark` component — those URLs belong to the Stitch session and
  aren't guaranteed to stay reachable in a real deployment.
- **Removed:** social login icons (Facebook/Google+/LinkedIn) from both
  Sign In and Sign Up — not relevant for an internal company tool where
  employees use their company email.
- **Removed:** the `attach_file` button in the chat input — the backend
  doesn't support file attachments inside a chat message (document upload
  is a separate HR-only flow), so a non-functional button was misleading.
- **Removed:** the hardcoded demo conversation ("Q3 WFH policy...", "Would
  you like me to initiate a request form for you?") — that was Stitch's
  invented placeholder content. Replaced with a real greeting message and
  actual live chat wired to your backend.
- **Converted:** the vanilla-JS sliding panel logic (`classList.toggle`)
  into React state (`isSignUp`), and the toggle buttons into controlled
  components.
- **Added animations** (see `index.css`, marked `NEW`):
  - Source citation chip fades in ~250ms after the message text, so it
    feels "attached" once the answer has formed, rather than appearing
    instantly with everything else.
  - Sidebar conversation list items stagger in on load (60ms apart each)
    instead of all appearing at once.
- **Added:** auto-scroll to the latest message when the conversation
  updates (a functional touch the original static HTML couldn't have).

## Admin dashboard — changes from the raw Stitch export

- **Fixed a real functional bug:** the upload zone said "Supported
  formats: PDF, DOCX, TXT" — but the backend only accepts
  `.pdf, .md, .png, .jpg, .jpeg` (see `ALLOWED_EXTENSIONS` in
  `upload_routes.py`). Corrected the copy and the file input's `accept`
  attribute to match what the backend actually supports.
- **Replaced the fake document table** (hardcoded 2024 dates, file sizes,
  "Indexed"/"Processing" statuses) — the backend doesn't return any of
  that per file, only filenames. The table now shows real filenames from
  a new `GET /indexed-documents` endpoint, with search and pagination
  that work over the real list.
- **Replaced the fake stat numbers** (142 documents, 3,856 chunks, 892
  questions) — "Total Documents" is now a real count with a genuine
  count-up animation; the other two show "—" with a note on what backend
  work they need, instead of an impressive-looking made-up number.
- **Removed per-row delete buttons** — they didn't correspond to any real
  backend capability (only whole-index reset exists). A misleading button
  that silently does nothing is worse than no button.
- **Wired drag-and-drop and "Browse Files"** to the real
  `/upload-documents` endpoint, and "Reset All Documents" to the real
  `/reset-documents` endpoint (with the confirmation modal preserved).
- Replaced the ephemeral Stitch logo image URL the same way as the login
  screen.

## New backend endpoint added

`GET /indexed-documents` — the `indexed_files.json` registry already
existed server-side (from the duplicate-upload fix) but was never exposed
to the frontend. Added a small read-only endpoint so the Admin dashboard
(and, if useful later, the Streamlit UI) can show real document counts on
page load instead of only session-local counts. Documented in
`docs/api_contract.md`.

## Design tokens

`tailwind.config.js` has the full color/spacing/type scale pulled from
both Stitch exports (they matched, so there was one source of truth to
merge from). If you regenerate more screens in Stitch, keep using this
same purple/Material-3-style palette so everything stays visually
consistent — or tell me and I'll merge in whatever changes.
