require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { query } = require('../shared/db');

const app = express();
const PORT = process.env.PORT || 3000;

// FIX: Restrict CORS to the configured webapp URL instead of wildcard
const allowedOrigins = [
    process.env.WEBAPP_URL,
    'http://localhost:3000',
    'http://localhost:5000'
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. Telegram WebApp, mobile)
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// FIX: Simple in-memory rate limiter — no extra dependencies needed
const requestLog = new Map();
const RATE_LIMIT_MAX = 15;       // max requests per window per IP
const RATE_LIMIT_WINDOW = 60000; // 1 minute window in ms

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requestLog.entries()) {
        const recent = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);
        if (recent.length === 0) requestLog.delete(ip);
        else requestLog.set(ip, recent);
    }
}, 5 * 60 * 1000);

function rateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const timestamps = (requestLog.get(ip) || []).filter(ts => now - ts < RATE_LIMIT_WINDOW);
    timestamps.push(now);
    requestLog.set(ip, timestamps);

    if (timestamps.length > RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
    }
    next();
}

// Apply rate limiter to all API routes
app.use('/api', rateLimiter);

// Serve Presentation assets and HTML
app.use('/assets', express.static(path.join(__dirname, '../../assets')));
app.get('/presentation', (req, res) => {
    res.sendFile(path.join(__dirname, '../../PRESENTACION.html'));
});

// GET /api/clubs — returns all verified clubs
app.get('/api/clubs', async (req, res) => {
    try {
        const clubsRes = await query("SELECT * FROM clubs WHERE status = 'verified' ORDER BY verified_at DESC");
        res.json(clubsRes.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch clubs" });
    }
});

// FIX: Normalize country to ISO code on intake so it matches the bot's format
const COUNTRY_CODE_MAP = {
    'ES': 'ES', 'Spain': 'ES', 'España': 'ES',
    'DE': 'DE', 'Germany': 'DE', 'Alemania': 'DE',
    'NL': 'NL', 'Netherlands': 'NL', 'Países Bajos': 'NL'
};

app.post('/api/verify', async (req, res) => {
    const { name, city, country, telegram_username, instagram, description } = req.body;

    if (!name || !city || !country || !telegram_username) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate @username format
    if (!telegram_username.startsWith('@')) {
        return res.status(400).json({ error: "telegram_username must start with @" });
    }

    // FIX: Normalize country code
    const normalizedCountry = COUNTRY_CODE_MAP[country] || country.toUpperCase().slice(0, 2);

    try {
        await query(
            "INSERT INTO clubs (name, city, country, telegram_username, instagram, description, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [name, city, normalizedCountry, telegram_username, instagram || null, description || null, 'pending']
        );
        res.json({ success: true, message: "Request received!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to submit request" });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Mini App Server running at http://localhost:${PORT}`);
});
