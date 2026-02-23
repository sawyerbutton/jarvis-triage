# Jarvis Triage

> Information compression layer for AR HUD interaction. Not tied to any specific AI platform.

Jarvis Triage compresses verbose AI output into a layered format optimized for **4-line AR HUD + ring interaction**. Feed it a 50-line plan, get back a structured approval flow you can complete without touching your phone.

## Architecture

```
Upstream            Relay Server         App (WebView)        Even G2 HUD
(AI / CI / Bot)     ws://localhost:8080   localhost:5173       Smart Glasses
     |                    |                    |                    |
     | POST /push         |                    |                    |
     | (TriagePayload)    |                    |                    |
     |------------------->|                    |                    |
     |                    | WS: payload        |                    |
     |                    |------------------->|                    |
     |                    |                    | SDK render         |
     |                    |                    |------------------->|
     |                    |                    |                    | User taps ring
     |                    | WS: decision       |                    |
     |                    |<-------------------|                    |
     |                    |                    |                    |
```

## Triage Levels

| Level | Type | HUD Output | Interaction |
|-------|------|------------|-------------|
| 0 | Silent | None | None |
| 1 | Notify | 1 line | View only |
| 2 | Quick Decision | Question + 2-3 options | Tap to select |
| 3 | Info Decision | Context + options | Tap to select |
| 4 | Plan Review | Multi-step approval flow | Sequential decisions + confirm |

## Quick Start

```bash
# 1. Start the relay server
cd server && npm install && npm run dev

# 2. Start the app (in another terminal)
cd app && npm install && npm run dev

# 3. Open in simulator (in another terminal)
evenhub-simulator "http://localhost:5173?ws=ws://localhost:8080"
```

## Modes

### Remote Mode (default with `?ws=`)

Push payloads from any system via the relay server:

```bash
# Push a notification
curl -X POST http://localhost:8080/push \
  -H 'Content-Type: application/json' \
  -d '{"level":1,"title":"Build passed","source":"ci","hudLines":["[OK] Build #42 passed"]}'

# Push a decision
curl -X POST http://localhost:8080/push \
  -H 'Content-Type: application/json' \
  -d '{"level":2,"title":"Deploy target","source":"deploy-bot","decisions":[{"question":"Deploy where?","options":[{"label":"Staging"},{"label":"Production"}]}]}'
```

User responses (decisions, approvals) are sent back through the same WebSocket connection. See [PROTOCOL.md](PROTOCOL.md) for the full schema.

### Demo Mode

Open the app without `?ws=` or use the built-in demo:

```bash
evenhub-simulator http://localhost:5173
```

- **Double-click** to cycle through Level 0-4 demo scenarios
- **Click** to select options / confirm
- **Scroll** to navigate lists

## Protocol

The relay server accepts `TriagePayload` JSON via `POST /push` and forwards it to all connected WebSocket clients. Client responses use typed messages (`decision` for L2/L3, `approval` for L4).

Full specification: [PROTOCOL.md](PROTOCOL.md)

## Testing

```bash
cd app && npm test          # Run all tests (vitest)
cd app && npx tsc --noEmit  # Type check
```

## File Structure

```
jarvis-triage/
├── SKILL.md                        # OpenClaw skill definition
├── PROTOCOL.md                     # Wire protocol specification
├── BP.md                           # Business plan (Chinese)
├── references/
│   ├── triage-levels.md            # Level definitions + edge cases
│   └── plan-mode-examples.md       # Plan type examples
├── server/                         # WebSocket relay server
│   ├── index.ts                    # Express + ws relay
│   └── package.json
├── app/                            # Even Hub App (G2 smart glasses)
│   ├── app.json                    # Even Hub manifest
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   └── src/
│       ├── main.ts                 # Boot: bridge → state → events → render
│       ├── bridge.ts               # SDK bridge wrapper
│       ├── types.ts                # TriagePayload, Decision, AppState
│       ├── state.ts                # Global app state
│       ├── events.ts               # Ring/touch event normalization
│       ├── renderer/               # HUD layout engine
│       ├── levels/                 # Level 0-4 handlers
│       ├── remote/                 # WebSocket client + protocol types
│       ├── demo/                   # Demo mode scenarios
│       └── __tests__/              # Unit tests (vitest)
└── README.md
```

## Roadmap

- [x] Core SKILL.md with Level 0-4 triage logic
- [x] Even Hub App: HUD rendering + ring interaction + demo mode
- [x] WebSocket relay server + remote payload input
- [x] Protocol spec (PROTOCOL.md)
- [ ] End-to-end demo scripts
- [ ] Voice capture (G2 quad-mic -> PCM -> STT)
- [ ] AI backend integration (live triage from upstream)
- [ ] Auto-triage hooks (no manual trigger needed)

## License

MIT
