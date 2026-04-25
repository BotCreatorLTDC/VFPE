require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { query } = require('../shared/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Security secret for the admin web panel
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'vfpe_admin_2024';

const allowedOrigins = [
    process.env.WEBAPP_URL,
    'https://vfpe.onrender.com',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:10000'
].filter(Boolean).map(url => url.replace(/\/$/, ""));

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const originClean = origin.replace(/\/$/, "");
        if (allowedOrigins.includes(originClean)) return callback(null, true);
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
    },
    optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to protect admin routes
function adminAuth(req, res, next) {
    const secret = req.headers['x-admin-secret'] || req.query.secret;
    if (secret !== ADMIN_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Invalid Admin Secret' });
    }
    next();
}

// Serve Presentation assets and HTML
app.use('/assets', express.static(path.join(__dirname, '../../assets')));
app.get('/presentation', (req, res) => {
    res.sendFile(path.join(__dirname, '../../PRESENTACION.html'));
});

// --- PUBLIC API ---

app.get('/api/clubs', async (req, res) => {
    try {
        const clubsRes = await query("SELECT * FROM clubs WHERE status = 'verified' ORDER BY verified_at DESC");
        res.json(clubsRes.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch clubs" });
    }
});

app.post('/api/verify', async (req, res) => {
    const { name, city, country, telegram_username, instagram, description } = req.body;
    if (!name || !city || !country || !telegram_username) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    if (!telegram_username.startsWith('@')) {
        return res.status(400).json({ error: "telegram_username must start with @" });
    }
    const COUNTRY_CODE_MAP = { 'Spain': 'ES', 'España': 'ES', 'Germany': 'DE', 'Alemania': 'DE', 'Netherlands': 'NL' };
    const normalizedCountry = COUNTRY_CODE_MAP[country] || country.toUpperCase().slice(0, 2);

    try {
        await query(
            "INSERT INTO clubs (name, city, country, telegram_username, instagram, description, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [name, city, normalizedCountry, telegram_username, instagram || null, description || null, 'pending']
        );
        res.json({ success: true, message: "Request received!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to submit request" });
    }
});

// --- ADMIN API ---

// GET all clubs for management
app.get('/api/admin/clubs', adminAuth, async (req, res) => {
    try {
        const result = await query("SELECT * FROM clubs ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch all clubs" });
    }
});

// UPDATE club status (approve/reject) or DELETE
app.post('/api/admin/action', adminAuth, async (req, res) => {
    const { id, action } = req.body; // action: 'approve', 'reject', 'delete'
    
    try {
        if (action === 'approve') {
            await query("UPDATE clubs SET status = 'verified', verified_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
        } else if (action === 'reject') {
            await query("UPDATE clubs SET status = 'rejected' WHERE id = $1", [id]);
        } else if (action === 'delete') {
            await query("DELETE FROM clubs WHERE id = $1", [id]);
        } else {
            return res.status(400).json({ error: "Invalid action" });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Action failed" });
    }
});

app.listen(PORT, () => {
    console.log(`VFPE Server running at http://localhost:${PORT}`);
});
