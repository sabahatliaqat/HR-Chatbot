**Gemini free-tier quota exhaustion**, hit repeatedly during testing:
   - `gemini-3.5-flash`: confirmed 20 requests/day free tier limit
   - `gemini-3-flash`: also hit a `RESOURCE_EXHAUSTED` error during
     testing, contradicting general web reports of a much higher (~1500
     RPD) free quota — those numbers are unverified for this specific
     account/key
   - Not a code bug. The account's *actual* current quota per model has
     not yet been checked via Google AI Studio's Usage/Rate Limits
     dashboard (`aistudio.google.com`) — general web articles should not
     be trusted for this project going forward, only the live dashboard
   - Longer-term options not yet decided: wait for daily reset, or
     enable billing on the Google Cloud project (removes free-tier caps)

3. **File-sync risk during the frontend/backend merge.** The React
   frontend was originally a standalone project and has recently been
   copied into the real project folder alongside a round of new backend
   files (auth, database, chat history, analytics, checklist routes).
   This project has a *recurring pattern* of individual files being
   missed during copy-over, causing `ImportError`/`ModuleNotFoundError`
   at startup. Worth a full file-by-file diff/sync check before trusting
   the current state is fully consistent.
#remainaing task 

database.py is prepared but setup database and set all things 
- [ ] Verify actual per-model Gemini quota via the AI Studio dashboard;
      decide model choice / billing strategy going forward
- [ ] Full sync check: confirm every backend file in the real project
      folder matches the latest version (no stale copies)
- [ ] Real Analytics charts (a proper chart library — Recharts was the
      prior recommendation) — current Analytics tab has real numbers
      but only simple text/bar rows, no chart component
- [ ] Multi-turn conversation memory — pass the last few exchanges from
      `chat_messages` into the RAG prompt (natural extension now that
      real chat history exists)
- [ ] Streaming responses (token-by-token, ChatGPT-style)
- [ ] RAG quality improvements, roughly in priority order:
      1. Re-ranking retrieved chunks (cheap, do first)
      2. A lightweight groundedness self-check before answering
      3. Hybrid keyword + vector search (bigger effort)
      4. Semantic caching for repeated questions (bigger effort)
- [ ] Unit tests (pytest) for the backend
- [ ] General request logging beyond `qa_logs`
- [ ] Docker containerization
- [ ] Deployment (backend: Render/Railway; frontend: Vercel)
- [ ] Open product decision, not yet made: should HR be able to see
      individual employees' raw chat transcripts, or only aggregate
      patterns (most-asked questions, most-cited documents)? Currently
      leaning toward aggregate-only for privacy — needs a final call
      before any HR-facing "view employee chats" feature is built

## Next Immediate Step

The project was being actively debugged when this handover happened —
the image-upload 500 error is the live blocker. The first thing to ask
the new environment to do:

> "Help me get the real Python traceback for a 500 error on
> `POST /upload-documents` when uploading a PNG/JPG file — the uvicorn
> access log only shows `500`, no detail. Walk me through capturing the
> actual exception (either from the backend terminal directly, or by
> checking why the frontend's error-detail passthrough isn't surfacing
> it), then fix the root cause once we see it."

This is deliberately diagnostic-first rather than jumping to a fix,
since multiple guessed fixes for this exact symptom (Tesseract path,
terminal-not-restarted) have already been tried without confirming the
actual cause.