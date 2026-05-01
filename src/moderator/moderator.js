require('dotenv').config();
const { Bot } = require('grammy');
const { query } = require('../shared/db');

const moderatorBot = new Bot(process.env.MODERATOR_BOT_TOKEN);
const ADMIN_IDS = (process.env.ADMIN_IDS || "").split(',').map(id => id.trim());

const isAdmin = (ctx) => ADMIN_IDS.includes(ctx.from?.id.toString());

// In-memory storage for Anti-Flood
const userMessages = new Map();

// FIX: Dynamic blacklist loaded from DB — refreshed every hour
let dynamicBlacklist = ["vendo", "precio", "€/g", "delivery", "whatsapp"];

async function loadBlacklist() {
    try {
        const res = await query("SELECT pattern FROM moderation_rules WHERE rule_type = 'keyword'");
        if (res.rows.length > 0) {
            dynamicBlacklist = res.rows.map(r => r.pattern.toLowerCase());
            console.log(`[Moderator] Blacklist loaded: ${dynamicBlacklist.length} keywords`);
        }
    } catch (e) {
        console.error('[Moderator] Could not load blacklist from DB, using defaults:', e.message);
    }
}

// FIX: Periodic cleanup of userMessages Map to prevent memory leak (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [userId, timestamps] of userMessages.entries()) {
        const recent = timestamps.filter(ts => now - ts < 10000);
        if (recent.length === 0) {
            userMessages.delete(userId);
            cleaned++;
        } else {
            userMessages.set(userId, recent);
        }
    }
    if (cleaned > 0) console.log(`[Moderator] Cleaned ${cleaned} stale entries from flood tracker`);
}, 5 * 60 * 1000);

// Refresh blacklist from DB every hour
setInterval(loadBlacklist, 60 * 60 * 1000);

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
    const warnedRes = await query("SELECT COUNT(*) as total FROM users WHERE warnings_count > 0");
    await ctx.reply(
        `📊 *Estadísticas VFPE*\n\n👥 Miembros rastreados: ${countRes.rows[0].total}\n⚠️ Con advertencias: ${warnedRes.rows[0].total}`,
        { parse_mode: "Markdown" }
    );
});

moderatorBot.command("unmute", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const target = ctx.message.reply_to_message;
    if (!target) return ctx.reply("Reply to a message to unmute that user.");
    try {
        await ctx.restrictChatMember(target.from.id, {
            can_send_messages: true,
            can_send_media_messages: true,
            can_send_polls: true,
            can_send_other_messages: true,
        });
        await ctx.reply(`🔊 @${target.from.username || target.from.first_name} has been unmuted.`);
    } catch (e) { ctx.reply("Error: Could not unmute user."); }
});

/**
 * AUTO-MODERATION & ANTI-FLOOD
 */

moderatorBot.on("message", async (ctx, next) => {
    const userId = ctx.from.id;
    if (isAdmin(ctx)) return next();

    // EXCEPTION: Check if user is a Verified Plug
    try {
        const plugRes = await query("SELECT id FROM clubs WHERE tg_user_id = $1 AND status = 'verified' LIMIT 1", [userId]);
        if (plugRes.rows.length > 0) return next();
    } catch (e) {
        console.error('[Moderator] DB error checking plug status:', e.message);
    }
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
            await ctx.reply(`🔇 @${ctx.from.username || ctx.from.first_name} silenciado 1 hora por flood/spam.`);

            // FIX: Auto-unmute after 1 hour
            setTimeout(async () => {
                try {
                    await moderatorBot.api.restrictChatMember(ctx.chat.id, userId, {
                        can_send_messages: true,
                        can_send_media_messages: true,
                        can_send_polls: true,
                        can_send_other_messages: true,
                    });
                    console.log(`[Moderator] Auto-unmuted user ${userId}`);
                } catch (e) {
                    console.error(`[Moderator] Could not auto-unmute user ${userId}:`, e.message);
                }
            }, 60 * 60 * 1000); // 1 hour
        } catch (e) {}
        return;
    }

    // 1. BLOCK MEDIA for non-plugs/non-admins
    const hasMedia = ctx.message.photo || ctx.message.video || ctx.message.document || 
                     ctx.message.sticker || ctx.message.animation || ctx.message.voice || 
                     ctx.message.video_note || ctx.message.audio;

    if (hasMedia) {
        return handleViolation(ctx, userId, "Solo los Plugs Verificados pueden enviar archivos multimedia.");
    }

    // 2. CHECK TEXT & CAPTION for links and keywords
    const text = (ctx.message.text || ctx.message.caption || "").toLowerCase();
    if (text) {
        if (text.includes("t.me/") || text.includes("telegram.me/")) {
            return handleViolation(ctx, userId, "No links allowed.");
        }
        for (const kw of dynamicBlacklist) {
            if (text.includes(kw)) return handleViolation(ctx, userId, `Forbidden keyword: ${kw}`);
        }
    }

    await next();
});

// FIX: Fixed SQL — INSERT ... VALUES ... ON CONFLICT correctly parameterized
async function handleViolation(ctx, userId, reason) {
    try {
        await ctx.deleteMessage();
        const username = ctx.from.username || ctx.from.first_name;

        const userRes = await query("SELECT warnings_count FROM users WHERE telegram_id = $1", [userId]);
        const warnings = (userRes.rows[0]?.warnings_count || 0) + 1;

        await query(
            `INSERT INTO users (telegram_id, username, warnings_count)
             VALUES ($1, $2, $3)
             ON CONFLICT (telegram_id)
             DO UPDATE SET warnings_count = EXCLUDED.warnings_count, username = EXCLUDED.username`,
            [userId, username, warnings]
        );

        if (warnings >= 3) {
            await ctx.banChatMember(userId);
            await ctx.reply(`🚫 @${username} baneado (3/3 advertencias). Motivo: ${reason}`);
        } else {
            await ctx.reply(`⚠️ @${username}: Violación de normas. (${warnings}/3 advertencias). Motivo: ${reason}`);
        }
    } catch (e) {
        console.error('[Moderator] handleViolation error:', e.message);
    }
}

moderatorBot.on("chat_member", async (ctx) => {
    const member = ctx.chatMember.new_chat_member;
    if (member?.status === "member") {
        await ctx.reply(
            `👋 Bienvenido a VFPE, ${member.user.first_name}!\nUsa @VerifyPlugEU_bot para encontrar plugs verificados. 🔌`,
            { parse_mode: "Markdown" }
        );
    }
});

// Export with init function so index.js can load the blacklist before starting
async function start() {
    await loadBlacklist();
    return moderatorBot.start();
}

if (require.main === module) {
    start();
    console.log("Moderator Bot with Anti-Flood started...");
}

module.exports = { start, moderatorBot };
