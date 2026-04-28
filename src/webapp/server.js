require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios'); // For Telegram Bot API
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
app.use('/assets', express.static(path.join(__dirname, '../../assets')));

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
    const { name, city, country, telegram_username, instagram, description, tg_user_id } = req.body;
    if (!name || !city || !country || !telegram_username) return res.status(400).json({ error: "Missing fields" });
    
    const COUNTRY_CODE_MAP = { 'Spain': 'ES', 'España': 'ES', 'Germany': 'DE', 'Netherlands': 'NL' };
    const normalizedCountry = COUNTRY_CODE_MAP[country] || country.toUpperCase().slice(0, 2);

    try {
        await query(
            "INSERT INTO clubs (name, city, country, telegram_username, instagram, description, status, tg_user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            [name, city, normalizedCountry, telegram_username, instagram || null, description || null, 'pending', tg_user_id || null]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

// NEW: Endpoint to save the selected plan from pricing.html
app.post('/api/select-plan', async (req, res) => {
    const { username, plan } = req.body;
    if (!username || !plan) return res.status(400).json({ error: "Missing parameters" });

    const tgUser = username.startsWith('@') ? username : `@${username}`;

    try {
        await query(
            "UPDATE clubs SET selected_plan = $1 WHERE telegram_username = $2 AND status = 'pending'",
            [plan, tgUser]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Error saving plan:", err);
        res.status(500).json({ error: "Failed to save plan" });
    }
});

// --- CLUB OWNER SELF-MANAGEMENT ---

// GET my club data based on TG username
app.get('/api/my-club', async (req, res) => {
    const username = req.query.username; // Should be verified via initData in production
    if (!username) return res.status(400).json({ error: "No username provided" });

    const tgUser = username.startsWith('@') ? username : `@${username}`;

    try {
        const result = await query("SELECT * FROM clubs WHERE telegram_username = $1 AND status = 'verified'", [tgUser]);
        if (result.rows.length === 0) return res.status(404).json({ error: "No verified club found for this user" });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// UPDATE my club data
app.post('/api/my-club/update', async (req, res) => {
    const { id, username, instagram, description, event_message } = req.body;
    
    // Security: Check if the username matches the club's owner
    const tgUser = username.startsWith('@') ? username : `@${username}`;
    
    try {
        const check = await query("SELECT id FROM clubs WHERE id = $1 AND telegram_username = $2", [id, tgUser]);
        if (check.rows.length === 0) return res.status(403).json({ error: "Unauthorized" });

        if (event_message && event_message.trim() !== '') {
            await query(
                "UPDATE clubs SET instagram = $1, description = $2, event_message = $3, event_expires_at = CURRENT_TIMESTAMP + interval '24 hours' WHERE id = $4",
                [instagram || null, description || null, event_message.substring(0, 50), id]
            );
        } else {
            await query(
                "UPDATE clubs SET instagram = $1, description = $2, event_message = NULL, event_expires_at = NULL WHERE id = $3",
                [instagram || null, description || null, id]
            );
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
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
        if (action === 'accept') {
            // STEP 1: Accept the application (not published yet) and send Wallet to User
            const clubRes = await query("UPDATE clubs SET status = 'accepted' WHERE id = $1 RETURNING *", [id]);
            const club = clubRes.rows[0];

            // Send Telegram Message
            if (club && club.tg_user_id && process.env.MAIN_BOT_TOKEN) {
                const planStr = club.selected_plan ? `Plan ${club.selected_plan}` : "Plan Básico";
                const priceMap = { 'Basic': '50€', 'PRO': '80€', 'Advanced': '100€' };
                const priceStr = priceMap[club.selected_plan] || '50€';
                
                const message = `¡Enhorabuena! Tu solicitud para el club *${club.name}* ha sido pre-aprobada para el *${planStr}*.\n\nPara proceder a la publicación oficial en el directorio, por favor realiza el pago de *${priceStr}* a la siguiente billetera de criptomonedas (USDT TRC20):\n\n\`[TU_BILLETERA_AQUI]\`\n\nUna vez confirmado el pago, tu club será publicado de inmediato.`;
                
                await axios.post(`https://api.telegram.org/bot${process.env.MAIN_BOT_TOKEN}/sendMessage`, {
                    chat_id: club.tg_user_id,
                    text: message,
                    parse_mode: 'Markdown'
                }).catch(err => console.error("Error sending TG message:", err.response?.data || err.message));
            }
        } 
        else if (action === 'publish') {
            // STEP 2: Publish the application (verified) and grant 30 days subscription
            const clubRes = await query(
                "UPDATE clubs SET status = 'verified', verified_at = CURRENT_TIMESTAMP, subscription_expires_at = CURRENT_TIMESTAMP + interval '30 days' WHERE id = $1 RETURNING *", 
                [id]
            );
            const club = clubRes.rows[0];

            // Official Channel Broadcast (if Advanced or PRO)
            if (club && (club.selected_plan === 'Advanced' || club.selected_plan === 'PRO') && process.env.CHANNEL_ID && process.env.MAIN_BOT_TOKEN) {
                const isAdv = club.selected_plan === 'Advanced';
                const channelMsg = `🔥 *¡Nuevo Plug ${isAdv ? 'Premium ' : ''}Verificado en ${club.city}!*\n\n` +
                                   `${isAdv ? '🏆' : '✅'} *${club.name}*\n` +
                                   `📍 Ubicación: ${club.city}, ${club.country}\n` +
                                   `💬 Contacto: ${club.telegram_username}\n\n` +
                                   `🔗 _¡Abre la Mini App de VFPE para ver más detalles y localizar este club en el mapa!_`;
                
                await axios.post(`https://api.telegram.org/bot${process.env.MAIN_BOT_TOKEN}/sendMessage`, {
                    chat_id: process.env.CHANNEL_ID,
                    text: channelMsg,
                    parse_mode: 'Markdown'
                }).catch(err => console.error("Error broadcast channel:", err.message));
            }
        }
        else if (action === 'approve') await query("UPDATE clubs SET status = 'verified', verified_at = CURRENT_TIMESTAMP WHERE id = $1", [id]); // Legacy compatibility
        else if (action === 'reject') await query("UPDATE clubs SET status = 'rejected' WHERE id = $1", [id]);
        else if (action === 'delete') await query("DELETE FROM clubs WHERE id = $1", [id]);
        else if (action === 'promote') await query("UPDATE clubs SET is_premium = NOT is_premium WHERE id = $1", [id]); // Toggle premium
        else return res.status(400).json({ error: "Invalid action" });
        res.json({ success: true });
    } catch (err) {
        console.error("Action error:", err);
        res.status(500).json({ error: "Failed" });
    }
});

// FULL UPDATE for Admins
app.post('/api/admin/update', adminAuth, async (req, res) => {
    const { id, name, city, country, telegram_username, instagram, description } = req.body;
    
    try {
        await query(
            "UPDATE clubs SET name = $1, city = $2, country = $3, telegram_username = $4, instagram = $5, description = $6 WHERE id = $7",
            [name, city, country, telegram_username, instagram || null, description || null, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Admin update failed" });
    }
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`VFPE Server running at http://localhost:${PORT}`);
});
