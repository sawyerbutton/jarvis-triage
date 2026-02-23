#!/usr/bin/env bash
set -euo pipefail

RELAY="${RELAY:-http://localhost:8080}"

push() {
  curl -s -X POST "$RELAY/push" -H 'Content-Type: application/json' -d "$1"
}

# ── Intro ────────────────────────────────────────────────────
echo "============================================"
echo "  Jarvis Triage — Auto-Triage Demo"
echo "  Relay: $RELAY"
echo "============================================"
echo ""
echo "Auto-triage hook active. Watching for events..."
echo "No manual trigger needed. Events will appear on your glasses automatically."
echo ""
sleep 5

# ── Event 1: GitHub Webhook (L1) ─────────────────────────────
echo "[$(date +%H:%M:%S)] Incoming: GitHub Actions webhook"
sleep 1
echo "  -> Level 1 (Notification)"
echo "  -> Pushing to HUD..."
push '{
  "level": 1,
  "title": "PR Merged",
  "source": "github",
  "hudLines": ["[OK] PR #87 merged -- 3 files, +42 -17"]
}'
echo ""
echo "  Delivered."
echo ""
sleep 7

# ── Event 2: Slack Mention (L2) ──────────────────────────────
echo "[$(date +%H:%M:%S)] Incoming: Slack mention in #deployments"
sleep 1
echo "  -> Level 2 (Quick Decision)"
echo "  -> Pushing to HUD..."
push '{
  "level": 2,
  "title": "Scale Replicas",
  "source": "slack-bot",
  "decisions": [{
    "question": "Scale up replicas?",
    "options": [
      {"label": "3 pods", "description": "Keep current capacity"},
      {"label": "5 pods", "description": "Moderate scale-up for traffic spike"},
      {"label": "10 pods", "description": "Full scale-up for peak load"}
    ]
  }]
}'
echo ""
echo "  Delivered."
echo ""
sleep 13

# ── Event 3: Claude Code Plan (L4) ──────────────────────────
echo "[$(date +%H:%M:%S)] Incoming: Claude Code plan output (47 lines)"
sleep 1
echo "  -> Level 4 (Plan Review)"
echo "  -> Pushing to HUD..."
push '{
  "level": 4,
  "title": "DB Schema Migration",
  "source": "claude-code",
  "summary": "Add audit_log table + index user_events. 5 steps: create table -> add indexes -> backfill -> validate -> drop legacy columns.",
  "decisions": [
    {
      "question": "Backfill strategy",
      "options": [
        {"label": "Batch (offline)", "description": "Faster, requires maintenance window"},
        {"label": "Stream (online)", "description": "Zero downtime, takes longer"}
      ]
    },
    {
      "question": "Legacy column cleanup",
      "options": [
        {"label": "Drop now", "description": "Clean schema, requires all clients updated"},
        {"label": "Deprecate first", "description": "Keep 30 days, add NOT_USED prefix"}
      ]
    }
  ],
  "risks": ["Backfill on 2M+ rows -- test on staging replica first"]
}'
echo ""
echo "  Delivered."
echo ""

# ── Done ──────────────────────────────────────────────────────
echo "============================================"
echo "  Auto-triage demo complete."
echo "  3 events processed: L1, L2, L4"
echo "============================================"
