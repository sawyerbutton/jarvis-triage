#!/usr/bin/env bash
set -euo pipefail

RELAY="${RELAY:-http://localhost:8080}"

push() {
  curl -s -X POST "$RELAY/push" -H 'Content-Type: application/json' -d "$1"
}

echo "============================================"
echo "  Jarvis Triage — End-to-End Demo"
echo "  Pushing payloads to $RELAY"
echo "============================================"
echo ""

echo "[1/3] L1 Notification: CI build passed"
push '{
  "level": 1,
  "title": "CI Build Result",
  "source": "github-actions",
  "hudLines": ["[OK] CI Build #42 passed -- all 156 tests green"]
}'
sleep 6

echo "[2/3] L2 Quick Decision: Deploy target"
push '{
  "level": 2,
  "title": "Deploy Target",
  "source": "deploy-bot",
  "decisions": [{
    "question": "Deploy to which environment?",
    "options": [
      {"label": "Staging", "description": "Deploy to staging for QA review"},
      {"label": "Production", "description": "Deploy directly to production"}
    ]
  }]
}'
echo "      -> Select an option in the simulator, then press Enter here to continue..."
read -r

echo "[3/3] L4 Plan Approval: JWT Auth Migration"
push '{
  "level": 4,
  "title": "JWT Auth Migration Plan",
  "source": "claude-code",
  "summary": "Migrate session auth to JWT. 7 steps: install deps -> JWT middleware -> login endpoint -> data migration -> frontend -> cleanup -> tests.",
  "decisions": [
    {
      "question": "Token storage strategy",
      "options": [
        {"label": "HttpOnly Cookie", "description": "Secure against XSS, requires CORS config"},
        {"label": "LocalStorage", "description": "Simple implementation, XSS risk"}
      ]
    },
    {
      "question": "Token refresh strategy",
      "options": [
        {"label": "Rotation", "description": "New token pair on each refresh, more secure"},
        {"label": "Silent Refresh", "description": "Background refresh, simpler implementation"}
      ]
    }
  ],
  "risks": ["Step 4: data migration is irreversible -- backup database first"]
}'
echo "      -> Walk through the approval flow in the simulator"

echo ""
echo "Demo complete! All 3 payloads delivered."
