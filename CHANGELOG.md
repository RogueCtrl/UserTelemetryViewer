# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
