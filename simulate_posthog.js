import fetch from 'node-fetch';

const ENDPOINT = 'http://localhost:3001/api/events';

// Typical pages on our site
const PAGES = [
    'https://usertelemetryviewer.com/login',
    'https://usertelemetryviewer.com/',
    'https://usertelemetryviewer.com/products/dashboard',
    'https://usertelemetryviewer.com/checkout',
    'https://usertelemetryviewer.com/about'
];

const PRODUCTS = [
    { name: 'Pro Dashboard License', price: 49.99 },
    { name: 'Team Plan (Annual)', price: 199.99 },
    { name: 'Enterprise Addon', price: 299.99 },
    { name: 'Starter Kit', price: 9.99 },
    { name: 'Analytics Widget Pack', price: 29.99 },
    { name: 'Custom Integration', price: 149.99 },
];

// Sub-room events mapped to their parent pages
const SUB_ROOM_EVENTS = {
    'products': [
        { event: 'drawer_opened', props: { drawer: 'filters' } },
        { event: 'modal_opened', props: { modal: 'quick_view' } },
    ],
    'checkout': [
        { event: 'form_focused', props: { form: 'payment' } },
    ],
};

// Generate 4 persistent mock users mimicking real PostHog distinct IDs
const MOCK_USERS = Array.from({ length: 4 }).map((_, i) => ({
    distinct_id: `cus_000${i + 1}_posthog`,
    properties: {
        $browser: ['Chrome', 'Safari', 'Firefox', 'Edge'][Math.floor(Math.random() * 4)],
        $os: ['Mac OS X', 'Windows', 'Linux', 'iOS'][Math.floor(Math.random() * 4)],
        name: `Synthetic User ${i + 1}`
    }
}));

function getPageKey(url) {
    if (url.includes('checkout')) return 'checkout';
    if (url.includes('products')) return 'products';
    return null;
}

async function sendPostHogEvent(user) {
    const url = PAGES[Math.floor(Math.random() * PAGES.length)];
    const isCheckoutPage = url.includes('checkout');
    const pageKey = getPageKey(url);

    // ~40% chance of purchase when on checkout page
    const isPurchase = isCheckoutPage && Math.random() < 0.4;

    // ~25% chance of sub-room event when on a page that has sub-rooms
    const subRoomOptions = pageKey ? SUB_ROOM_EVENTS[pageKey] : null;
    const isSubRoom = !isPurchase && subRoomOptions && Math.random() < 0.25;

    const isPageView = !isPurchase && !isSubRoom && Math.random() > 0.3;

    let event, extraProps;

    if (isPurchase) {
        const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
        event = 'order_completed';
        extraProps = {
            $amount: product.price,
            product_name: product.name,
        };
    } else if (isSubRoom) {
        const subRoom = subRoomOptions[Math.floor(Math.random() * subRoomOptions.length)];
        event = subRoom.event;
        extraProps = { ...subRoom.props };
    } else if (isPageView) {
        event = '$pageview';
        extraProps = {};
    } else {
        event = 'custom_interaction';
        extraProps = {
            interaction_type: ['click', 'scroll', 'hover'][Math.floor(Math.random() * 3)]
        };
    }

    // Create a synthetic PostHog payload
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
        if (isPurchase) {
            label = `Sent order_completed ($${extraProps.$amount}) for ${user.properties.name}`;
        } else if (isSubRoom) {
            label = `Sent ${event} (${JSON.stringify(extraProps)}) for ${user.properties.name}`;
        } else {
            label = `Sent ${payload.event} for ${user.properties.name} on ${url}`;
        }
        console.log(`[PostHog Mock] ${label}`);
    } catch (err) {
        console.error(`Failed to send mock PostHog event:`, err.message);
    }
}

console.log('Starting Synthetic PostHog Simulator... Webhooking to', ENDPOINT);

// Every 3 seconds randomly send a PostHog event for a user
setInterval(() => {
    const user = MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)];
    sendPostHogEvent(user);
}, 3000);
