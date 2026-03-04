import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ENDPOINT = 'http://localhost:3001/api/events';
const DOMAIN = 'https://usertelemetryviewer.com';

// Load room config
const roomConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'rooms.json'), 'utf-8'));

// Build PAGES list from room config
const PAGES = roomConfig.rooms.map(room => {
    const pattern = room.urlPatterns?.[0] || '/';
    return `${DOMAIN}${pattern === '/' ? '/' : pattern}`;
});

// Build sub-room events from config
const SUB_ROOM_EVENTS = {};
for (const room of roomConfig.rooms) {
    if (room.subRooms) {
        const pageUrl = PAGES.find(p => room.urlPatterns?.some(pat => p.includes(pat)));
        if (pageUrl) {
            SUB_ROOM_EVENTS[room.id] = room.subRooms
                .filter(sub => sub.eventType && sub.eventMatch)
                .map(sub => ({ event: sub.eventType, props: sub.eventMatch }));
        }
    }
}

const PRODUCTS = [
    { name: 'Pro Dashboard License', price: 49.99 },
    { name: 'Team Plan (Annual)', price: 199.99 },
    { name: 'Enterprise Addon', price: 299.99 },
    { name: 'Starter Kit', price: 9.99 },
    { name: 'Analytics Widget Pack', price: 29.99 },
    { name: 'Custom Integration', price: 149.99 },
];

// Generate 4 persistent mock users
const MOCK_USERS = Array.from({ length: 4 }).map((_, i) => ({
    distinct_id: `cus_000${i + 1}_posthog`,
    properties: {
        $browser: ['Chrome', 'Safari', 'Firefox', 'Edge'][Math.floor(Math.random() * 4)],
        $os: ['Mac OS X', 'Windows', 'Linux', 'iOS'][Math.floor(Math.random() * 4)],
        name: `Synthetic User ${i + 1}`
    }
}));

function getRoomIdForUrl(url) {
    for (const room of roomConfig.rooms) {
        if (room.urlPatterns) {
            for (const pattern of room.urlPatterns) {
                if (room.urlExact && new URL(url).pathname === pattern) return room.id;
                if (!room.urlExact && url.includes(pattern)) return room.id;
            }
        }
    }
    return null;
}

async function sendPostHogEvent(user) {
    const url = PAGES[Math.floor(Math.random() * PAGES.length)];
    const roomId = getRoomIdForUrl(url);
    const isCheckoutPage = url.includes('checkout');

    // ~40% chance of purchase when on checkout page
    const isPurchase = isCheckoutPage && Math.random() < 0.4;

    // ~25% chance of sub-room event when on a page with sub-rooms
    const subRoomOptions = roomId ? SUB_ROOM_EVENTS[roomId] : null;
    const isSubRoom = !isPurchase && subRoomOptions && subRoomOptions.length > 0 && Math.random() < 0.25;

    const isPageView = !isPurchase && !isSubRoom && Math.random() > 0.3;

    let event, extraProps;

    if (isPurchase) {
        const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
        event = 'order_completed';
        extraProps = { $amount: product.price, product_name: product.name };
    } else if (isSubRoom) {
        const sub = subRoomOptions[Math.floor(Math.random() * subRoomOptions.length)];
        event = sub.event;
        extraProps = { ...sub.props };
    } else if (isPageView) {
        event = '$pageview';
        extraProps = {};
    } else {
        event = 'custom_interaction';
        extraProps = { interaction_type: ['click', 'scroll', 'hover'][Math.floor(Math.random() * 3)] };
    }

    const payload = {
        api_key: "phc_mock1234567890",
        event,
        properties: {
            distinct_id: user.distinct_id,
            $current_url: url,
            $lib: "web",
            ...user.properties,
            ...extraProps
        },
        timestamp: new Date().toISOString()
    };

    try {
        await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        let label;
        if (isPurchase) label = `order_completed ($${extraProps.$amount}) for ${user.properties.name}`;
        else if (isSubRoom) label = `${event} (${JSON.stringify(extraProps)}) for ${user.properties.name}`;
        else label = `${payload.event} for ${user.properties.name} on ${url}`;
        console.log(`[PostHog Mock] Sent ${label}`);
    } catch (err) {
        console.error(`Failed to send mock PostHog event:`, err.message);
    }
}

console.log(`Starting Synthetic PostHog Simulator (${PAGES.length} pages, ${Object.keys(SUB_ROOM_EVENTS).length} sub-room configs)`);
console.log('Webhooking to', ENDPOINT);

setInterval(() => {
    const user = MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)];
    sendPostHogEvent(user);
}, 3000);
