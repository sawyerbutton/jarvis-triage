# Changelog

All notable changes to Jarvis Triage are documented here.

---

## v0.2.0 — AI Integration & MCP Server (2026-02-28)

**MCP Server for Claude Code**
- New `mcp/` module — Claude Code auto-discovers it via `.mcp.json` in repo root
- 4 tools: `jarvis_status`, `jarvis_notify`, `jarvis_decide`, `jarvis_approve`
- `RelayClient` with auto-reconnect, exponential backoff (1s → 30s), and heartbeat pong
- `correlationId` threading — concurrent decisions/approvals resolve to the correct waiter
- Timeout-based waiter pattern for blocking tool calls (decide: 120s, approve: 300s)

**67 Tests (52 unit + 15 integration)**
- Unit tests: RelayClient (mock WS), tool handlers, config env-var parsing
- Integration tests: embedded mini relay on random port, real TCP/WebSocket connections
- Only mock is `config` (to inject dynamic port) — `fetch()` and `WebSocket` are real
- Covers: HTTP endpoints, WS heartbeat, decision/approval E2E with correlationId, multi-client broadcast, connection lifecycle

**Browser Sim Buttons**
- 3 buttons in dev panel: Scroll Up / Click / Scroll Down
- Enables full L2/L3/L4 interaction in browser without Even Hub simulator or G2 glasses
- Same `dispatch()` path as real ring input — not a separate code path

**Relay Server Updates**
- `correlationId` forwarded in push responses and decision/approval messages
- Decision/approval messages routed to all other connected clients (not sender)

**LLM Tool Integration**
- Two integration paths documented: MCP (stdio, bidirectional) and HTTP POST (push-only)
- Any LLM tool can push to HUD via `POST /push` — no per-tool adaptation needed

---

## v0.1.0 — Initial Release (2026-02-27)

- Core triage engine: 5 levels (L0 Silent → L4 Plan Review)
- Even Hub App: HUD rendering for 576x288 display, ring/touch event handling
- Demo mode with double-click scenario cycling (L0-L4)
- WebSocket relay server: `POST /push` + WS broadcast
- Protocol spec (PROTOCOL.md)
- Demo scripts: `demo.sh`, `ai-backend-demo.sh`, `auto-triage-demo.sh`, `start-demo.sh`
- SKILL.md (OpenClaw skill definition)
