import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

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

// Simple state storage
const activeUsers: Record<string, any> = {};

io.on('connection', (socket) => {
    console.log('Frontend client connected:', socket.id);

    // Send current state to new clients
    socket.emit('gameState', Object.values(activeUsers));

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Room coordinate map - must match the frontend GameMap ROOMS
const ROOM_COORDS: Record<string, { x: number, y: number, w: number, h: number, label: string }> = {
    login: { x: 2, y: 2, w: 6, h: 4, label: 'Login Portal' },
    home: { x: 10, y: 2, w: 8, h: 6, label: 'Landing Page' },
    products: { x: 10, y: 10, w: 8, h: 6, label: 'Product Catalog' },
    checkout: { x: 24, y: 10, w: 6, h: 6, label: 'Checkout Arena' },
    about: { x: 2, y: 10, w: 6, h: 4, label: 'About Us' },
    // Sub-rooms (positioned relative to parent in frontend, but need absolute coords for avatar placement)
    products_filters: { x: 18.5, y: 10, w: 4, h: 3, label: 'Filter Panel' },
    products_quickview: { x: 10, y: 16.5, w: 5, h: 3, label: 'Quick View' },
    checkout_payment: { x: 24, y: 16.5, w: 4, h: 3, label: 'Payment Form' },
};

function getRandomPositionInRoom(roomId: string) {
    const room = ROOM_COORDS[roomId] || ROOM_COORDS['login'];
    const pad = 1; // padding so avatars don't sit on the wall edge
    return {
        x: room.x + pad + Math.random() * (room.w - pad * 2),
        y: room.y + pad + Math.random() * (room.h - pad * 2)
    };
}

// API endpoint mimicking PostHog ingest / custom webhook
app.post('/api/events', (req, res) => {
    const { event, properties, timestamp } = req.body;

    if (!properties || !properties.distinct_id) {
        return res.status(400).json({ error: 'Missing properties.distinct_id' });
    }

    const userId = properties.distinct_id;
    const url = properties.$current_url || '';
    const name = properties.name || `User-${userId.substring(0, 4)}`;

    // Map URL paths to room IDs
    let room = 'login';
    if (url.includes('checkout')) room = 'checkout';
    else if (url.includes('products')) room = 'products';
    else if (url.includes('about')) room = 'about';
    else if (url === 'https://usertelemetryviewer.com/') room = 'home';
    else if (url.includes('login')) room = 'login';

    // Detect sub-room events (take priority over parent room)
    if (event === 'drawer_opened' && properties.drawer === 'filters') room = 'products_filters';
    else if (event === 'modal_opened' && properties.modal === 'quick_view') room = 'products_quickview';
    else if (event === 'form_focused' && properties.form === 'payment') room = 'checkout_payment';

    // Detect purchase events
    const isPurchase = event === 'order_completed' || event === '$purchase';
    const purchaseAmount = isPurchase ? (properties.$amount || properties.revenue || 0) : undefined;
    const isSubRoom = event === 'drawer_opened' || event === 'modal_opened' || event === 'form_focused';
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
    const roomInfo = ROOM_COORDS[room] || ROOM_COORDS['login'];

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

    // Broadcast the update to all connected React clients
    io.emit('userUpdate', activeUsers[userId]);

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

// Clean up stale users (no activity for 2 minutes)
setInterval(() => {
    const now = Date.now();
    let changed = false;

    Object.keys(activeUsers).forEach(id => {
        if (now - activeUsers[id].lastUpdate > 120000) {
            delete activeUsers[id];
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
