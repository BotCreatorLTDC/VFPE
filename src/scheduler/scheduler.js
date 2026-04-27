const cron = require('node-cron');
const https = require('https');
const http = require('http');
const { query } = require('../shared/db');

const WEBAPP_URL = process.env.WEBAPP_URL;
const COMMUNITY_GROUP_ID = process.env.COMMUNITY_GROUP_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

// FIX: Reuse the already-started bot instance instead of creating a duplicate
// This avoids double token connections and rate-limit conflicts
const bot = require('../bot/bot');

// Keep-alive ping to prevent Render from sleeping
if (WEBAPP_URL) {
    cron.schedule('* * * * *', () => {
        // FIX: Detect http vs https correctly
        const client = WEBAPP_URL.startsWith('https') ? https : http;
        client.get(WEBAPP_URL, (res) => {
            console.log(`[Auto-Ping] Status: ${res.statusCode} - Server Kept Alive`);
        }).on('error', (err) => {
            console.error('[Auto-Ping] Error:', err.message);
        });
    });
}

// Every 12 hours: bot reminder in community group
cron.schedule('0 */12 * * *', async () => {
    const msg = `🔍 *¿Buscas un club verificado?*\n\n` +
        `Usa @VerifyPlugEU_bot — encuentra clubes de cannabis social verificados en Madrid, Barcelona, y toda Europa.\n\n` +
        `✅ Contactos verificados únicamente. Sin scams.`;
    try {
        await bot.api.sendMessage(COMMUNITY_GROUP_ID, msg, { parse_mode: "Markdown" });
        console.log("Sent 12h bot reminder");
    } catch (err) {
        console.error("Scheduler error (12h):", err.message);
    }
});

// Every day at 12:00 PM: Subscription Reminder Bot (3 days before expiry)
cron.schedule('0 12 * * *', async () => {
    try {
        const expiringRes = await query(`
            SELECT name, tg_user_id, selected_plan 
            FROM clubs 
            WHERE status = 'verified' 
            AND subscription_expires_at BETWEEN CURRENT_TIMESTAMP + interval '3 days' AND CURRENT_TIMESTAMP + interval '4 days'
        `);
        
        for (const club of expiringRes.rows) {
            if (!club.tg_user_id) continue;
            const msg = `⚠️ *Aviso de Suscripción VFPE*\n\n` +
                `Hola, tu plan *${club.selected_plan || 'PRO'}* para el club *${club.name}* caduca en exactamente 3 días.\n\n` +
                `Por favor, realiza la renovación para no perder tu insignia y visibilidad premium en el mapa.\n` +
                `Contacta con el soporte para más detalles.`;
            
            try {
                // Sending message directly with axios or bot API depending on bot instance
                await bot.api.sendMessage(club.tg_user_id, msg, { parse_mode: "Markdown" });
            } catch (err) {
                console.error(`Error notifying club ${club.name}:`, err.message);
            }
        }
        console.log(`Sent subscription reminders to ${expiringRes.rows.length} clubs`);
    } catch (err) {
        console.error("Scheduler error (Sub Reminder):", err.message);
    }
});

// Every 24 hours at midnight: post community rules
cron.schedule('0 0 * * *', async () => {
    const rules = `📋 *VFPE Community Rules*\n\n` +
        `1. No advertising without permission\n` +
        `2. No external links\n` +
        `3. Respect everyone\n` +
        `4. No scam, no fake info\n` +
        `5. EN / ES only\n\n` +
        `Violations = ban. Thank you 🌿`;
    try {
        await bot.api.sendMessage(COMMUNITY_GROUP_ID, rules, { parse_mode: "Markdown" });
        console.log("Sent 24h rules reminder");
    } catch (err) {
        console.error("Scheduler error (24h):", err.message);
    }
});

// Every Monday at 10:00: weekly summary to channel
cron.schedule('0 10 * * 1', async () => {
    try {
        const lastWeekRes = await query(
            "SELECT name, city FROM clubs WHERE status = 'verified' AND verified_at > CURRENT_TIMESTAMP - INTERVAL '7 days'"
        );
        const lastWeekClubs = lastWeekRes.rows;

        if (lastWeekClubs.length > 0) {
            const list = lastWeekClubs.map(c => `• ${c.name} (${c.city})`).join('\n');
            const summary = `📊 *VFPE Weekly*\n\n` +
                `Esta semana en Verify Plug Europe:\n\n` +
                `✅ ${lastWeekClubs.length} clubes verificados\n` +
                `${list}\n\n` +
                `🔍 Directorio completo:\n` +
                `→ @VPFE_bot\n\n` +
                `#VFPE #WeeklyUpdate`;
            await bot.api.sendMessage(CHANNEL_ID, summary, { parse_mode: "Markdown" });
            console.log("Sent weekly summary to channel");
        } else {
            console.log("No new clubs this week — skipping weekly summary");
        }
    } catch (err) {
        console.error("Scheduler error (Weekly):", err.message);
    }
});

console.log("Scheduler initialized...");
