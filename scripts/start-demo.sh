#!/usr/bin/env bash
set -euo pipefail

# One-command demo environment launcher for Jarvis Triage.
# Starts relay server + app dev server, then opens the simulator.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RELAY_PORT="${RELAY_PORT:-8080}"
APP_PORT="${APP_PORT:-5173}"

cleanup() {
  echo ""
  echo "Shutting down..."
  [[ -n "${SERVER_PID:-}" ]] && kill "$SERVER_PID" 2>/dev/null && echo "  Relay server stopped"
  [[ -n "${APP_PID:-}" ]] && kill "$APP_PID" 2>/dev/null && echo "  App dev server stopped"
  wait 2>/dev/null
  echo "Done."
}
trap cleanup EXIT

echo "============================================"
echo "  Jarvis Triage — Demo Environment"
echo "============================================"
echo ""

# 1. Start relay server
echo "[1/3] Starting relay server on :${RELAY_PORT}..."
cd "$ROOT/server"
npm install --silent 2>/dev/null
npm run dev &
SERVER_PID=$!
cd "$ROOT"

# 2. Start app dev server
echo "[2/3] Starting app dev server on :${APP_PORT}..."
cd "$ROOT/app"
npm install --silent 2>/dev/null
npm run dev &
APP_PID=$!
cd "$ROOT"

# 3. Wait for servers to be ready
echo ""
echo "Waiting for servers..."
sleep 3

# Check if servers are running
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "ERROR: Relay server failed to start"
  exit 1
fi
if ! kill -0 "$APP_PID" 2>/dev/null; then
  echo "ERROR: App dev server failed to start"
  exit 1
fi

echo "  Relay server: http://localhost:${RELAY_PORT}"
echo "  App server:   http://localhost:${APP_PORT}"
echo ""

# 4. Launch simulator
SIMULATOR_URL="http://localhost:${APP_PORT}?ws=ws://localhost:${RELAY_PORT}"
echo "[3/3] Launching simulator..."
echo "  URL: ${SIMULATOR_URL}"
echo ""
echo "--------------------------------------------"
echo "  In another terminal, run:"
echo "    ./scripts/demo.sh"
echo "--------------------------------------------"
echo ""

evenhub-simulator "$SIMULATOR_URL"
