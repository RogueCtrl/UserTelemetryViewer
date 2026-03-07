# UserTelemetryViewer — gamified telemetry, live on your screen

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Current Status: Alpha — Exploratory Development**

A real-time 2D dashboard that transforms website telemetry into a living virtual map. Instead of staring at charts, watch your users navigate your site as animated avatars moving between rooms.

![UserTelemetryViewer Dashboard](docs/screenshot-session.png)

## Why?

Every analytics tool shows you numbers. UserTelemetryViewer shows you *people* — colored circles floating through a glassmorphic floor plan, hopping from Login Portal to Product Catalog to Checkout Arena. Hover over an avatar to see their browser, OS, current page, and last action. Watch the activity feed scroll in real time. See which rooms are crowded at a glance.

Inspired by virtual office simulations and AI agent visualizers, but built for website traffic.

## Quick Start

```bash
git clone https://github.com/RogueCtrl/UserTelemetryViewer.git
cd UserTelemetryViewer
npm install
```

Run the full stack in three terminals:

```bash
# Terminal 1: Frontend dev server
npm run dev

# Terminal 2: WebSocket backend
npx ts-node server.ts

# Terminal 3: Synthetic telemetry (optional — for demo)
node simulate_posthog.js
```

Open `http://localhost:5173` and watch the avatars move.

## How It Works

```
┌─────────────────┐     POST /api/events     ┌──────────────────┐     WebSocket      ┌──────────────────┐
│  Your Website   │ ─────────────────────▶   │    server.ts     │ ─────────────────▶ │  React Frontend  │
│  (or simulator) │  PostHog JSON payload    │ Express+Socket.io│  Real-time push    │ (localhost:5173) │
└─────────────────┘                          └──────────────────┘                    └──────────────────┘
```

1. **Telemetry comes in** — Any source POSTs PostHog-shaped events to `/api/events`
2. **Server maps URLs to rooms** — `/checkout` → Checkout Arena, `/products/*` → Product Catalog, etc.
3. **Avatars get coordinates** — Server picks a random position inside the target room
4. **WebSocket broadcasts** — All connected frontends receive the update instantly
5. **CSS does the rest** — Smooth cubic-bezier transitions glide avatars to their new positions

## Sending Real Events

Replace the simulator with real telemetry by POSTing to `/api/events`:

```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "event": "$pageview",
    "properties": {
      "distinct_id": "user_abc123",
      "$current_url": "https://yoursite.com/products",
      "$browser": "Chrome",
      "$os": "Mac OS X",
      "name": "Jane Doe"
    }
  }'
```

Or point a [PostHog webhook](https://posthog.com/docs/webhooks) directly at your server.

### Production Auth

For production deployments, you can secure the `/api/events` endpoint using environment variables:

- `POSTHOG_WEBHOOK_SECRET`: If set, the server verifies the `X-Posthog-Signature` header (HMAC-SHA256) sent by PostHog webhooks.
- `TELEMETRY_API_KEY`: If set, the server also accepts `Authorization: Bearer <your_api_key>` for manual event ingestion. Named `TELEMETRY_API_KEY` (not `POSTHOG_API_KEY`) to avoid clashing with PostHog's own client SDK variable.

If neither is set, the server runs in insecure development mode and accepts all requests.

### OpenTelemetry (OTLP)

You can also pipe OpenTelemetry JSON traces directly to the OTLP-compatible endpoint. This is useful for backend services or web apps already instrumented with OTel:

```bash
curl -X POST http://localhost:3001/api/otlp/v1/traces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_secret_token_here" \
  -d '{
    "resourceSpans": [{
      "resource": {
        "attributes": [
          { "key": "service.name", "value": { "stringValue": "my-website" } },
          { "key": "http.user_agent", "value": { "stringValue": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36" } }
        ]
      },
      "scopeSpans": [{
        "spans": [{
          "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
          "spanId": "00f067aa0ba902b7",
          "name": "Page View: /products",
          "attributes": [
            { "key": "http.url", "value": { "stringValue": "https://yoursite.com/products" } },
            { "key": "user.id", "value": { "stringValue": "user_abc123" } },
            { "key": "user.name", "value": { "stringValue": "Jane Doe" } }
          ]
        }]
      }]
    }]
  }'
```

If `OTEL_BEARER_TOKEN` is set in your environment, the `Authorization` header is required.

> **Protocol note:** This endpoint only supports **JSON over HTTP** (`Content-Type: application/json`). Most OTel SDKs default to protobuf over gRPC. Configure your SDK to use the JSON/HTTP exporter:
> ```
> OTEL_EXPORTER_OTLP_PROTOCOL=http/json
> ```

> **Endpoint note:** The OTLP path is `/api/otlp/v1/traces` — not the bare `/v1/traces` used by standard collectors. You must include the `/api/otlp` prefix when configuring your exporter:
> ```
> OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3001/api/otlp
> ```


## Features

- **Live avatar map** — Colored circles with bouncy CSS animations move between 5 rooms
- **Hover tooltips** — User name, current room, last action, browser, OS, and URL
- **Activity feed** — Scrolling sidebar showing the last 30 events in real time
- **Room occupancy badges** — Green pills showing user count per room
- **Connection paths** — Dashed SVG lines showing navigation routes between rooms
- **LIVE/OFFLINE indicator** — Pulsing badge reflects WebSocket connection state
- **Consistent user colors** — Same user always gets the same color (hash-based)
- **Auto-cleanup** — Stale users evicted after 2 minutes of inactivity
- **PostHog-compatible** — Drop-in endpoint for PostHog webhooks
- **Checkout transactions** — Floating 💲 animation on purchase events with golden avatar glow
- **Transaction panel** — Live revenue counter, conversion rate, and recent transaction list
- **Sub-rooms** — Adjoining mini-rooms for drawers, modals, and page modes attached to parent rooms
- **Session timelines** — Click any avatar to see their full journey in a sliding panel
- **A* pathfinding** — Avatars walk through intermediate rooms instead of teleporting
- **Configurable room layouts** — Edit `rooms.json` to model your own site — no code changes needed
- **Premium dark mode** — Glassmorphism, dot-grid background, smooth gradients

## The Rooms

| Room | Maps to URLs containing | Sub-rooms |
|------|------------------------|----------|
| 🚪 Login Portal | `/login` | |
| 🏠 Landing Page | Root URL (`/`) | |
| 📦 Product Catalog | `/products` | Filter Panel, Quick View |
| 💳 Checkout Arena | `/checkout` | Payment Form |
| ℹ️ About Us | `/about` | |

Sub-rooms appear as smaller dashed panels attached to their parent room. Avatars move into them on `drawer_opened`, `modal_opened`, or `form_focused` events.

All rooms are defined in [`rooms.json`](rooms.json) — edit this file to model your own site, then restart the server. No code changes required.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript (Vite) |
| Styling | Vanilla CSS with glassmorphism |
| Icons | Lucide React |
| Backend | Express + Socket.io |
| Communication | REST ingestion → WebSocket broadcast |
| Simulator | Node.js script with `node-fetch` |

## Project Structure

```
├── rooms.json             # Room layout config (single source of truth)
├── server.ts              # Express + Socket.io backend
├── simulate_posthog.js    # Synthetic PostHog event generator
├── src/
│   ├── App.tsx            # Main app — WebSocket client, header, activity feed
│   ├── index.css          # Design system — variables, glass-panel, animations
│   └── components/
│       ├── GameMap.tsx     # Dynamic room layout, occupancy counts, SVG paths
│       ├── Room.tsx        # Individual room panel with badge + sub-rooms
│       ├── Avatar.tsx      # Animated avatar with hover tooltip + click select
│       ├── SessionTimeline.tsx  # Per-user journey timeline panel
│       └── TransactionPanel.tsx  # Revenue counter + recent purchases
├── src/utils/
│   └── pathfinding.ts     # BFS graph traversal for avatar movement
├── docs/
│   └── screenshot.png     # Dashboard screenshot
├── AGENTS.md              # Full architecture guide for AI coding agents
├── CONTRIBUTING.md        # How to contribute
├── CODE_OF_CONDUCT.md     # Contributor Covenant v2.1
├── SECURITY.md            # Security policy
├── CHANGELOG.md           # Version history
└── LICENSE                # MIT
```

## Roadmap

Priority-stacked — highest value items first.

- [x] **Historical replay** ⭐ — Persist events to disk and scrub through past traffic patterns with a timeline player
- [x] **Heatmap overlay mode** ⭐ — Toggle from live avatars to a color-graded room heatmap showing traffic density over time
- [ ] **User search & filter** — Find a specific user on the map; filter avatars by room, browser, or OS
- [ ] **Threshold alerting** — Define rules (e.g. >N users in a room, conversion rate drops) and fire browser notifications or outbound webhooks
- [ ] **Segment / Mixpanel adapters** — Support more analytics platforms alongside PostHog and OTel
- [ ] **Alternative KPI tracking** — Not all sites have checkouts — add configurable KPI events (sign-ups, form submissions, etc.)
- [ ] **Room furniture** — Add visual elements inside rooms (shopping carts, forms, etc.)
- [ ] **Multiple floors** — Navigate between different map views for different site sections

### Completed

- [x] **Checkout transactions** — Floating 💲 animation on purchase events with transaction panel, revenue counter, and conversion rate
- [x] **Sub-rooms for page elements** — Adjoining mini-rooms for on-page drawers, modals, and alternate page modes (Filter Panel, Quick View, Payment Form)
- [x] **A\* pathfinding** — Avatars walk between rooms instead of teleporting
- [x] **Session timelines** — Click an avatar to see their full journey through the site
- [x] **Real PostHog webhook adapter** — Production-ready integration with HMAC-SHA256 signature verification and API key auth
- [x] **OpenTelemetry / OTLP adapter** — Support for OTel JSON traces directly into the dashboard
- [x] **Configurable room layouts** — JSON-based map definitions so anyone can model their site

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

## License

[MIT](LICENSE) — Matt Cox, 2026
