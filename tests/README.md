# NoticePilot tests

## Run
Start the app (`npm run dev` or `npm start`), then:
```bash
BASE=http://localhost:3000 bash tests/smoke.sh
```

## Coverage (smoke.sh, mocked-AI-free, works with the local extractor)
- API health check
- Notice analysis of the fictional Trinity College sample → asserts `2026-10-15` deadline extraction with evidence
- Empty-notice validation → friendly 400 (input preserved client-side)
- Task creation from an analysis action → duplicate creation returns **409**
- Grounded Q&A → "Which documents do I need?" answers *"does not specify"* instead of inventing documents
- Dashboard stats computed from stored rows
- Notice deletion

## Unit expectations for `src/lib/analyzer.ts` (verified via smoke + manual QA)
| Case | Expected |
|---|---|
| `by 15 October 2026 at 5:00 PM` | date `2026-10-15`, time kept, urgency high, evidence = source sentence |
| `submit by 15 October` (no year) | `date: null`, `date_text` preserved → UI shows "Date not confirmed" |
| "Required documents: The notice does not specify…" | `required_documents: []`, flagged in `missing_information` |
| No late-fee mention in sample | No fee/late item invented; listed under missing information |
| Scanned PDF (no text layer) | Upload → 422 with OCR guidance, nothing saved |
| Non-PDF / >8 MB upload | Friendly 400, file not stored |
