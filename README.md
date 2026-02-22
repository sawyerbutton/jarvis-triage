# 🤖 Jarvis Triage — OpenClaw Skill

> Turn any OpenClaw output into a mobile-friendly, voice-first format.  
> Walk and code. Walk and decide. No screen required.

## What is this?

Jarvis Triage is an [OpenClaw](https://github.com/openclaw/openclaw) Skill that compresses long AI outputs into a layered format designed for **voice + AR HUD (4 lines)** interaction. It's the core intelligence layer of the "Jarvis Mode" project — enabling you to operate OpenClaw while walking, commuting, or away from your desk.

**Core capability:** Take a 50-line Claude Code plan and turn it into a 30-second voice briefing + key decision points you can approve with one word.

## The Problem

OpenClaw is powerful, but its output is designed for screens — Telegram messages, terminal windows, web UIs. When you're away from your computer, you're cut off.

What if you could:
- 🚶 Approve a Claude Code plan while walking to lunch
- 🎧 Get a voice briefing of your email analysis during your commute
- 👓 See key decision points on AR glasses without stopping

Jarvis Triage makes this possible by acting as an **information compression layer** between OpenClaw's raw output and minimal display interfaces.

## How It Works

### Information Triage (Level 0-4)

| Level | Type | Output | Example |
|-------|------|--------|---------|
| 0 | Silent | Nothing | "Backup completed" |
| 1 | Notify | 1 line | "✅ Email sent to Zhang San" |
| 2 | Quick Decision | 2-3 lines + options | "Thursday or Friday for the meeting?" |
| 3 | Info Decision | 3-4 lines + voice briefing | "3 vendor quotes compared..." |
| 4 | Plan Review 🔥 | Structured approval flow | "JWT migration: 7 steps, 2 decisions needed" |

### Plan Review Flow (Level 4)

The killer feature. When Claude Code generates a 50-line implementation plan:

```
You: "Jarvis, triage this plan"

Jarvis (voice): "Auth migration plan, 7 steps. Two decisions needed."

HUD:
┌──────────────────────────┐
│ 🔧 JWT Migration (7 steps) │
│ ❓ Decision 1/2: Token store │
│   A: Cookie (secure/CORS)   │
│   B: LocalStorage (simple)  │
└──────────────────────────┘

You: "Cookie"

HUD updates → next decision → approve → code runs.
You never stopped walking.
```

## Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/jarvis-triage.git

# Symlink to OpenClaw skills directory
ln -s /path/to/jarvis-triage ~/.openclaw/skills/jarvis-triage

# Start a new OpenClaw session — skill loads automatically
```

Or install directly:

```bash
mkdir -p ~/.openclaw/skills
cd ~/.openclaw/skills
git clone https://github.com/YOUR_USERNAME/jarvis-triage.git
```

## Usage

In any OpenClaw channel (Telegram, WhatsApp, etc.):

```
# After any long output
"Jarvis, triage this"

# After a Claude Code plan
"帮我审批一下这个plan"

# General summarization
"总结一下"
```

The skill automatically detects content type and applies the appropriate triage level.

## Even Hub App (G2 Smart Glasses)

The `app/` directory contains a runnable Even Hub application that renders triage output on the Even Realities G2 HUD with R1 ring interaction.

**Tech stack:** Vanilla TypeScript + Vite + `@evenrealities/even_hub_sdk`

### Quick Start

```bash
cd app && npm install && npm run dev     # Start dev server on :5173
evenhub-simulator http://localhost:5173  # Launch simulator
```

### Simulator Controls

- **Scroll up/down** — navigate list items
- **Click** — select / confirm
- **Double-click** — cycle to next demo scenario

### Demo Flow

1. App starts with a Level 1 notification
2. Double-click to cycle through Level 0-4 scenarios
3. Level 4 walkthrough: Overview → Decision 1 → Decision 2 → Confirm → Done

## File Structure

```
jarvis-triage/
├── SKILL.md                          # Core skill instructions
├── references/
│   ├── triage-levels.md              # Detailed level definitions + edge cases
│   └── plan-mode-examples.md         # Plan type examples
├── app/                              # Even Hub App (G2 smart glasses)
│   ├── index.html                    # WebView entry
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── app.json                      # Even Hub manifest
│   └── src/
│       ├── main.ts                   # Boot: bridge → state → render → demo
│       ├── bridge.ts                 # SDK bridge wrapper (timeout + mock)
│       ├── types.ts                  # TriagePayload, Decision, L4State
│       ├── state.ts                  # Global app state
│       ├── events.ts                 # Event normalization + dispatch
│       ├── renderer/                 # HUD rendering engine
│       ├── levels/                   # Level 0-4 handlers
│       ├── audio/                    # PCM capture + STT interface
│       └── demo/                     # Demo mode with 5 scenarios
├── README.md
├── LICENSE
└── .gitignore
```

## Roadmap

- [x] **Phase 0** — Core SKILL.md with Level 0-4 triage logic
- [x] **Phase 0.5** — Even Hub App: HUD rendering + ring interaction + demo mode
- [ ] **Phase 1** — Voice integration (STT via G2 mic + TTS)
- [ ] **Phase 2** — AI backend integration (live triage payloads)
- [ ] **Phase 3** — Auto-triage via AGENTS.md / Hooks (no manual trigger)
- [ ] **Phase 4** — Open source "Jarvis Mode" full stack

## Part of Jarvis Mode

This skill is the first building block of a larger vision: **a Jarvis-like interface for OpenClaw** using voice + AR glasses. The full Jarvis Mode stack:

```
Voice Input (AirPods/G1 mic)
    ↓
OpenClaw + Jarvis Triage (this repo)
    ↓
Voice Output (TTS → AirPods) + HUD Output (BLE → AR glasses)
```

Architecture docs and hardware research: coming soon.

## Contributing

This project is in early experimental phase. Issues and PRs welcome — especially:

- Real-world triage test results (did the compression lose important info?)
- New plan type examples for `references/plan-mode-examples.md`
- Edge cases where triage level classification fails
- Prompt improvements for SKILL.md

## License

MIT
