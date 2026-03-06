import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const app = express();
app.use(cors());
// Use raw body parser for /api/events so HMAC is computed on the original bytes,
// not a re-serialized JSON string (which can differ in key order / whitespace).
app.use('/api/events', express.raw({ type: 'application/json' }));
// express.json() runs globally but skips /api/events — express.raw() above consumes
// that route's body first and sets req._body = true, causing the JSON parser to no-op.
// This ordering is intentional: keep raw bytes intact for HMAC verification.
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// ─── Auth Config ────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = process.env.POSTHOG_WEBHOOK_SECRET;
const API_KEY = process.env.TELEMETRY_API_KEY;

if (!WEBHOOK_SECRET && !API_KEY) {
    console.warn('[Auth] WARNING: No auth configured. /api/events is in insecure dev mode.');
} else {
    if (WEBHOOK_SECRET) console.log('[Auth] HMAC signature verification enabled for /api/events');
    if (API_KEY) console.log('[Auth] API Key auth enabled for /api/events');
}

// ─── Load room config from rooms.json ───────────────────────────────────────

const roomConfig = JSON.parse(fs.readFileSync(path.join(import.meta.dirname || __dirname, 'rooms.json'), 'utf-8'));

// Build ROOM_COORDS dynamically from config
const ROOM_COORDS: Record<string, { x: number, y: number, w: number, h: number, label: string }> = {};
const URL_ROUTES: { pattern: string, exact: boolean, roomId: string }[] = [];
const SUB_ROOM_EVENTS: { eventType: string, matchKey: string, matchValue: string, roomId: string }[] = [];

for (const room of roomConfig.rooms) {
    ROOM_COORDS[room.id] = { x: room.x, y: room.y, w: room.width, h: room.height, label: room.name };

    // Build URL routing rules
    if (room.urlPatterns) {
        for (const pattern of room.urlPatterns) {
            URL_ROUTES.push({ pattern, exact: room.urlExact || false, roomId: room.id });
        }
    }

    // Build sub-room coords and event mapping
    if (room.subRooms) {
        for (const sub of room.subRooms) {
            // Calculate absolute position based on anchor
            const gap = 0.5;
            let sx = room.x, sy = room.y;
            if (sub.anchor === 'right') { sx = room.x + room.width + gap; sy = room.y; }
            else if (sub.anchor === 'bottom') { sx = room.x; sy = room.y + room.height + gap; }
            else if (sub.anchor === 'left') { sx = room.x - sub.width - gap; sy = room.y; }
            else if (sub.anchor === 'top') { sx = room.x; sy = room.y - sub.height - gap; }

            ROOM_COORDS[sub.id] = { x: sx, y: sy, w: sub.width, h: sub.height, label: sub.name };

            // Build sub-room event mapping
            if (sub.eventType && sub.eventMatch) {
                const [matchKey, matchValue] = Object.entries(sub.eventMatch)[0];
                SUB_ROOM_EVENTS.push({ eventType: sub.eventType, matchKey, matchValue: matchValue as string, roomId: sub.id });
            }
        }
    }
}

// Sort URL routes: exact matches first, then longest pattern first
URL_ROUTES.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    return b.pattern.length - a.pattern.length;
});

console.log(`[Config] Loaded ${roomConfig.rooms.length} rooms, ${SUB_ROOM_EVENTS.length} sub-room events, ${URL_ROUTES.length} URL routes`);

// ─── State storage ──────────────────────────────────────────────────────────

const activeUsers: Record<string, any> = {};
const userHistory: Record<string, any[]> = {};

// ─── WebSocket connections ──────────────────────────────────────────────────

io.on('connection', (socket) => {
    console.log('Frontend client connected:', socket.id);

    socket.emit('gameState', Object.values(activeUsers));
    socket.emit('allHistory', userHistory);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// ─── REST endpoints ─────────────────────────────────────────────────────────

// Serve room config to frontend
app.get('/api/rooms', (_req, res) => {
    res.json(roomConfig);
});

// API endpoint mimicking PostHog ingest / custom webhook
app.post('/api/events', (req, res) => {
    // ─── Authentication Check ───────────────────────────────────────────────
    // Open only when neither auth method is configured (dev mode).
    // If either is set, all requests must pass at least one check.
    let isAuthorized = !WEBHOOK_SECRET && !API_KEY;

    // req.body is a raw Buffer when Content-Type is application/json (express.raw above).
    // For any other content type (or missing body), express.raw leaves req.body undefined —
    // guard early to avoid TypeError inside HMAC / JSON.parse.
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
        console.warn('[Auth] Rejected request to /api/events — missing or non-JSON body');
        return res.status(401).json({ error: 'Unauthorized: Expected application/json body' });
    }

    // 1. Signature Verification (HMAC-SHA256 on raw bytes — timing-safe)
    if (WEBHOOK_SECRET) {
        const signature = req.headers['x-posthog-signature'];
        if (signature && typeof signature === 'string') {
            const [version, hash] = signature.split('=');
            if (version === 'sha256' && hash) {
                try {
                    const computedHash = crypto.createHmac('sha256', WEBHOOK_SECRET)
                        .update(rawBody)
                        .digest('hex');
                    if (crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash))) {
                        isAuthorized = true;
                    }
                } catch {
                    // timingSafeEqual throws if buffers differ in length — treat as mismatch
                }
            }
        }
    }

    // 2. API Key Fallback (Bearer Token) — independent of WEBHOOK_SECRET
    if (!isAuthorized && API_KEY) {
        const authHeader = req.headers['authorization'];
        if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            const key = authHeader.substring(7);
            try {
                // Use timing-safe comparison to prevent side-channel attacks
                if (crypto.timingSafeEqual(Buffer.from(key), Buffer.from(API_KEY))) {
                    isAuthorized = true;
                }
            } catch {
                // timingSafeEqual throws on length mismatch — treat as invalid key
            }
        }
    }

    if (!isAuthorized) {
        console.warn('[Auth] Rejected unauthorized request to /api/events');
        return res.status(401).json({ error: 'Unauthorized: Invalid signature or API key' });
    }

    // Parse the raw body now that auth has passed
    let parsedBody: any;
    try {
        parsedBody = JSON.parse(rawBody.toString());
    } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { event, properties, timestamp } = parsedBody;

    if (!properties || !properties.distinct_id) {
        return res.status(400).json({ error: 'Missing properties.distinct_id' });
    }

    const userId = properties.distinct_id;
    const url = properties.$current_url || '';
    const name = properties.name || `User-${userId.substring(0, 4)}`;

    // Map URL to room using config-driven routing
    let room = roomConfig.rooms[0]?.id || 'login'; // fallback to first room
    for (const route of URL_ROUTES) {
        if (route.exact) {
            // For exact match, check if the URL path is exactly the pattern
            try {
                const urlPath = new URL(url).pathname;
                if (urlPath === route.pattern) { room = route.roomId; break; }
            } catch { /* not a valid URL, skip */ }
        } else {
            if (url.includes(route.pattern)) { room = route.roomId; break; }
        }
    }

    // Detect sub-room events (take priority over parent room)
    for (const subEvent of SUB_ROOM_EVENTS) {
        if (event === subEvent.eventType && properties[subEvent.matchKey] === subEvent.matchValue) {
            room = subEvent.roomId;
            break;
        }
    }

    // Detect purchase events (only if transactions enabled)
    const txEnabled = roomConfig.enableTransactions !== false;
    const isPurchase = txEnabled && (event === 'order_completed' || event === '$purchase');
    const purchaseAmount = isPurchase ? (properties.$amount || properties.revenue || 0) : undefined;
    const isSubRoom = SUB_ROOM_EVENTS.some(e => e.eventType === event);
    const actionStr = isPurchase ? 'Purchase'
        : isSubRoom ? (properties.drawer || properties.modal || properties.form || 'Interaction')
            : event === '$pageview' ? 'Page View'
                : properties.interaction_type || 'Active';

    // Generate a consistent color based on the distinct_id
    const hashCode = userId.split('').reduce((a: number, b: string) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
    const userColor = colors[Math.abs(hashCode) % colors.length];

    // Calculate position inside the target room
    const pos = getRandomPositionInRoom(room);
    const roomInfo = ROOM_COORDS[room] || ROOM_COORDS[roomConfig.rooms[0]?.id || 'login'];

    // Update or create user
    activeUsers[userId] = {
        id: userId,
        name: name,
        x: pos.x,
        y: pos.y,
        activeRoom: roomInfo.label,
        action: actionStr,
        status: 'moving',
        color: userColor,
        lastUpdate: Date.now(),
        browser: properties.$browser || 'Unknown',
        os: properties.$os || 'Unknown',
        currentUrl: url,
        purchaseAmount: purchaseAmount
    };

    console.log(`[Event] ${name} -> ${roomInfo.label} (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) | ${actionStr}${isPurchase ? ` $${purchaseAmount?.toFixed(2)}` : ''}`);

    // Store history entry
    if (!userHistory[userId]) userHistory[userId] = [];
    userHistory[userId].unshift({
        room: roomInfo.label,
        action: actionStr,
        time: new Date().toLocaleTimeString(),
        url: url,
        isPurchase,
        amount: purchaseAmount,
    });
    if (userHistory[userId].length > 50) userHistory[userId].pop();

    // Broadcast the update to all connected React clients
    io.emit('userUpdate', activeUsers[userId]);
    io.emit('userHistory', { userId, history: userHistory[userId] });

    // Emit transaction event for purchases
    if (isPurchase && purchaseAmount) {
        io.emit('transaction', {
            id: `txn_${userId}_${Date.now()}`,
            userId,
            userName: name,
            amount: purchaseAmount,
            color: userColor,
            time: new Date().toLocaleTimeString()
        });
    }

    res.status(200).json({ success: true });
});

function getRandomPositionInRoom(roomId: string) {
    const room = ROOM_COORDS[roomId] || ROOM_COORDS[roomConfig.rooms[0]?.id || 'login'];
    const pad = 1;
    return {
        x: room.x + pad + Math.random() * (room.w - pad * 2),
        y: room.y + pad + Math.random() * (room.h - pad * 2)
    };
}

// Clean up stale users (no activity for 2 minutes)
setInterval(() => {
    const now = Date.now();
    let changed = false;

    Object.keys(activeUsers).forEach(id => {
        if (now - activeUsers[id].lastUpdate > 120000) {
            delete activeUsers[id];
            delete userHistory[id];
            changed = true;
            io.emit('userLeft', id);
        }
    });

    if (changed) {
        io.emit('gameState', Object.values(activeUsers));
    }
}, 30000);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Telemetry Game Server listening on port ${PORT}`);
});
