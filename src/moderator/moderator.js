require('dotenv').config();
const { Bot } = require('grammy');
const { query } = require('../shared/db');

const moderatorBot = new Bot(process.env.MODERATOR_BOT_TOKEN);
const ADMIN_IDS = (process.env.ADMIN_IDS || "").split(',').map(id => id.trim());

const isAdmin = (ctx) => ADMIN_IDS.includes(ctx.from?.id.toString());

async function getRules() {
    const res = await query("SELECT pattern FROM moderation_rules WHERE rule_type = 'keyword'");
    return res.rows.map(r => r.pattern.toLowerCase());
}

/**
 * COMMANDS (Admin Only)
 */

moderatorBot.command("rules", async (ctx) => {
    const rules = `📋 *VFPE Community Rules*\n\n` +
        `1. No advertising or self-promotion without permission\n` +
        `2. No links to external channels, bots or groups\n` +
        `3. Respect all members\n` +
        `4. No scam, no fake clubs\n` +
        `5. English or Spanish only\n\n` +
        `⚠️ 3 warnings = permanent ban.`;
    await ctx.reply(rules, { parse_mode: "Markdown" });
});

moderatorBot.command("ban", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const userId = ctx.message.reply_to_message?.from?.id;
    if (!userId) return ctx.reply("Reply to a message to ban the user.");
    
    try {
        await ctx.banChatMember(userId);
        await ctx.reply(`🚫 User has been banned. Reason: Violation of rules.`);
    } catch (e) { ctx.reply("Error: Could not ban user."); }
});

moderatorBot.command("kick", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const userId = ctx.message.reply_to_message?.from?.id;
    if (!userId) return ctx.reply("Reply to a message to kick the user.");
    
    try {
        await ctx.banChatMember(userId);
        await ctx.unbanChatMember(userId);
        await ctx.reply(`👢 User has been removed from the group.`);
    } catch (e) { ctx.reply("Error: Could not kick user."); }
});

moderatorBot.command("mute", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const userId = ctx.message.reply_to_message?.from?.id;
    if (!userId) return ctx.reply("Reply to a message to mute the user.");
    
    try {
        await ctx.restrictChatMember(userId, { can_send_messages: false });
        await ctx.reply(`🔇 User has been muted.`);
    } catch (e) { ctx.reply("Error: Could not mute user."); }
});

moderatorBot.command("unmute", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const userId = ctx.message.reply_to_message?.from?.id;
    if (!userId) return ctx.reply("Reply to a message to unmute.");
    
    try {
        await ctx.restrictChatMember(userId, { can_send_messages: true, can_send_other_messages: true, can_add_web_page_previews: true });
        await ctx.reply(`🔊 User can now speak again.`);
    } catch (e) { ctx.reply("Error: Could not unmute."); }
});

moderatorBot.command("stats", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const countRes = await query("SELECT COUNT(*) as total FROM users");
    const banRes = await query("SELECT COUNT(*) as total FROM users WHERE warnings_count >= 3");
    
    const stats = `📊 *Group Stats:*\n\n` +
        `• Tracked members: ${countRes.rows[0].total}\n` +
        `• Users with 3+ warnings: ${banRes.rows[0].total}`;
    await ctx.reply(stats, { parse_mode: "Markdown" });
});

moderatorBot.command("announce", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const text = ctx.message.text.replace("/announce", "").trim();
    if (!text) return ctx.reply("Usage: /announce [text]");
    
    const announcement = `📢 *OFFICIAL ANNOUNCEMENT*\n━━━━━━━━━━━━━━━━━━\n\n${text}\n\n━━━━━━━━━━━━━━━━━━\n🌿 VFPE Team`;
    await ctx.reply(announcement, { parse_mode: "Markdown" });
});

/**
 * AUTO-MODERATION LOGIC
 */

moderatorBot.on("message:text", async (ctx) => {
    if (isAdmin(ctx)) return; // Don't moderate admins

    const text = ctx.message.text.toLowerCase();
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;

    if (text.includes("t.me/") || text.includes("telegram.me/")) {
        return handleViolation(ctx, userId, username, "No external Telegram links allowed.");
    }

    const keywords = await getRules();
    for (const kw of keywords) {
        if (text.includes(kw)) {
            return handleViolation(ctx, userId, username, `Forbidden keyword: ${kw}`);
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
            await ctx.reply(`🚫 @${username} has been automatically banned after 3 warnings.\nReason: ${reason}`);
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
        const welcomeMsg = `👋 *Welcome to VFPE Community, ${member.user.first_name}!*\n\n` +
            `🌿 This is the official space of Verify Plug Europe.\n\n` +
            `🔍 Use @VFPE_bot to find verified clubs.\n` +
            `📋 Use /rules to read the group rules.`;
        await ctx.reply(welcomeMsg, { parse_mode: "Markdown" });
    }
});

if (require.main === module) {
    moderatorBot.start();
    console.log("Moderator Bot started...");
}

module.exports = moderatorBot;
