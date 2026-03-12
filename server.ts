import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use('/api/events', express.raw({ type: 'application/json' }));
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

const OTEL_BEARER_TOKEN = process.env.OTEL_BEARER_TOKEN;
if (!OTEL_BEARER_TOKEN) {
    console.warn('[OTel] Warning: OTEL_BEARER_TOKEN not set. OTLP endpoint is unauthenticated.');
}


// ─── Load room config from rooms.json ───────────────────────────────────────

const DATA_DIR = path.join(import.meta.dirname || __dirname, 'data');
const roomsPath = fs.existsSync(path.join(DATA_DIR, 'rooms.json'))
    ? path.join(DATA_DIR, 'rooms.json')
    : path.join(import.meta.dirname || __dirname, 'rooms.json');
const roomConfig = JSON.parse(fs.readFileSync(roomsPath, 'utf-8'));

// Build ROOM_COORDS dynamically from config
const ROOM_COORDS: Record<string, { x: number, y: number, w: number, h: number, label: string }> = {};
const URL_ROUTES: { pattern: string, exact: boolean, roomId: string }[] = [];
const SUB_ROOM_EVENTS: { eventType: string, matchKey: string, matchValue: string, roomId: string }[] = [];

// KPI Events config — custom conversion events (e.g. "signup", "form_submit", "goal_complete")
const kpiEvents: { name: string, label: string }[] = (roomConfig.kpiEvents || []).map((e: any) =>
    typeof e === 'string' ? { name: e, label: e } : { name: e.name, label: e.label || e.name }
);
const kpiEventNames = new Set(kpiEvents.map(e => e.name));
const kpiCounts: Record<string, number> = {};
for (const e of kpiEvents) kpiCounts[e.name] = 0;

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

console.log(`[Config] Loaded ${roomConfig.rooms.length} rooms, ${SUB_ROOM_EVENTS.length} sub-room events, ${URL_ROUTES.length} URL routes, ${kpiEvents.length} KPI events`);

// ─── Alert Config ───────────────────────────────────────────────────────────

interface AlertCondition {
    type: 'room_occupancy' | 'conversion_rate' | 'total_users';
    room?: string;
    operator: 'gt' | 'gte' | 'lt' | 'lte';
    value: number;
}

interface AlertRule {
    id: string;
    name: string;
    enabled: boolean;
    condition: AlertCondition;
    cooldownMs: number;
    actions: ('browser' | 'webhook')[];
    webhookUrl?: string;
    lastFiredAt?: number;
}

let alertRules: AlertRule[] = [];
const alertLastFired: Record<string, number> = {};
const ALERTS_CONFIG_PATH = fs.existsSync(path.join(DATA_DIR, 'alerts.json'))
    ? path.join(DATA_DIR, 'alerts.json')
    : path.join(process.cwd(), 'alerts.json');

function loadAlerts() {
    try {
        if (fs.existsSync(ALERTS_CONFIG_PATH)) {
            const data = JSON.parse(fs.readFileSync(ALERTS_CONFIG_PATH, 'utf-8'));
            const rules = data.alerts || [];
            // Merge with in-memory lastFired state
            alertRules = rules.map((r: AlertRule) => ({
                ...r,
                lastFiredAt: alertLastFired[r.id]
            }));
            console.log(`[Alerts] Loaded ${alertRules.length} rules`);
            // Broadcast updated rules to all clients
            io.emit('alertRulesUpdate', alertRules);
        }
    } catch (err) {
        console.error('[Alerts] Failed to load alerts.json:', err);
    }
}

loadAlerts();

// Watch for changes to alerts.json
fs.watch(ALERTS_CONFIG_PATH, (event) => {
    if (event === 'change') {
        console.log('[Alerts] alerts.json changed, reloading...');
        loadAlerts();
    }
});

async function evaluateAlerts() {
    const now = Date.now();
    const users = Object.values(activeUsers);
    const totalUsers = users.length;

    // Calculate room occupancy
    const roomOccupancy: Record<string, number> = {};
    for (const user of users) {
        const room = roomConfig.rooms.find((r: { name: string, id: string }) => r.name === user.activeRoom);
        const roomId = room?.id || 'unknown';
        roomOccupancy[roomId] = (roomOccupancy[roomId] || 0) + 1;
    }

    // Calculate conversion rate
    // If KPI events configured, use total KPI count; otherwise fall back to checkout room occupancy
    const totalKpiHits = Object.values(kpiCounts).reduce((a, b) => a + b, 0);
    const conversionNumerator = kpiEvents.length > 0 ? totalKpiHits : (roomOccupancy['checkout'] || 0);
    const conversionRate = totalUsers > 0 ? (conversionNumerator / totalUsers) * 100 : 0;

    for (const rule of alertRules) {
        if (!rule.enabled) continue;

        // Check cooldown
        if (alertLastFired[rule.id] && (now - alertLastFired[rule.id]) < rule.cooldownMs) {
            continue;
        }

        let triggered = false;
        let currentValue = 0;
        let message = '';

        if (rule.condition.type === 'total_users') {
            currentValue = totalUsers;
            triggered = compare(currentValue, rule.condition.operator, rule.condition.value);
            message = `Total users: ${currentValue} (threshold: ${rule.condition.value})`;
        } else if (rule.condition.type === 'room_occupancy' && rule.condition.room) {
            currentValue = roomOccupancy[rule.condition.room] || 0;
            const roomLabel = ROOM_COORDS[rule.condition.room]?.label || rule.condition.room;
            triggered = compare(currentValue, rule.condition.operator, rule.condition.value);
            message = `${roomLabel} has ${currentValue} active users (threshold: ${rule.condition.value})`;
        } else if (rule.condition.type === 'conversion_rate') {
            currentValue = conversionRate;
            triggered = compare(currentValue, rule.condition.operator, rule.condition.value);
            message = `Conversion rate is ${currentValue.toFixed(1)}% (threshold: ${rule.condition.value}%)`;
        }

        if (triggered) {
            alertLastFired[rule.id] = now;
            rule.lastFiredAt = now;
            console.log(`[Alerts] TRIGGERED: ${rule.name} - ${message}`);

            // Broadcast updated rule status (lastFiredAt)
            io.emit('alertRulesUpdate', alertRules);

            const alertPayload = {
                id: rule.id,
                name: rule.name,
                message,
                condition: rule.condition,
                timestamp: now
            };

            // Action: Browser (Socket.io)
            if (rule.actions.includes('browser')) {
                io.emit('alert_triggered', alertPayload);
            }

            // Action: Webhook
            if (rule.actions.includes('webhook') && rule.webhookUrl) {
                const webhookPayload = {
                    alert: rule.id,
                    message,
                    timestamp: now,
                    roomCounts: roomOccupancy,
                    totalUsers
                };

                fetch(rule.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(webhookPayload)
                }).catch(err => {
                    if (err instanceof Error) {
                        console.error(`[Alerts] Webhook failed for ${rule.id}:`, err.message);
                    }
                });
            }
        }
    }
}

function compare(val: number, op: string, threshold: number): boolean {
    switch (op) {
        case 'gt': return val > threshold;
        case 'gte': return val >= threshold;
        case 'lt': return val < threshold;
        case 'lte': return val <= threshold;
        default: return false;
    }
}

// ─── State storage ──────────────────────────────────────────────────────────

const activeUsers: Record<string, any> = {};
const userHistory: Record<string, any[]> = {};
const EVENTS_LOG_PATH = path.join(process.cwd(), 'events.log');
const MAX_LOG_LINES = 100000;
let logLineCount = 0;

// Initialize log line count
if (fs.existsSync(EVENTS_LOG_PATH)) {
    const content = fs.readFileSync(EVENTS_LOG_PATH, 'utf8');
    logLineCount = content.split('\n').filter(line => line.trim()).length;
}

function rotateLogIfNeeded() {
    if (logLineCount >= MAX_LOG_LINES) {
        console.log('[Log] Rotating events.log...');
        const lines = fs.readFileSync(EVENTS_LOG_PATH, 'utf8').split('\n').filter(line => line.trim());
        const keepCount = Math.floor(MAX_LOG_LINES * 0.9);
        const newLines = lines.slice(lines.length - keepCount);
        fs.writeFileSync(EVENTS_LOG_PATH, newLines.join('\n') + '\n');
        logLineCount = newLines.length;
    }
}

function persistEvent(userState: any) {
    rotateLogIfNeeded();
    const entry = JSON.stringify({
        timestamp: Date.now(),
        ...userState
    });
    fs.appendFileSync(EVENTS_LOG_PATH, entry + '\n');
    logLineCount++;
}

// ─── WebSocket connections ──────────────────────────────────────────────────

io.on('connection', (socket) => {
    console.log('Frontend client connected:', socket.id);

    socket.emit('gameState', Object.values(activeUsers));
    socket.emit('allHistory', userHistory);
    socket.emit('alertRulesUpdate', alertRules);
    socket.emit('kpiConfig', kpiEvents);
    socket.emit('kpiCounts', kpiCounts);

    socket.on('alertRuleToggle', ({ id, enabled }: { id: string, enabled: boolean }) => {
        const rule = alertRules.find(r => r.id === id);
        if (rule) {
            rule.enabled = enabled;
            console.log(`[Alerts] Rule '${rule.name}' ${enabled ? 'enabled' : 'disabled'} via client`);
            io.emit('alertRulesUpdate', alertRules);
        }
    });

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

    // Detect KPI events
    const isKpiEvent = kpiEventNames.has(event);
    if (isKpiEvent) {
        kpiCounts[event] = (kpiCounts[event] || 0) + 1;
    }
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

    // Persist event to log
    persistEvent(activeUsers[userId]);

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

    // Evaluate alerts after state update
    evaluateAlerts();

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

    // Emit KPI event
    if (isKpiEvent) {
        const kpiLabel = kpiEvents.find(e => e.name === event)?.label || event;
        io.emit('kpiEvent', {
            id: `kpi_${userId}_${Date.now()}`,
            userId,
            userName: name,
            eventName: event,
            eventLabel: kpiLabel,
            color: userColor,
            time: new Date().toLocaleTimeString()
        });
        io.emit('kpiCounts', kpiCounts);
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
    res.json({ ...roomConfig, kpiEvents });
});

// Replay metadata
app.get('/api/replay/range', (_req, res) => {
    if (!fs.existsSync(EVENTS_LOG_PATH)) {
        return res.json({ earliest: 0, latest: 0, count: 0 });
    }
    const lines = fs.readFileSync(EVENTS_LOG_PATH, 'utf8').split('\n').filter(line => line.trim());
    if (lines.length === 0) {
        return res.json({ earliest: 0, latest: 0, count: 0 });
    }
    const first = JSON.parse(lines[0]);
    const last = JSON.parse(lines[lines.length - 1]);
    res.json({
        earliest: first.timestamp,
        latest: last.timestamp,
        count: lines.length
    });
});

// Replay events
app.get('/api/replay/events', (req, res) => {
    if (!fs.existsSync(EVENTS_LOG_PATH)) {
        return res.json([]);
    }
    const { from, to } = req.query;
    const fromTs = from ? parseInt(from as string) : 0;
    const toTs = to ? parseInt(to as string) : Date.now();

    const lines = fs.readFileSync(EVENTS_LOG_PATH, 'utf8').split('\n').filter(line => line.trim());
    const events = lines
        .map(line => JSON.parse(line))
        .filter(event => event.timestamp >= fromTs && event.timestamp <= toTs)
        .sort((a, b) => a.timestamp - b.timestamp);

    res.json(events);
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

    const { event, properties } = parsedBody;

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
        const expected = Buffer.from(`Bearer ${OTEL_BEARER_TOKEN}`);
        const actual = Buffer.from(authHeader ?? '');
        if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    const { resourceSpans } = req.body;
    if (!resourceSpans || !Array.isArray(resourceSpans)) {
        return res.status(200).json({});
    }

    try {
        for (const rs of resourceSpans) {
            const resourceAttrs: Record<string, any> = {};
            if (rs.resource?.attributes) {
                for (const attr of rs.resource.attributes) {
                    const val = attr.value ?? {};
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
                                    const val = attr.value ?? {};
                                    spanAttrs[attr.key] = val.stringValue ?? val.intValue ?? val.boolValue ?? val.doubleValue;
                                }
                            }

                            const traceId = span.traceId;
                            const userId = spanAttrs['user.id'] || spanAttrs['enduser.id'] || resourceAttrs['user.id'] || resourceAttrs['enduser.id'] || traceId;
                            if (!spanAttrs['user.id'] && !spanAttrs['enduser.id'] && !resourceAttrs['user.id'] && !resourceAttrs['enduser.id']) {
                                console.debug(`[OTel] No user.id found in span or resource attributes — falling back to traceId: ${traceId}`);
                            }
                            const userName = spanAttrs['user.name'] || spanAttrs['enduser.name'] || resourceAttrs['user.name'] || resourceAttrs['enduser.name'] || (traceId ? traceId.substring(0, 6) : 'Unknown');
                            const url = spanAttrs['http.url'] || spanAttrs['url.full'] || spanAttrs['http.target'] || spanAttrs['url.path'] || '';
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
    } catch (err) {
        console.error('[OTel] Failed to process trace payload:', err);
        return res.status(400).json({ error: 'Invalid trace payload' });
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
