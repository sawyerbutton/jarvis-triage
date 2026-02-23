#!/usr/bin/env bash
set -euo pipefail

RELAY="${RELAY:-http://localhost:8080}"

# ── Helpers ──────────────────────────────────────────────────
slow_print() {
  while IFS= read -r line; do
    echo "$line"
    sleep 0.08
  done <<< "$1"
}

divider() {
  echo ""
  echo "--------------------------------------------"
  echo ""
}

push() {
  curl -s -X POST "$RELAY/push" -H 'Content-Type: application/json' -d "$1"
}

# ── Intro ────────────────────────────────────────────────────
echo "============================================"
echo "  Jarvis Triage — AI Backend Pipeline Demo"
echo "  Relay: $RELAY"
echo "============================================"
echo ""
echo "This demo simulates the full AI-to-HUD pipeline:"
echo "  Claude Code output -> Triage engine -> Payload -> Relay -> Glasses"
echo ""
sleep 2

# ── Scene 1: Raw AI Plan Output ─────────────────────────────
echo "[Scene 1] Claude Code emits a plan..."
echo ""
slow_print "  Plan: Migrate user auth from Session to JWT

  1. Install jsonwebtoken + bcryptjs
  2. Create JWT middleware (middleware/auth.js)
     Decision needed: Token storage -- HttpOnly Cookie vs LocalStorage
  3. Rewrite login endpoint (routes/auth.js)
     Decision needed: Refresh strategy -- Rotation vs Silent Refresh
  4. Data migration script
     WARNING: Irreversible -- backup database first
  5. Update frontend token handling
  6. Remove deprecated session code
  7. Write integration tests"

divider
sleep 2

# ── Scene 2: Triage Engine Analysis ─────────────────────────
echo "[Scene 2] Triage engine analyzing..."
sleep 1
echo "  Scanning for decision points..."
sleep 0.8
echo "  Scanning for risk markers..."
sleep 0.8
echo ""
echo "  Result:"
echo "    Level:     4 (Plan Review)"
echo "    Decisions: 2"
echo "    Risks:     1"
echo "    Summary:   compressed to 4-line HUD format"

divider
sleep 2

# ── Scene 3: Generated Payload ───────────────────────────────
echo "[Scene 3] Generated TriagePayload:"
echo ""

PAYLOAD='{
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

echo "$PAYLOAD" | python3 -m json.tool 2>/dev/null || echo "$PAYLOAD"

divider
sleep 2

# ── Scene 4: Deliver to Relay ────────────────────────────────
echo "[Scene 4] Delivering payload to relay..."
echo ""
echo "  POST $RELAY/push"
sleep 1
push "$PAYLOAD"
echo ""
echo ""
echo "  Payload delivered. Check your glasses."
echo ""
echo "============================================"
echo "  Pipeline complete."
echo "============================================"
