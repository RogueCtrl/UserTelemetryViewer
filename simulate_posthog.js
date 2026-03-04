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

// Generate 4 persistent mock users mimicking real PostHog distinct IDs
const MOCK_USERS = Array.from({ length: 4 }).map((_, i) => ({
    distinct_id: `cus_000${i + 1}_posthog`,
    properties: {
        $browser: ['Chrome', 'Safari', 'Firefox', 'Edge'][Math.floor(Math.random() * 4)],
        $os: ['Mac OS X', 'Windows', 'Linux', 'iOS'][Math.floor(Math.random() * 4)],
        name: `Synthetic User ${i + 1}`
    }
}));

async function sendPostHogEvent(user) {
    const isPageView = Math.random() > 0.3;
    const url = PAGES[Math.floor(Math.random() * PAGES.length)];

    // Create a synthetic PostHog payload
    const payload = {
        api_key: "phc_mock1234567890",
        event: isPageView ? "$pageview" : "custom_interaction",
        properties: {
            distinct_id: user.distinct_id,
            $current_url: url,
            $lib: "web",
            ...user.properties,
            ...(isPageView ? {} : { interaction_type: ['click', 'scroll', 'hover'][Math.floor(Math.random() * 3)] })
        },
        timestamp: new Date().toISOString()
    };

    try {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log(`[PostHog Mock] Sent ${payload.event} for ${user.properties.name} on ${url}`);
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
