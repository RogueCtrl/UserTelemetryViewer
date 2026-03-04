# Contributing to UserTelemetryViewer

Thanks for your interest in contributing! This document covers everything you need to get started.

## Getting Started

```bash
git clone https://github.com/RogueCtrl/UserTelemetryViewer.git
cd UserTelemetryViewer
npm install
```

You'll need Node.js >= 18.0.0.

## Development Workflow

1. Fork the repo and create a branch from `main`.
2. Make your changes.
3. Run `npm run build` to verify the project compiles cleanly.
4. Run `npm run lint` to catch style issues.
5. Test manually by running all three processes (see below).
6. Open a pull request against `main`.

### Running Locally

You need three terminals:

```bash
# Terminal 1: Vite dev server
npm run dev

# Terminal 2: WebSocket backend
npx ts-node server.ts

# Terminal 3: Synthetic telemetry
node simulate_posthog.js
```

Then open `http://localhost:5173`.

## Code Style

- **ESLint** is configured. Run `npm run lint` to check.
- TypeScript strict mode is enabled.
- ESM modules (`import`/`export`).
- Vanilla CSS — no utility frameworks.

## Project Structure

- `server.ts` — Express + Socket.io backend
- `simulate_posthog.js` — Synthetic PostHog event generator
- `src/App.tsx` — Main React app with WebSocket client
- `src/components/GameMap.tsx` — Room layout and avatar overlay
- `src/components/Room.tsx` — Individual room panels
- `src/components/Avatar.tsx` — Animated avatars with hover tooltips
- `src/index.css` — Design system and animations

See `AGENTS.md` for a full architecture overview.

## What to Work On

Check the [issues](https://github.com/RogueCtrl/UserTelemetryViewer/issues) for open tasks. Good first contributions:

- **New room types** — Add rooms for different page categories
- **Pathfinding** — Implement A* so avatars walk between rooms instead of teleporting
- **Real telemetry adapters** — Integrate Segment, Mixpanel, or Google Analytics
- **Pixel art sprites** — Replace circle avatars with animated pixel characters
- **User session timelines** — Click an avatar to see their full journey
- **Room furniture** — Add visual elements inside rooms (desks, shelves, etc.)
- **Dark/light theme toggle**
- **Documentation improvements**

## Commits

- Write clear commit messages that describe *why*, not just *what*.
- Use conventional commit prefixes: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`.
- One logical change per commit.

## Pull Requests

- Keep PRs focused — one feature or fix per PR.
- Include a description of what changed and why.
- Include a screenshot or screen recording for visual changes.
- All CI checks must pass before merging.

## Reporting Bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser, Node.js version, and OS

## Feature Requests

Open an issue with the `enhancement` label. Describe the use case and why it would be valuable.

## Questions

Open a discussion or issue. We're happy to help.
