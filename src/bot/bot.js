require('dotenv').config();
const { Bot, InlineKeyboard, session } = require('grammy');
const { conversations, createConversation } = require('@grammyjs/conversations');
const { query } = require('../shared/db');

const bot = new Bot(process.env.MAIN_BOT_TOKEN);

bot.use(session({ initial: () => ({}) }));
bot.use(conversations());

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

const mainMenu = new InlineKeyboard()
    .text("🗺 Find a Club", "menu_find").row()
    .text("👥 Community", "menu_community").row()
    .text("✅ Get Verified", "menu_verify").row()
    .text("ℹ️ About VFPE", "menu_about");

bot.command("start", async (ctx) => {
    const welcome = `🌿 *Welcome to VFPE — Verify Plug Europe*\n\n` +
        `The only verified directory of cannabis social clubs in Europe.\n\n` +
        `Select your city and access verified contacts directly.\n\n` +
        `👇 *Choose an option:*`;
    await ctx.reply(welcome, { parse_mode: "Markdown", reply_markup: mainMenu });
});

bot.callbackQuery("menu_find", async (ctx) => {
    const countries = new InlineKeyboard()
        .text("🇪🇸 España", "country_ES")
        .text("🇩🇪 Germany", "country_DE").row()
        .text("🇳🇱 Netherlands", "country_NL")
        .text("🇨🇿 Czech Republic", "country_CZ").row()
        .text("← Back", "back_main");
    await ctx.editMessageText("🌍 *Select your country:*", { parse_mode: "Markdown", reply_markup: countries });
});

bot.callbackQuery("menu_community", async (ctx) => {
    await ctx.reply("Join our community group: [VFPE Community](https://t.me/your_community_link)", { parse_mode: "Markdown" });
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("menu_verify", async (ctx) => {
    await ctx.conversation.enter("verifyClubConversation");
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("menu_about", async (ctx) => {
    const aboutText = `ℹ️ *About VFPE*\n\n` +
        `Verify Plug Europe is the first verified directory of cannabis social clubs in Europe.\n\n` +
        `We connect members with safe, real, trusted clubs — no scams, no fakes.\n\n` +
        `🇪🇸 Currently active in Spain\n` +
        `🌍 Expanding to Germany, Netherlands & more\n\n` +
        `v1.0 — VFPE`;
    await ctx.reply(aboutText, { parse_mode: "Markdown" });
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("back_main", async (ctx) => {
    const welcome = `🌿 *Welcome to VFPE — Verify Plug Europe*\n\n` +
        `The only verified directory of cannabis social clubs in Europe.\n\n` +
        `Select your city and access verified contacts directly.\n\n` +
        `👇 *Choose an option:*`;
    await ctx.editMessageText(welcome, { parse_mode: "Markdown", reply_markup: mainMenu });
});

bot.callbackQuery("confirm_verify", async (ctx) => {
    const club = ctx.session.pendingClub;
    if (club) {
        await query(
            "INSERT INTO clubs (name, city, country, telegram_username, instagram, status) VALUES ($1, $2, $3, $4, $5, $6)",
            [club.name, club.city, 'Pending', club.username, club.instagram, 'pending']
        );
        await ctx.editMessageText("🎯 *Request submitted!*\n\nOur team will review your club within 24-48h. You'll receive a notification here when approved.\n\n🙏 Thanks for joining VFPE.", { parse_mode: "Markdown" });
    }
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("cancel_verify", async (ctx) => {
    await ctx.editMessageText("❌ *Request cancelled.* Type /start to begin again.", { parse_mode: "Markdown" });
    await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^country_/, async (ctx) => {
    const country = ctx.callbackQuery.data.split('_')[1];
    if (country === 'ES') {
        const cities = new InlineKeyboard()
            .text("📍 Madrid", "city_madrid")
            .text("📍 Barcelona", "city_barcelona").row()
            .text("📍 Valencia", "city_valencia")
            .text("📍 Sevilla", "city_sevilla").row()
            .text("← Back", "menu_find");
        await ctx.editMessageText("🇪🇸 *España — Select your city:*", { parse_mode: "Markdown", reply_markup: cities });
    } else {
        await ctx.answerCallbackQuery("Expanding soon to this country!");
    }
});

if (require.main === module) {
    bot.start();
    console.log("Main Bot started...");
}

module.exports = bot;
