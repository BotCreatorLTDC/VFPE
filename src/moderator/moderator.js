require('dotenv').config();
const { Bot } = require('grammy');
const { query } = require('../shared/db');

const moderatorBot = new Bot(process.env.MODERATOR_BOT_TOKEN);
const ADMIN_IDS = (process.env.ADMIN_IDS || "").split(',').map(id => id.trim());

const isAdmin = (ctx) => ADMIN_IDS.includes(ctx.from?.id.toString());

// In-memory storage for Anti-Flood
const userMessages = new Map();

/**
 * COMMANDS
 */

moderatorBot.command("pin", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const text = ctx.message.text.replace("/pin", "").trim();
    const replyTo = ctx.message.reply_to_message;

    if (!text && !replyTo) {
        return ctx.reply("Usage: /pin [text] or reply to a message with /pin");
    }

    try {
        let msgToPin;
        if (replyTo) {
            msgToPin = replyTo.message_id;
        } else {
            const sent = await ctx.reply(`🌿 *VFPE OFFICIAL PIN*\n━━━━━━━━━━━━━━\n\n${text}`, { parse_mode: "Markdown" });
            msgToPin = sent.message_id;
        }
        await ctx.pinChatMessage(msgToPin);
    } catch (e) { ctx.reply("Error: Could not pin message."); }
});

moderatorBot.command("rules", async (ctx) => {
    const rules = `📋 *VFPE Community Rules*\n\n1. No advertising\n2. No external links\n3. Respect others\n4. No scams\n\n⚠️ 3 warnings = Ban.`;
    await ctx.reply(rules, { parse_mode: "Markdown" });
});

moderatorBot.command("stats", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const countRes = await query("SELECT COUNT(*) as total FROM users");
    await ctx.reply(`📊 *Tracked members:* ${countRes.rows[0].total}`, { parse_mode: "Markdown" });
});

/**
 * AUTO-MODERATION & ANTI-FLOOD
 */

moderatorBot.on("message", async (ctx, next) => {
    if (isAdmin(ctx)) return next();

    const userId = ctx.from.id;
    const now = Date.now();

    // Anti-Flood Logic
    if (!userMessages.has(userId)) {
        userMessages.set(userId, []);
    }
    const timestamps = userMessages.get(userId);
    timestamps.push(now);

    // Keep only last 10 seconds
    const recentMessages = timestamps.filter(ts => now - ts < 10000);
    userMessages.set(userId, recentMessages);

    if (recentMessages.length > 5) {
        try {
            await ctx.deleteMessage();
            await ctx.restrictChatMember(userId, { can_send_messages: false });
            await ctx.reply(`🔇 @${ctx.from.username || ctx.from.first_name} muted for 1 hour due to Flood/Spam.`);
            // Auto-unmute could be handled by a timeout or manual /unmute
        } catch (e) {}
        return;
    }

    // Check for links and keywords
    if (ctx.message.text) {
        const text = ctx.message.text.toLowerCase();
        if (text.includes("t.me/") || text.includes("telegram.me/")) {
            return handleViolation(ctx, userId, "No links allowed.");
        }
        // Blacklist check...
        const blacklist = ["vendo", "precio", "€/g", "delivery", "whatsapp"];
        for (const kw of blacklist) {
            if (text.includes(kw)) return handleViolation(ctx, userId, `Forbidden keyword: ${kw}`);
        }
    }
    
    await next();
});

async function handleViolation(ctx, userId, reason) {
    try {
        await ctx.deleteMessage();
        const username = ctx.from.username || ctx.from.first_name;
        
        const userRes = await query("SELECT warnings_count FROM users WHERE telegram_id = $1", [userId]);
        const warnings = (userRes.rows[0]?.warnings_count || 0) + 1;

        await query("INSERT INTO users (telegram_id, username, warnings_count) ON CONFLICT (telegram_id) DO UPDATE SET warnings_count = $1", [warnings]);

        if (warnings >= 3) {
            await ctx.banChatMember(userId);
            await ctx.reply(`🚫 @${username} banned (3/3 warnings).`);
        } else {
            await ctx.reply(`⚠️ @${username}: Rule violation. (${warnings}/3 warnings).`);
        }
    } catch (e) {}
}

moderatorBot.on("chat_member", async (ctx) => {
    const member = ctx.chatMember.new_chat_member;
    if (member?.status === "member") {
        await ctx.reply(`👋 Welcome to VFPE, ${member.user.first_name}!\nUse @VPFE_bot to find clubs.`, { parse_mode: "Markdown" });
    }
});

if (require.main === module) {
    moderatorBot.start();
    console.log("Moderator Bot with Anti-Flood started...");
}

module.exports = moderatorBot;
