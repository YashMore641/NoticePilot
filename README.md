# NoticePilot — Never Miss a College Deadline

**Your college life, organized.** NoticePilot turns unstructured college notices (pasted text or text-based PDFs) into evidence-backed deadlines, action items, tasks, and answers.

> **Platform note:** The original brief suggested Vite + FastAPI + SQLite. This implementation delivers the identical product, API shape and workflow as a unified **Next.js (App Router) + PostgreSQL (Drizzle ORM)** full-stack app — one codebase, one server, same REST endpoints (`/api/notices/analyze`, `/api/notices/upload`, `/api/notices/{id}/ask`, `/api/tasks`, `/api/dashboard/stats`, …). PDF text extraction uses `unpdf` (PDF.js) instead of PyMuPDF, and structured-output validation mirrors the Pydantic schema rules in TypeScript.

## Problem
Students receive exam forms, scholarship calls, assignment briefs and circulars via PDFs, WhatsApp and notice boards — and miss deadlines buried in dense text.

## Key features
- **Notice analyzer** — paste text or upload a text-based PDF (≤8 MB, validated). Friendly progress states; input is preserved on failure. Scanned PDFs get a clear “OCR not supported yet — paste the text” message.
- **Evidence-backed extraction** — title, summary, category, issuer, chronological important dates (with original wording + evidence quotes), eligibility, required documents, action items, and explicit *missing information*. Ambiguous/year-less dates become **“Date not confirmed” (null)** — never invented.
- **AI + local engine** — if `GEMINI_API_KEY` is set on the server, notices are analysed with Gemini (`gemini-2.0-flash` by default) using structured JSON output, then validated/coerced. Without a key (or on any Gemini error/quota issue), a deterministic local extractor takes over so the app always works end-to-end; the UI labels which engine ran.
- **Tasks** — create from extracted actions (duplicate-safe, 409), add custom tasks, edit, complete, delete, filter by status/priority/search, sort by due date, overdue shown separately. Tasks without a confirmed date stay dateless.
- **My Notices** — search title/content, filter by category, view details, view linked tasks, delete with confirmation.
- **Ask about a notice** — Q&A grounded only in the selected notice (deadline, documents, eligibility, first step, fees, issuer + keyword fallback). If it isn't stated, NoticePilot says so and cites the source sentence.
- **Dashboard** — greeting, live stats computed from stored data (notices, pending/completed tasks, 30-day deadlines, overdue), upcoming deadlines, recent notices, quick actions.
- **Demo sample** — the fictional “Trinity College — Examination Department” notice is built into the analyzer (clearly labelled fictional). Its 15 Oct 2026, 5:00 PM deadline, verification step and payment-issue instruction are extracted; no late fee or extra documents are invented.

## Architecture & request flow
```
Browser (React client, sidebar SPA)
  → POST /api/notices/analyze  {text}            ┐
  → POST /api/notices/upload   multipart PDF     ├→ analyzer (Gemini → validate → local fallback)
  → GET/DELETE /api/notices, /api/notices/{id}   │      → PostgreSQL (notices.analysis JSONB, raw text)
  → POST /api/notices/{id}/ask {question}        │      → notice-grounded answer + source quote
  → GET/POST/PATCH/DELETE /api/tasks             │
  → GET /api/dashboard/stats                     ┘
```
Notice text is treated strictly as untrusted data in the AI prompt; API keys live only in server env vars; uploads are type/size/magic-byte validated and never executed.

## Tech stack
Next.js 16 · React 19 · Tailwind CSS 4 · Lucide icons · Drizzle ORM · PostgreSQL · unpdf (PDF text extraction) · Gemini REST API (optional).

## Run locally (Windows 11 / macOS / Linux)
Prerequisites: Node.js 20+, a PostgreSQL database.
```bash
npm install
cp .env.example .env        # set DATABASE_URL; optionally GEMINI_API_KEY
npx drizzle-kit push        # create tables
npm run dev                 # http://localhost:3000
npm run build && npm start  # production
```

## Gemini configuration
Create a key in Google AI Studio, then set in `.env` (server-only, never `NEXT_PUBLIC_`):
```
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.0-flash   # optional
```
Restart the server. The Settings page shows which engine is active.

## Tests
See `tests/` — `tests/smoke.sh` exercises the live API end-to-end (analyze → task → complete → ask → delete) with the fictional sample and asserts the 2026-10-15 deadline, evidence, duplicate-task 409 and “not specified” answers. Heuristic unit expectations (ambiguous dates → null, no invented documents/fees) are documented in `tests/README.md`.

## Known limitations
- Scanned/image PDFs: OCR is not supported yet — the app detects empty extraction and asks you to paste the text.
- Without a Gemini key, extraction is heuristic (sentence/keyword-based) — accurate for clearly-written notices, less nuanced for complex layouts/tables.
- Single-user local app: no accounts/auth, reminders are in-app only (no email/push yet).
- Always verify extracted information against the original official notice.
