import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

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

// ─── OTel Auth Config ───────────────────────────────────────────────────────

const OTEL_BEARER_TOKEN = process.env.OTEL_BEARER_TOKEN;
if (!OTEL_BEARER_TOKEN) {
    console.warn('[Otel] Warning: OTEL_BEARER_TOKEN not set. OTLP endpoint is unauthenticated.');
}

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

// ─── Core Logic ─────────────────────────────────────────────────────────────

function processEvent(data: {
    event: string;
    userId: string;
    url: string;
    name?: string;
    browser?: string;
    os?: string;
    properties: Record<string, any>;
}) {
    const { event, userId, url, properties } = data;
    const name = data.name || properties.name || `User-${userId.substring(0, 4)}`;

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
                : properties.interaction_type || (event && event !== 'custom_interaction' ? event : 'Active');

    // Generate a consistent color based on the distinct_id
    const hashCode = userId.split('').reduce((a: number, b: string) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
    const userColor = colors[Math.abs(hashCode) % colors.length];

    // Calculate position inside the target room
    const pos = getRandomPositionInRoom(room);
    const roomInfo = ROOM_COORDS[room] || ROOM_COORDS[roomConfig.rooms[0]?.id || 'login'];

    // Update or create user
    const browser = data.browser || properties.$browser || 'Unknown';
    const os = data.os || properties.$os || 'Unknown';

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
        browser,
        os,
        currentUrl: url,
        purchaseAmount: purchaseAmount
    };

    console.log(`[Event] ${name} (${browser}/${os}) -> ${roomInfo.label} (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) | ${actionStr}${isPurchase ? ` $${purchaseAmount?.toFixed(2)}` : ''}`);

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
}

function getRandomPositionInRoom(roomId: string) {
    const room = ROOM_COORDS[roomId] || ROOM_COORDS[roomConfig.rooms[0]?.id || 'login'];
    const pad = 1;
    return {
        x: room.x + pad + Math.random() * (room.w - pad * 2),
        y: room.y + pad + Math.random() * (room.h - pad * 2)
    };
}

function parseUA(ua: string) {
    let browser = 'Unknown';
    let os = 'Unknown';

    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Macintosh')) os = 'Mac OS X';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';

    return { browser, os };
}

// ─── REST endpoints ─────────────────────────────────────────────────────────

// Serve room config to frontend
app.get('/api/rooms', (_req, res) => {
    res.json(roomConfig);
});

// API endpoint mimicking PostHog ingest / custom webhook
app.post('/api/events', (req, res) => {
    const { event, properties } = req.body;

    if (!properties || !properties.distinct_id) {
        return res.status(400).json({ error: 'Missing properties.distinct_id' });
    }

    processEvent({
        event: event || '$pageview',
        userId: properties.distinct_id,
        url: properties.$current_url || '',
        properties
    });

    res.status(200).json({ success: true });
});

// OpenTelemetry (OTLP) Adapter
app.post('/api/otlp/v1/traces', (req, res) => {
    // Auth check
    if (OTEL_BEARER_TOKEN) {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${OTEL_BEARER_TOKEN}`) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    const { resourceSpans } = req.body;
    if (!resourceSpans || !Array.isArray(resourceSpans)) {
        return res.status(200).json({});
    }

    for (const rs of resourceSpans) {
        const resourceAttrs: Record<string, any> = {};
        if (rs.resource?.attributes) {
            for (const attr of rs.resource.attributes) {
                const val = attr.value;
                resourceAttrs[attr.key] = val.stringValue ?? val.intValue ?? val.boolValue ?? val.doubleValue;
            }
        }

        if (rs.scopeSpans) {
            for (const ss of rs.scopeSpans) {
                if (ss.spans) {
                    for (const span of ss.spans) {
                        const spanAttrs: Record<string, any> = {};
                        if (span.attributes) {
                            for (const attr of span.attributes) {
                                const val = attr.value;
                                spanAttrs[attr.key] = val.stringValue ?? val.intValue ?? val.boolValue ?? val.doubleValue;
                            }
                        }

                        const traceId = span.traceId;
                        const userId = spanAttrs['user.id'] || spanAttrs['enduser.id'] || resourceAttrs['user.id'] || resourceAttrs['enduser.id'] || traceId;
                        const userName = spanAttrs['user.name'] || spanAttrs['enduser.name'] || resourceAttrs['user.name'] || resourceAttrs['enduser.name'] || (traceId ? traceId.substring(0, 6) : 'Unknown');
                        const url = spanAttrs['http.url'] || spanAttrs['http.target'] || '';
                        const ua = spanAttrs['http.user_agent'] || resourceAttrs['http.user_agent'] || '';
                        const { browser, os } = parseUA(ua);

                        processEvent({
                            event: span.name,
                            userId,
                            name: userName,
                            url,
                            browser,
                            os,
                            properties: { ...resourceAttrs, ...spanAttrs }
                        });
                    }
                }
            }
        }
    }

    res.status(200).json({});
});

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
