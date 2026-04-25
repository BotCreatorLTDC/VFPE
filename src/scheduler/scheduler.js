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
        `Usa @VPFE_bot — encuentra clubes de cannabis social verificados en Madrid, Barcelona, y toda Europa.\n\n` +
        `✅ Contactos verificados únicamente. Sin scams.`;
    try {
        await bot.api.sendMessage(COMMUNITY_GROUP_ID, msg, { parse_mode: "Markdown" });
        console.log("Sent 12h bot reminder");
    } catch (err) {
        console.error("Scheduler error (12h):", err.message);
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
