require('dotenv').config();
const { Bot } = require('grammy');
const { query } = require('../shared/db');

const moderatorBot = new Bot(process.env.MODERATOR_BOT_TOKEN);

async function getRules() {
    const res = await query("SELECT pattern FROM moderation_rules WHERE rule_type = 'keyword'");
    return res.rows.map(r => r.pattern.toLowerCase());
}

moderatorBot.on("message:text", async (ctx) => {
    const text = ctx.message.text.toLowerCase();
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;

    if (text.includes("t.me/") || text.includes("telegram.me/")) {
        return handleViolation(ctx, userId, username, "No external Telegram links allowed.");
    }

    const keywords = await getRules();
    for (const kw of keywords) {
        if (text.includes(kw)) {
            return handleViolation(ctx, userId, username, `Forbidden keyword detected: ${kw}`);
        }
    }
});

async function handleViolation(ctx, userId, username, reason) {
    try {
        await ctx.deleteMessage();

        const userRes = await query("SELECT warnings_count FROM users WHERE telegram_id = $1", [userId]);
        const user = userRes.rows[0];
        let warnings = (user ? user.warnings_count : 0) + 1;

        if (!user) {
            await query("INSERT INTO users (telegram_id, username, warnings_count) VALUES ($1, $2, $3)", [userId, username, warnings]);
        } else {
            await query("UPDATE users SET warnings_count = $1 WHERE telegram_id = $2", [warnings, userId]);
        }

        if (warnings >= 3) {
            await ctx.banChatMember(userId);
            await ctx.reply(`🚫 @${username} has been automatically banned after 3 warnings. Reason: ${reason}`);
        } else {
            await ctx.reply(`⚠️ @${username}: Your message was removed for violating group rules. (${warnings}/3 warnings).`);
        }
    } catch (err) {
        console.error("Moderation error:", err);
    }
}

moderatorBot.on("chat_member", async (ctx) => {
    const member = ctx.chatMember.new_chat_member;
    if (member && member.status === "member") {
        const name = member.user.first_name;
        const welcomeMsg = `👋 *Welcome to VFPE Community, ${name}!*\n\n` +
            `🌿 This is the official space of Verify Plug Europe — the verified directory of cannabis social clubs.\n\n` +
            `📋 *Group rules:*\n` +
            `1. No advertising or self-promotion without permission\n` +
            `2. No links to external channels, bots or groups\n` +
            `3. Respect all members\n` +
            `4. No scam, no fake clubs\n` +
            `5. English or Spanish only\n\n` +
            `🔍 Looking for a verified club?\n` +
            `→ Use our bot: @VFPEbot\n\n` +
            `⚠️ Breaking rules = instant ban.`;
        await ctx.reply(welcomeMsg, { parse_mode: "Markdown" });
    }
});

if (require.main === module) {
    moderatorBot.start();
    console.log("Moderator Bot started...");
}

module.exports = moderatorBot;
