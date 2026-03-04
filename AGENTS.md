# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository. `CLAUDE.md` is a symlink to this file.

## Project Overview

UserTelemetryViewer is a real-time gamified dashboard that visualizes website telemetry as a 2D virtual map. Instead of traditional charts and graphs, user activity is represented by colored avatar circles that physically move between "rooms" on a dark glassmorphic floor plan. Think of it as a virtual office simulation — but for your website's visitors.

A PostHog-compatible REST endpoint ingests telemetry events. A Node.js server translates URLs into room coordinates and broadcasts state changes over WebSocket. A React frontend renders the animated map with live activity feeds.

## Commands

```bash
# Setup
npm install

# Run the full stack (3 terminals)
npm run dev              # Terminal 1: Vite dev server (localhost:5173)
npx ts-node server.ts    # Terminal 2: WebSocket backend (localhost:3001)
node simulate_posthog.js # Terminal 3: Synthetic telemetry generator

# Build
npm run build            # TypeScript check + Vite production build

# Linting
npm run lint             # ESLint
```

All three processes must be running for the full experience. The frontend connects to the backend via WebSocket on port 3001.

## Architecture

```
┌─────────────────┐     POST /api/events     ┌──────────────────┐     WebSocket      ┌──────────────────┐
│  Telemetry       │ ─────────────────────▶  │    server.ts      │ ─────────────────▶ │   React Frontend  │
│  Source           │  PostHog JSON payload    │  Express+Socket.io │  Real-time push    │   Vite dev server  │
│  (or simulator)  │                          │  (localhost:3001)  │                    │  (localhost:5173)  │
└─────────────────┘                          └──────────────────┘                    └──────────────────┘
```

### Data Flow

1. **Telemetry ingestion** — `POST /api/events` accepts PostHog-shaped JSON (`event`, `properties.distinct_id`, `properties.$current_url`, etc.)
2. **URL → Room mapping** — The server maps URL paths to room IDs (`/checkout` → `checkout`, `/products/*` → `products`, etc.)
3. **Coordinate calculation** — `getRandomPositionInRoom()` computes a random (x, y) position within the room's grid bounds
4. **WebSocket broadcast** — The full user state (id, name, x, y, color, action, browser, OS, URL) is emitted via Socket.io
5. **Frontend rendering** — React receives the update, places the avatar at the new position, and CSS transitions handle smooth animation

### Room Coordinate System

Rooms are defined in a grid system where 1 unit = 40px. The same room definitions exist in two places and **must stay in sync**:

| Location | Purpose |
|----------|---------|
| `server.ts` → `ROOM_COORDS` | Server-side coordinate lookup for positioning avatars |
| `src/components/GameMap.tsx` → `ROOMS` | Frontend rendering of room boxes |

Current rooms:

| Room ID | Label | Grid Position | Size |
|---------|-------|---------------|------|
| `login` | Login Portal | (2, 2) | 6×4 |
| `home` | Landing Page | (10, 2) | 8×6 |
| `products` | Product Catalog | (10, 10) | 8×6 |
| `checkout` | Checkout Arena | (20, 10) | 6×6 |
| `about` | About Us | (2, 10) | 6×4 |

### Module Responsibilities

| File | Role |
|------|------|
| `server.ts` | Express + Socket.io backend; accepts PostHog events, maps URLs to room coordinates, broadcasts user state via WebSocket; auto-cleans stale users after 2 minutes |
| `simulate_posthog.js` | Synthetic telemetry generator; creates 4 mock users with random browser/OS, sends PostHog-shaped events every 3 seconds |
| `src/App.tsx` | Main React component; manages WebSocket connection, user state, renders header overlay with LIVE/OFFLINE status, and the activity feed sidebar |
| `src/components/GameMap.tsx` | Renders the room layout, computes per-room occupancy counts, draws SVG connection paths between rooms, overlays avatar components |
| `src/components/Room.tsx` | Individual room panel with glassmorphism styling and a green occupancy badge showing user count |
| `src/components/Avatar.tsx` | Animated avatar circle with CSS transform transitions; hover tooltip shows name, room, action, browser, OS, and current URL |
| `src/index.css` | Design system: CSS variables, glassmorphism `.glass-panel` class, grid background, animation keyframes (float, pop, pulse, slideIn) |

### PostHog Event Format

The `/api/events` endpoint expects this shape (mirrors PostHog's event structure):

```json
{
  "event": "$pageview",
  "properties": {
    "distinct_id": "user_abc123",
    "$current_url": "https://yoursite.com/products/dashboard",
    "$browser": "Chrome",
    "$os": "Mac OS X",
    "name": "Jane Doe"
  },
  "timestamp": "2026-03-03T20:00:00.000Z"
}
```

Required field: `properties.distinct_id`. Everything else has sensible defaults.

### Key Design Decisions

- **CSS transitions for movement** — Avatar positions are set via `transform: translate()` with a 1.2s cubic-bezier easing. No JS animation loop needed.
- **Consistent user colors** — Colors are derived from a hash of `distinct_id`, so the same user always gets the same color.
- **Server-side coordinate mapping** — The server (not the frontend) decides where avatars go. This keeps the frontend a pure renderer.
- **No authentication** — The `/api/events` endpoint is wide open. In production, add API key validation.

### Adding a New Room

1. Add the room to `ROOM_COORDS` in `server.ts` with grid position and size
2. Add the matching entry to `ROOMS` in `src/components/GameMap.tsx`
3. Add URL-matching logic in the `POST /api/events` handler
4. Optionally add SVG connection lines in `GameMap.tsx`

### Adding a New Telemetry Source

The server accepts any HTTP POST to `/api/events` with the PostHog JSON shape. To integrate a real source:

1. **PostHog webhook** — Point a PostHog action webhook at `your-server.com/api/events`
2. **Custom tracking** — Add a fetch call on your website: `fetch('/api/events', { method: 'POST', body: JSON.stringify({ event: '$pageview', properties: { distinct_id: userId, $current_url: window.location.href } }) })`
3. **Any analytics pipeline** — Transform events into the expected JSON shape and POST them

## Dependencies

**Runtime:** `react`, `react-dom`, `socket.io-client`, `lucide-react`, `express`, `socket.io`, `cors`, `node-fetch`

**Dev:** `typescript`, `vite`, `@vitejs/plugin-react`, `eslint`, `ts-node`, `@types/express`, `@types/cors`, `@types/node`

**Node:** >= 18.0.0 | **Module system:** ESM (`"type": "module"`)
