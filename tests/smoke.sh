#!/usr/bin/env bash
# End-to-end smoke test against a running NoticePilot server (no Gemini key needed).
# Usage: BASE=http://localhost:3000 bash tests/smoke.sh
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
echo "→ Health"; curl -fs "$BASE/api/health" >/dev/null

echo "→ Analyze fictional sample notice"
RESP=$(curl -fs -X POST "$BASE/api/notices/analyze" -H 'Content-Type: application/json' -d '{"text":"TRINITY COLLEGE — EXAMINATION DEPARTMENT\n\nNotice: Semester Examination Form Submission\n\nAll eligible students must submit their semester examination forms online by 15 October 2026 at 5:00 PM.\n\nStudents must verify their personal details before submission and contact the examination department if they encounter payment issues.\n\nRequired documents: The notice does not specify additional documents.\n\nLate submission: No information about late submission is provided.\n\nStudents should refer to the official examination portal for the submission procedure."}')
echo "$RESP" | grep -q "2026-10-15" || { echo "FAIL: deadline 2026-10-15 not extracted"; exit 1; }
ID=$(echo "$RESP" | sed -n 's/.*"id":\([0-9]*\).*/\1/p' | head -1)

echo "→ Empty text is rejected (400, friendly error)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/notices/analyze" -H 'Content-Type: application/json' -d '{"text":""}')
[ "$CODE" = "400" ] || { echo "FAIL: expected 400, got $CODE"; exit 1; }

echo "→ Create task from analysis + duplicate guard (409)"
curl -fs -X POST "$BASE/api/tasks" -H 'Content-Type: application/json' -d "{\"title\":\"Submit examination form\",\"noticeId\":$ID,\"dueDate\":\"2026-10-15\",\"priority\":\"high\"}" >/dev/null
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/tasks" -H 'Content-Type: application/json' -d "{\"title\":\"Submit examination form\",\"noticeId\":$ID}")
[ "$CODE" = "409" ] || { echo "FAIL: expected duplicate 409, got $CODE"; exit 1; }

echo "→ Ask: documents must be answered as 'not specified', never invented"
curl -fs -X POST "$BASE/api/notices/$ID/ask" -H 'Content-Type: application/json' -d '{"question":"Which documents do I need?"}' | grep -qi "does not specify" || { echo "FAIL: documents answer should say not specified"; exit 1; }

echo "→ Dashboard stats reflect stored data"
curl -fs "$BASE/api/dashboard/stats" | grep -q '"totalNotices"' || { echo "FAIL: stats"; exit 1; }

echo "→ Delete notice"
curl -fs -X DELETE "$BASE/api/notices/$ID" >/dev/null
echo "ALL SMOKE TESTS PASSED"
