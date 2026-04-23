require('dotenv').config();
const cron = require('node-cron');
const { Bot } = require('grammy');
const { query } = require('../shared/db');

const bot = new Bot(process.env.MAIN_BOT_TOKEN);
const COMMUNITY_GROUP_ID = process.env.COMMUNITY_GROUP_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

cron.schedule('0 */12 * * *', async () => {
    const msg = `🔍 *Looking for a verified club?*\n\n` +
        `Use @VFPEbot — find verified cannabis social clubs in Madrid, Barcelona, and across Europe.\n\n` +
        `✅ Verified contacts only. No scams.`;
    try {
        await bot.api.sendMessage(COMMUNITY_GROUP_ID, msg, { parse_mode: "Markdown" });
        console.log("Sent 12h bot reminder");
    } catch (err) {
        console.error("Scheduler error (12h):", err);
    }
});

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
        console.error("Scheduler error (24h):", err);
    }
});

cron.schedule('0 10 * * 1', async () => {
    try {
        const lastWeekRes = await query(
            "SELECT name, city FROM clubs WHERE status = 'verified' AND verified_at > CURRENT_TIMESTAMP - INTERVAL '7 days'"
        );
        const lastWeekClubs = lastWeekRes.rows;
        
        if (lastWeekClubs.length > 0) {
            let list = lastWeekClubs.map(c => `• ${c.name} (${c.city})`).join('\n');
            const summary = `📊 *VFPE Weekly*\n\n` +
                `This week on Verify Plug Europe:\n\n` +
                `✅ ${lastWeekClubs.length} clubs verified\n` +
                `${list}\n\n` +
                `🔍 Browse the full directory:\n` +
                `→ @VFPEbot\n\n` +
                `#VFPE #WeeklyUpdate`;
            await bot.api.sendMessage(CHANNEL_ID, summary, { parse_mode: "Markdown" });
            console.log("Sent weekly summary to channel");
        }
    } catch (err) {
        console.error("Scheduler error (Weekly):", err);
    }
});

console.log("Scheduler initialized...");
