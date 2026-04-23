require('dotenv').config();
const { Bot, InlineKeyboard, session } = require('grammy');
const { conversations, createConversation } = require('@grammyjs/conversations');
const { query } = require('../shared/db');

const bot = new Bot(process.env.MAIN_BOT_TOKEN);
const ADMIN_IDS = (process.env.ADMIN_IDS || "").split(',').map(id => id.trim());

bot.use(session({ initial: () => ({}) }));
bot.use(conversations());

const isAdmin = (ctx) => ADMIN_IDS.includes(ctx.from?.id.toString());

/**
 * Conversation for Club Verification
 */
async function verifyClubConversation(conversation, ctx) {
    await ctx.reply("✅ *Club Verification Request*\n\nLet's get your club listed on VFPE.\n\nFirst — what's the name of your club?\n(Type and send)", { parse_mode: "Markdown" });
    const { message: nameMsg } = await conversation.wait();
    const clubName = nameMsg.text;

    await ctx.reply("📍 *In which city is your club located?*\n(e.g. Madrid, Barcelona, Berlin...)", { parse_mode: "Markdown" });
    const { message: cityMsg } = await conversation.wait();
    const city = cityMsg.text;

    await ctx.reply("💬 *What's the Telegram username of your club?*\n(e.g. @clubname — this is what members will use to contact you)", { parse_mode: "Markdown" });
    const { message: userMsg } = await conversation.wait();
    const username = userMsg.text;

    await ctx.reply("📸 *Instagram handle?* (optional — type 'skip' to skip)", { parse_mode: "Markdown" });
    const { message: instaMsg } = await conversation.wait();
    const instagram = instaMsg.text.toLowerCase() === 'skip' ? null : instaMsg.text;

    const summary = `📋 *Review your information:*\n\n` +
        `🏷 Club name: ${clubName}\n` +
        `📍 City: ${city}\n` +
        `💬 Telegram: ${username}\n` +
        `📸 Instagram: ${instagram || 'None'}\n\n` +
        `Is this correct?`;

    const keyboard = new InlineKeyboard()
        .text("✅ Confirm & Submit", "confirm_verify")
        .text("✏️ Edit", "edit_verify")
        .text("❌ Cancel", "cancel_verify");

    await ctx.reply(summary, { parse_mode: "Markdown", reply_markup: keyboard });
    
    conversation.session.pendingClub = { name: clubName, city, username, instagram };
}

bot.use(createConversation(verifyClubConversation));

// Shared Keyboards
const getMainMenu = () => new InlineKeyboard()
    .text("🗺 Find a Club", "menu_find").row()
    .text("👥 Community", "menu_community").row()
    .text("✅ Get Verified", "menu_verify").row()
    .text("ℹ️ About VFPE", "menu_about");

/**
 * COMMANDS
 */
bot.command("start", async (ctx) => {
    const welcome = `🌿 *Welcome to VFPE — Verify Plug Europe*\n\n` +
        `The only verified directory of cannabis social clubs in Europe.\n\n` +
        `Select your city and access verified contacts directly.\n\n` +
        `👇 *Choose an option:*`;
    await ctx.reply(welcome, { parse_mode: "Markdown", reply_markup: getMainMenu() });
});

bot.command("find", async (ctx) => {
    const countries = new InlineKeyboard()
        .text("🇪🇸 España", "country_ES")
        .text("🇩🇪 Germany", "country_DE").row()
        .text("🇳🇱 Netherlands", "country_NL")
        .text("🇨🇿 Czech Republic", "country_CZ").row()
        .text("← Back", "back_main");
    await ctx.reply("🌍 *Select your country:*", { parse_mode: "Markdown", reply_markup: countries });
});

bot.command("verify", async (ctx) => {
    await ctx.conversation.enter("verifyClubConversation");
});

bot.command("community", async (ctx) => {
    await ctx.reply("Join our community group: [VFPE Community](https://t.me/your_community_link)", { parse_mode: "Markdown" });
});

bot.command("about", async (ctx) => {
    const aboutText = `ℹ️ *About VFPE*\n\n` +
        `Verify Plug Europe is the first verified directory of cannabis social clubs in Europe.\n\n` +
        `We connect members with safe, real, trusted clubs — no scams, no fakes.\n\n` +
        `🇪🇸 Currently active in Spain\n` +
        `🌍 Expanding to Germany, Netherlands & more\n\n` +
        `v1.0 — VFPE`;
    await ctx.reply(aboutText, { parse_mode: "Markdown" });
});

bot.command("cancel", async (ctx) => {
    await ctx.reply("❌ Any active process has been cancelled.");
});

bot.command("help", async (ctx) => {
    const help = `🆘 *Available Commands:*\n\n` +
        `/start - Main menu\n` +
        `/find - City selector\n` +
        `/verify - List your club\n` +
        `/community - Group link\n` +
        `/about - Project info\n` +
        `/cancel - Cancel active flow`;
    await ctx.reply(help, { parse_mode: "Markdown" });
});

bot.command("admin", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const res = await query("SELECT id, name, city FROM clubs WHERE status = 'pending' LIMIT 5");
    const pending = res.rows;
    if (pending.length === 0) return ctx.reply("✅ No pending verification requests.");
    await ctx.reply("🛠 *Admin Panel - Pending Requests:*", { parse_mode: "Markdown" });
    for (const club of pending) {
        const kb = new InlineKeyboard().text("✅ Approve", `approve_${club.id}`).text("❌ Reject", `reject_${club.id}`);
        await ctx.reply(`🏷 *${club.name}*\n📍 ${club.city}`, { parse_mode: "Markdown", reply_markup: kb });
    }
});

/**
 * CALLBACKS
 */
bot.callbackQuery("menu_find", async (ctx) => {
    const countries = new InlineKeyboard()
        .text("🇪🇸 España", "country_ES")
        .text("🇩🇪 Germany", "country_DE").row()
        .text("🇳🇱 Netherlands", "country_NL")
        .text("🇨🇿 Czech Republic", "country_CZ").row()
        .text("← Back", "back_main");
    await ctx.editMessageText("🌍 *Select your country:*", { parse_mode: "Markdown", reply_markup: countries });
});

bot.callbackQuery(/^country_/, async (ctx) => {
    const country = ctx.callbackQuery.data.split('_')[1];
    if (country === 'ES') {
        const cities = new InlineKeyboard()
            .text("📍 Madrid", "city_Madrid")
            .text("📍 Barcelona", "city_Barcelona").row()
            .text("📍 Valencia", "city_Valencia")
            .text("📍 Sevilla", "city_Sevilla").row()
            .text("← Back", "menu_find");
        await ctx.editMessageText("🇪🇸 *España — Select your city:*", { parse_mode: "Markdown", reply_markup: cities });
    } else {
        await ctx.answerCallbackQuery("Expanding soon to this country!");
    }
});

// Display Clubs for a City
bot.callbackQuery(/^city_(.+)$/, async (ctx) => {
    const city = ctx.match[1];
    const res = await query("SELECT * FROM clubs WHERE city = $1 AND status = 'verified'", [city]);
    const clubs = res.rows;

    if (clubs.length === 0) {
        const kb = new InlineKeyboard().text("✅ Apply for Verification", "menu_verify").row().text("← Back", "menu_find");
        return ctx.editMessageText(`⚠️ *No verified clubs found in ${city} yet.*\n\nWe're expanding. Be the first — get your club verified!`, { parse_mode: "Markdown", reply_markup: kb });
    }

    await ctx.editMessageText(`📍 *${city} — Verified Clubs*\n\nHere are the verified clubs in your city. Tap a club to get direct contact.`, { parse_mode: "Markdown" });

    for (const club of clubs) {
        const kb = new InlineKeyboard()
            .url("→ Contact Club", `https://t.me/${club.telegram_username.replace('@', '')}`)
            .text("ℹ️ Info", `info_${club.id}`);
        
        await ctx.reply(`✅ *${club.name}*\n📍 ${club.city}\n💬 ${club.telegram_username}`, { parse_mode: "Markdown", reply_markup: kb });
    }
});

bot.callbackQuery(/^info_(\d+)$/, async (ctx) => {
    const clubId = ctx.match[1];
    const res = await query("SELECT * FROM clubs WHERE id = $1", [clubId]);
    const club = res.rows[0];

    if (club) {
        const info = `✅ *${club.name}*\n` +
            `📍 ${club.city}, ${club.country}\n` +
            `🌿 Verified by VFPE\n\n` +
            `${club.description || 'Verified cannabis social club.'}\n\n` +
            `💬 Direct contact: ${club.telegram_username}\n` +
            (club.instagram ? `📸 Instagram: ${club.instagram}` : '');
        
        const kb = new InlineKeyboard()
            .url("💬 Contact on Telegram", `https://t.me/${club.telegram_username.replace('@', '')}`)
            .row()
            .text("← Back to List", `city_${club.city}`);
        
        await ctx.editMessageText(info, { parse_mode: "Markdown", reply_markup: kb });
    }
    await ctx.answerCallbackQuery();
});

// Other Callbacks
bot.callbackQuery("menu_community", async (ctx) => {
    await ctx.reply("Join our community group: [VFPE Community](https://t.me/your_community_link)", { parse_mode: "Markdown" });
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("menu_verify", async (ctx) => {
    await ctx.conversation.enter("verifyClubConversation");
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("menu_about", async (ctx) => {
    bot.api.config.use_reply_markup = true;
    await ctx.reply(`ℹ️ *About VFPE*\n\nVerify Plug Europe is the first verified directory...`, { parse_mode: "Markdown" });
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("back_main", async (ctx) => {
    await ctx.editMessageText(`🌿 *Welcome to VFPE...*`, { parse_mode: "Markdown", reply_markup: getMainMenu() });
});

bot.callbackQuery("confirm_verify", async (ctx) => {
    const club = ctx.session.pendingClub;
    if (club) {
        await query("INSERT INTO clubs (name, city, country, telegram_username, instagram, status) VALUES ($1, $2, $3, $4, $5, $6)", [club.name, club.city, 'Spain', club.username, club.instagram, 'pending']);
        await ctx.editMessageText("🎯 *Request submitted!*...", { parse_mode: "Markdown" });
    }
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("cancel_verify", async (ctx) => {
    await ctx.editMessageText("❌ *Request cancelled.*", { parse_mode: "Markdown" });
    await ctx.answerCallbackQuery();
});

// Admin Callbacks
bot.callbackQuery(/^approve_(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    const clubId = ctx.match[1];
    const clubRes = await query("SELECT * FROM clubs WHERE id = $1", [clubId]);
    const club = clubRes.rows[0];
    if (club) {
        await query("UPDATE clubs SET status = 'verified', verified_at = CURRENT_TIMESTAMP WHERE id = $1", [clubId]);
        await ctx.editMessageText(`✅ *${club.name}* verified!`, { parse_mode: "Markdown" });
        const channelMsg = `🆕 *NEW VERIFIED CLUB*\n\n✅ *${club.name}* verified!\n📍 ${club.city}\n💬 ${club.telegram_username}\n\n#VFPE #${club.city}`;
        try { await bot.api.sendMessage(process.env.CHANNEL_ID, channelMsg, { parse_mode: "Markdown" }); } catch (e) {}
    }
    await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^reject_(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    await query("UPDATE clubs SET status = 'rejected' WHERE id = $1", [ctx.match[1]]);
    await ctx.editMessageText("❌ Rejected.", { parse_mode: "Markdown" });
    await ctx.answerCallbackQuery();
});

if (require.main === module) {
    bot.start();
    console.log("Main Bot started...");
}

module.exports = bot;
