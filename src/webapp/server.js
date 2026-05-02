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

// Increment VIEW count
app.post('/api/clubs/view/:id', async (req, res) => {
    try {
        await query("UPDATE clubs SET view_count = view_count + 1 WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

// Submit a REPORT
app.post('/api/clubs/report/:id', async (req, res) => {
    const { reason, details, reporter_handle } = req.body;
    try {
        await query(
            "INSERT INTO reports (club_id, reason, details, reporter_handle) VALUES ($1, $2, $3, $4)",
            [req.params.id, reason, details || null, reporter_handle || null]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

// GET reviews for a club
app.get('/api/clubs/:id/reviews', async (req, res) => {
    try {
        const result = await query(
            "SELECT * FROM reviews WHERE club_id = $1 ORDER BY created_at DESC LIMIT 20",
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch reviews" });
    }
});

// POST a review for a club
app.post('/api/clubs/:id/review', async (req, res) => {
    const { rating, review_text, reviewer_handle } = req.body;
    const clubId = req.params.id;
    if (!rating || !reviewer_handle) return res.status(400).json({ error: "Missing fields" });

    try {
        await query(
            "INSERT INTO reviews (club_id, rating, review_text, reviewer_handle) VALUES ($1, $2, $3, $4)",
            [clubId, rating, review_text || null, reviewer_handle]
        );
        // Recalculate avg rating and count on the club
        await query(
            "UPDATE clubs SET rating_avg = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE club_id = $1), reviews_count = (SELECT COUNT(*) FROM reviews WHERE club_id = $1) WHERE id = $1",
            [clubId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Review error:', err);
        res.status(500).json({ error: "Failed to submit review" });
    }
});

// POST toggle like for a club (server-side persistence)
app.post('/api/clubs/:id/like', async (req, res) => {
    const { fingerprint } = req.body; // tg_user_id or localStorage UUID
    const clubId = req.params.id;
    if (!fingerprint) return res.status(400).json({ error: "Missing fingerprint" });

    try {
        // Check if already liked
        const existing = await query(
            "SELECT 1 FROM club_likes WHERE club_id = $1 AND user_fingerprint = $2",
            [clubId, fingerprint]
        );

        if (existing.rows.length > 0) {
            // Unlike
            await query("DELETE FROM club_likes WHERE club_id = $1 AND user_fingerprint = $2", [clubId, fingerprint]);
            await query("UPDATE clubs SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1", [clubId]);
            res.json({ liked: false });
        } else {
            // Like
            await query("INSERT INTO club_likes (club_id, user_fingerprint) VALUES ($1, $2)", [clubId, fingerprint]);
            await query("UPDATE clubs SET likes_count = likes_count + 1 WHERE id = $1", [clubId]);
            res.json({ liked: true });
        }
    } catch (err) {
        console.error('Like error:', err);
        res.status(500).json({ error: "Failed to toggle like" });
    }
});

app.post('/api/verify', async (req, res) => {
    const { name, city, country, telegram_username, instagram, description, tg_user_id, service_tags } = req.body;
    if (!name || !city || !country || !telegram_username) return res.status(400).json({ error: "Missing fields" });
    
    const COUNTRY_CODE_MAP = { 'Spain': 'ES', 'España': 'ES', 'Germany': 'DE', 'Netherlands': 'NL' };
    const normalizedCountry = COUNTRY_CODE_MAP[country] || country.toUpperCase().slice(0, 2);
    const tagsArray = Array.isArray(service_tags) ? service_tags : [];

    try {
        await query(
            "INSERT INTO clubs (name, city, country, telegram_username, instagram, description, status, tg_user_id, service_tags) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            [name, city, normalizedCountry, telegram_username, instagram || null, description || null, 'pending', tg_user_id || null, tagsArray]
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

// GET my club data based on TG username + stats
app.get('/api/my-club', async (req, res) => {
    const username = req.query.username;
    if (!username) return res.status(400).json({ error: "No username provided" });

    const tgUser = username.startsWith('@') ? username : `@${username}`;

    try {
        const result = await query("SELECT id, name, city, country, telegram_username, instagram, description, selected_plan, status, click_count, likes_count, view_count, service_tags FROM clubs WHERE telegram_username = $1 AND status = 'verified'", [tgUser]);
        if (result.rows.length === 0) return res.status(404).json({ error: "No verified club found" });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// UPDATE my club data
app.post('/api/my-club/update', async (req, res) => {
    const { id, username, instagram, description, event_message, service_tags, photo_url } = req.body;
    
    const tgUser = username.startsWith('@') ? username : `@${username}`;
    
    try {
        const check = await query("SELECT id, selected_plan FROM clubs WHERE id = $1 AND telegram_username = $2", [id, tgUser]);
        if (check.rows.length === 0) return res.status(403).json({ error: "Unauthorized" });

        const club = check.rows[0];
        const tagsArray = Array.isArray(service_tags) ? service_tags : [];
        
        // SECURITY: Only allow announcements for Advanced plan
        if (event_message && event_message.trim() !== '') {
            if (club.selected_plan !== 'Advanced') {
                return res.status(403).json({ error: "Feature reserved for Advanced plans" });
            }
            await query(
                "UPDATE clubs SET instagram = $1, description = $2, event_message = $3, event_expires_at = CURRENT_TIMESTAMP + interval '24 hours', service_tags = $5, photo_url = $6 WHERE id = $4",
                [instagram || null, description || null, event_message.substring(0, 50), id, tagsArray, photo_url || null]
            );
        } else {
            await query(
                "UPDATE clubs SET instagram = $1, description = $2, event_message = NULL, event_expires_at = NULL, service_tags = $4, photo_url = $5 WHERE id = $3",
                [instagram || null, description || null, id, tagsArray, photo_url || null]
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
                
                const message = `¡Enhorabuena! Tu solicitud para el club *${club.name}* ha sido pre-aprobada para el *${planStr}*.\n\n` +
                                `Para proceder a la publicación oficial, por favor realiza el pago de *${priceStr}* a cualquiera de las siguientes billeteras:\n\n` +
                                `🧡 *BTC:* \`bc1qds092w95zsfz6z6nr9axw6ccvt26rv8sz39czx\`\n` +
                                `💎 *ETH:* \`0xdc7668CC500161e8AA8e8808673E2c1aB5cC844b\`\n` +
                                `💵 *USDT (ERC20):* \`0xdc7668CC500161e8AA8e8808673E2c1aB5cC844b\`\n` +
                                `💙 *XRP:* \`rJFd2TUUFRGfBvDicg26o1JKoXi3yqGGAb\`\n` +
                                `🟣 *SOL:* \`6e4Cpahz2sHgCY6iYrpaAR5bkMorKZjk6AGzdaidBZ97\`\n\n` +
                                `Una vez realizado el pago, envía una captura del comprobante a soporte. Tu club será publicado de inmediato tras la confirmación.`;
                
                await axios.post(`https://api.telegram.org/bot${process.env.MAIN_BOT_TOKEN}/sendMessage`, {
                    chat_id: club.tg_user_id,
                    text: message,
                    parse_mode: 'Markdown'
                }).catch(err => console.error("Error sending TG message:", err.response?.data || err.message));
            }
        } 
        else if (action === 'publish') {
            // STEP 2: Publish the application (verified) and grant 30 days subscription
            // FIX: If plan is Advanced, automatically set is_premium = true
            const checkRes = await query("SELECT selected_plan FROM clubs WHERE id = $1", [id]);
            const currentPlan = checkRes.rows[0]?.selected_plan;
            const setPremium = (currentPlan === 'Advanced');

            const clubRes = await query(
                "UPDATE clubs SET status = 'verified', verified_at = CURRENT_TIMESTAMP, subscription_expires_at = CURRENT_TIMESTAMP + interval '30 days', is_premium = $2 WHERE id = $1 RETURNING *", 
                [id, setPremium]
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

            // Direct Message to Owner (Confirmation)
            if (club && club.tg_user_id && process.env.MAIN_BOT_TOKEN) {
                const ownerMsg = `✅ *¡Pago Confirmado y Club Publicado!*\n\nTu club *${club.name}* ya está activo en el directorio oficial de VFPE.\n\n📍 Ciudad: ${club.city}\n⭐ Plan: ${club.selected_plan || 'Básico'}\n📅 Suscripción hasta: ${new Date(club.subscription_expires_at).toLocaleDateString()}\n\n¡Gracias por confiar en VFPE!`;
                
                await axios.post(`https://api.telegram.org/bot${process.env.MAIN_BOT_TOKEN}/sendMessage`, {
                    chat_id: club.tg_user_id,
                    text: ownerMsg,
                    parse_mode: 'Markdown'
                }).catch(err => console.error("Error sending owner confirmation:", err.message));
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
    const { id, name, city, country, telegram_username, instagram, description, event_message, photo_url, service_tags } = req.body;
    
    try {
        const expiry = event_message ? "CURRENT_TIMESTAMP + interval '24 hours'" : "NULL";
        const tagsArray = Array.isArray(service_tags) ? service_tags : [];

        const queryStr = `UPDATE clubs 
            SET name = $1, city = $2, country = $3, telegram_username = $4, 
                instagram = $5, description = $6, 
                event_message = $8, event_expires_at = ${expiry},
                photo_url = $9, service_tags = $10
            WHERE id = $7`;

        await query(queryStr, [
            name, city, country, telegram_username,
            instagram || null, description || null, id,
            event_message || null, photo_url || null, tagsArray
        ]);
        res.json({ success: true });
    } catch (err) {
        console.error("Update error:", err);
        res.status(500).json({ error: "Failed" });
    }
});

// GET ALL REPORTS
app.get('/api/admin/reports', adminAuth, async (req, res) => {
    try {
        const result = await query(`
            SELECT r.*, c.name as club_name 
            FROM reports r 
            JOIN clubs c ON r.club_id = c.id 
            WHERE r.status = 'pending'
            ORDER BY r.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

// RESOLVE REPORT
app.post('/api/admin/report-action', adminAuth, async (req, res) => {
    const { id, action } = req.body;
    try {
        const status = action === 'dismiss' ? 'dismissed' : 'resolved';
        await query("UPDATE reports SET status = $1 WHERE id = $2", [status, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed" });
    }
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`VFPE Server running at http://localhost:${PORT}`);
});
