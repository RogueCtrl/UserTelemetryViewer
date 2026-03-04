# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 0.2.0 (2026-03-03)

### Features

* **Checkout transactions** — Floating 💲 animation on purchase events with golden avatar glow
* **Transaction panel** — Live revenue counter, conversion rate, and scrollable list of recent transactions
* **Sub-rooms** — Adjoining mini-rooms (Filter Panel, Quick View, Payment Form) attached to parent rooms via dashed connector lines
* Sub-room event detection for `drawer_opened`, `modal_opened`, and `form_focused` events
* Purple occupancy badges and pulse animation on occupied sub-rooms
* Simulator generates ~25% sub-room events and ~40% purchase events on relevant pages
* `--accent-gold` CSS variable and `dollarRise`, `goldPulse`, `subRoomPulse` keyframes
* Improved room layout spacing to prevent overlap between sub-rooms and adjacent rooms

## 0.1.0 (2026-03-03)

Initial release.

### Features

* Real-time 2D gamified dashboard for website telemetry
* PostHog-compatible REST endpoint (`POST /api/events`) for telemetry ingestion
* WebSocket broadcasting via Socket.io for live state updates
* 5 predefined rooms: Login Portal, Landing Page, Product Catalog, Checkout Arena, About Us
* Animated avatar circles with CSS transform transitions and bouncy easing
* Hover tooltips displaying user metadata (room, action, browser, OS, URL)
* Room occupancy badges showing live user counts per room
* Live activity feed sidebar with slide-in animations (last 30 events)
* SVG connection paths between rooms
* LIVE/OFFLINE connection status indicator with pulse animation
* Consistent user colors derived from distinct_id hash
* Synthetic PostHog telemetry generator (`simulate_posthog.js`) with 4 mock users
* Premium dark mode aesthetic with glassmorphism, dot-grid background, and micro-animations
* Server-side stale user cleanup (2-minute timeout)
