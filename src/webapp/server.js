require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { query } = require('../shared/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin IDs from environment
const ADMIN_IDS = (process.env.ADMIN_IDS || "").split(',').map(id => id.trim());

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
        callback(new Error('Not allowed by CORS'));
    },
    optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// FIX: Admin Auth based on Telegram User ID
function adminAuth(req, res, next) {
    const userId = req.headers['x-admin-id'] || req.query.admin_id;
    if (!userId || !ADMIN_IDS.includes(userId.toString())) {
        console.warn(`[AdminAuth] Unauthorized access attempt from ID: ${userId}`);
        return res.status(401).json({ error: 'Unauthorized: You are not an admin.' });
    }
    next();
}

// --- PUBLIC API ---

app.get('/api/clubs', async (req, res) => {
    try {
        // Priority to premium clubs
        const clubsRes = await query("SELECT * FROM clubs WHERE status = 'verified' ORDER BY is_premium DESC, verified_at DESC");
        res.json(clubsRes.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch clubs" });
    }
});

app.post('/api/clubs/click/:id', async (req, res) => {
    try {
        await query("UPDATE clubs SET click_count = click_count + 1 WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to log click" });
    }
});

app.post('/api/verify', async (req, res) => {
    const { name, city, country, telegram_username, instagram, description } = req.body;
    if (!name || !city || !country || !telegram_username) return res.status(400).json({ error: "Missing fields" });
    
    const COUNTRY_CODE_MAP = { 'Spain': 'ES', 'España': 'ES', 'Germany': 'DE', 'Netherlands': 'NL' };
    const normalizedCountry = COUNTRY_CODE_MAP[country] || country.toUpperCase().slice(0, 2);

    try {
        await query(
            "INSERT INTO clubs (name, city, country, telegram_username, instagram, description, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [name, city, normalizedCountry, telegram_username, instagram || null, description || null, 'pending']
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

// --- ADMIN API ---

app.get('/api/admin/clubs', adminAuth, async (req, res) => {
    try {
        const result = await query("SELECT * FROM clubs ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

// NEW: Analytics endpoint
app.get('/api/admin/analytics', adminAuth, async (req, res) => {
    try {
        const totalClubs = await query("SELECT COUNT(*) FROM clubs");
        const totalClicks = await query("SELECT SUM(click_count) FROM clubs");
        const topCities = await query("SELECT city, COUNT(*) as count FROM clubs GROUP BY city ORDER BY count DESC LIMIT 5");
        const topClubs = await query("SELECT name, click_count FROM clubs WHERE click_count > 0 ORDER BY click_count DESC LIMIT 5");

        res.json({
            total: totalClubs.rows[0].count,
            clicks: totalClicks.rows[0].sum || 0,
            topCities: topCities.rows,
            topClubs: topClubs.rows
        });
    } catch (err) {
        res.status(500).json({ error: "Analytics failed" });
    }
});

app.post('/api/admin/action', adminAuth, async (req, res) => {
    const { id, action } = req.body;
    try {
        if (action === 'approve') await query("UPDATE clubs SET status = 'verified', verified_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
        else if (action === 'reject') await query("UPDATE clubs SET status = 'rejected' WHERE id = $1", [id]);
        else if (action === 'delete') await query("DELETE FROM clubs WHERE id = $1", [id]);
        else if (action === 'promote') await query("UPDATE clubs SET is_premium = NOT is_premium WHERE id = $1", [id]); // Toggle premium
        else return res.status(400).json({ error: "Invalid action" });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

app.listen(PORT, () => console.log(`Server running at ${PORT}`));
