require('dotenv').config();
const { Bot, InlineKeyboard, session } = require('grammy');
const { conversations, createConversation } = require('@grammyjs/conversations');
const { query } = require('../shared/db');

const bot = new Bot(process.env.MAIN_BOT_TOKEN);
const ADMIN_IDS = (process.env.ADMIN_IDS || "").split(',').map(id => id.trim());

// Translation Dictionary
const strings = {
    es: {
        welcome: "🌿 *Bienvenido a VFPE — Verify Plug Europe*\n\nEl único directorio verificado de clubes sociales de cannabis en Europa.\n\n👇 *Elige una opción:*",
        menu_find: "🗺 Buscar un Club",
        menu_community: "👥 Comunidad",
        menu_verify: "✅ Ser Verificado",
        menu_about: "ℹ️ Sobre VFPE",
        select_country: "🌍 *Selecciona tu país:*",
        select_city: "🇪🇸 *España — Selecciona tu ciudad:*",
        no_clubs: "⚠️ *Aún no hay clubes verificados en {city}.*\n\nEstamos expandiéndonos. Sé el primero: ¡verifícate!",
        apply_btn: "✅ Solicitar Verificación",
        back: "← Volver",
        contact_btn: "→ Contactar Club",
        info_btn: "ℹ️ Info",
        verified_clubs: "📍 *{city} — Clubes Verificados*\n\nAquí tienes los clubes verificados en tu ciudad.",
        req_submitted: "🎯 *¡Solicitud enviada!*\n\nRevisaremos tu club en 24-48h. Recibirás una notificación aquí.",
        help_cmd: "🆘 *Comandos Disponibles:*\n\n/start - Menú principal\n/find - Buscador\n/verify - Registrar club\n/community - Grupo\n/about - Info\n/cancel - Cancelar",
        verify_intro: "✅ *Verificación de Club*\n\n¿Cómo se llama tu club?\n(Escríbelo y envía)",
        verify_city: "📍 *¿En qué ciudad está?*",
        verify_tg: "💬 *¿Cuál es el usuario de Telegram?* (ej: @clubname)",
        verify_ig: "📸 *¿Handle de Instagram?* (o escribe 'skip')",
        verify_confirm: "📋 *Revisa tus datos:*",
        confirm_btn: "✅ Confirmar y Enviar",
        edit_btn: "✏️ Editar",
        cancel_btn: "❌ Cancelar",
        about_text: "ℹ️ *Sobre VFPE*\n\nSomos el primer directorio verificado de Europa. Conectamos socios con clubes reales y seguros."
    },
    en: {
        welcome: "🌿 *Welcome to VFPE — Verify Plug Europe*\n\nEurope's only verified directory of cannabis social clubs.\n\n👇 *Choose an option:*",
        menu_find: "🗺 Find a Club",
        menu_community: "👥 Community",
        menu_verify: "✅ Get Verified",
        menu_about: "ℹ️ About VFPE",
        select_country: "🌍 *Select your country:*",
        select_city: "🇪🇸 *Spain — Select your city:*",
        no_clubs: "⚠️ *No verified clubs found in {city} yet.*\n\nWe're expanding. Be the first — get verified!",
        apply_btn: "✅ Apply for Verification",
        back: "← Back",
        contact_btn: "→ Contact Club",
        info_btn: "ℹ️ Info",
        verified_clubs: "📍 *{city} — Verified Clubs*\n\nHere are the verified clubs in your city.",
        req_submitted: "🎯 *Request submitted!*\n\nWe'll review your club within 24-48h. You'll get a notification here.",
        help_cmd: "🆘 *Available Commands:*\n\n/start - Main menu\n/find - Search\n/verify - Register club\n/community - Group\n/about - Info\n/cancel - Cancel",
        verify_intro: "✅ *Club Verification*\n\nWhat is your club's name?\n(Type and send)",
        verify_city: "📍 *In which city is it located?*",
        verify_tg: "💬 *What's the Telegram username?* (e.g. @clubname)",
        verify_ig: "📸 *Instagram handle?* (or type 'skip')",
        verify_confirm: "📋 *Review your information:*",
        confirm_btn: "✅ Confirm & Submit",
        edit_btn: "✏️ Edit",
        cancel_btn: "❌ Cancel",
        about_text: "ℹ️ *About VFPE*\n\nWe are Europe's first verified directory. We connect members with real, safe clubs."
    }
};

bot.use(session({ initial: () => ({ lang: 'es' }) }));
bot.use(conversations());

bot.catch((err) => {
    console.error(`Error ${err.ctx.update.update_id}:`, err.error);
});

const t = (ctx, key) => strings[ctx.session.lang || 'es'][key] || key;

/**
 * Conversations
 */
async function verifyClubConversation(conversation, ctx) {
    const lang = ctx.session.lang;
    await ctx.reply(t(ctx, 'verify_intro'), { parse_mode: "Markdown" });
    const { message: nameMsg } = await conversation.wait();
    
    await ctx.reply(t(ctx, 'verify_city'), { parse_mode: "Markdown" });
    const { message: cityMsg } = await conversation.wait();
    
    await ctx.reply(t(ctx, 'verify_tg'), { parse_mode: "Markdown" });
    const { message: userMsg } = await conversation.wait();
    
    await ctx.reply(t(ctx, 'verify_ig'), { parse_mode: "Markdown" });
    const { message: instaMsg } = await conversation.wait();
    const instagram = instaMsg.text.toLowerCase() === 'skip' ? null : instaMsg.text;

    const summary = `${t(ctx, 'verify_confirm')}\n\n` +
        `🏷 ${nameMsg.text}\n📍 ${cityMsg.text}\n💬 ${userMsg.text}\n📸 ${instagram || 'None'}`;

    const keyboard = new InlineKeyboard()
        .text(t(ctx, 'confirm_btn'), "confirm_verify")
        .text(t(ctx, 'edit_btn'), "menu_verify")
        .text(t(ctx, 'cancel_btn'), "back_main");

    await ctx.reply(summary, { parse_mode: "Markdown", reply_markup: keyboard });
    ctx.session.pendingClub = { name: nameMsg.text, city: cityMsg.text, username: userMsg.text, instagram };
}

bot.use(createConversation(verifyClubConversation));

const getMainMenu = (ctx) => new InlineKeyboard()
    .text(t(ctx, 'menu_find'), "menu_find").row()
    .text(t(ctx, 'menu_community'), "menu_community").row()
    .text(t(ctx, 'menu_verify'), "menu_verify").row()
    .text(t(ctx, 'menu_about'), "menu_about").row()
    .text("🌐 Language / Idioma", "menu_lang");

bot.command("start", async (ctx) => {
    await ctx.reply(t(ctx, 'welcome'), { parse_mode: "Markdown", reply_markup: getMainMenu(ctx) });
});

bot.command("find", async (ctx) => {
    const kb = new InlineKeyboard().text("🇪🇸 España", "country_ES").text("← Back", "back_main");
    await ctx.reply(t(ctx, 'select_country'), { parse_mode: "Markdown", reply_markup: kb });
});

bot.callbackQuery("menu_lang", async (ctx) => {
    const kb = new InlineKeyboard().text("🇪🇸 Español", "setlang_es").text("🇬🇧 English", "setlang_en");
    await ctx.editMessageText("🌐 *Select your language / Selecciona tu idioma:*", { parse_mode: "Markdown", reply_markup: kb });
});

bot.callbackQuery(/^setlang_(.+)$/, async (ctx) => {
    ctx.session.lang = ctx.match[1];
    await ctx.editMessageText(t(ctx, 'welcome'), { parse_mode: "Markdown", reply_markup: getMainMenu(ctx) });
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("menu_find", async (ctx) => {
    const kb = new InlineKeyboard().text("🇪🇸 España", "country_ES").text(t(ctx, 'back'), "back_main");
    await ctx.editMessageText(t(ctx, 'select_country'), { parse_mode: "Markdown", reply_markup: kb });
});

bot.callbackQuery(/^country_/, async (ctx) => {
    const cities = new InlineKeyboard()
        .text("📍 Madrid", "city_Madrid").text("📍 Barcelona", "city_Barcelona").row()
        .text(t(ctx, 'back'), "menu_find");
    await ctx.editMessageText(t(ctx, 'select_city'), { parse_mode: "Markdown", reply_markup: cities });
});

bot.callbackQuery(/^city_(.+)$/, async (ctx) => {
    const city = ctx.match[1];
    const res = await query("SELECT * FROM clubs WHERE city = $1 AND status = 'verified'", [city]);
    const clubs = res.rows;

    if (clubs.length === 0) {
        const kb = new InlineKeyboard().text(t(ctx, 'apply_btn'), "menu_verify").row().text(t(ctx, 'back'), "menu_find");
        return ctx.editMessageText(t(ctx, 'no_clubs').replace('{city}', city), { parse_mode: "Markdown", reply_markup: kb });
    }

    await ctx.editMessageText(t(ctx, 'verified_clubs').replace('{city}', city), { parse_mode: "Markdown" });
    for (const club of clubs) {
        const kb = new InlineKeyboard().url(t(ctx, 'contact_btn'), `https://t.me/${club.telegram_username.replace('@', '')}`).text(t(ctx, 'info_btn'), `info_${club.id}`);
        await ctx.reply(`✅ *${club.name}*\n📍 ${club.city}\n💬 ${club.telegram_username}`, { parse_mode: "Markdown", reply_markup: kb });
    }
});

// Admin, About, Community handlers... (abbreviated for brevity but including keys)
bot.callbackQuery("menu_community", async (ctx) => {
    await ctx.reply("Join: [VFPE Community](https://t.me/+vHqaWGNOnEJkOWM0)");
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("menu_verify", async (ctx) => {
    await ctx.conversation.enter("verifyClubConversation");
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("menu_about", async (ctx) => {
    await ctx.reply(t(ctx, 'about_text'), { parse_mode: "Markdown" });
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("back_main", async (ctx) => {
    await ctx.editMessageText(t(ctx, 'welcome'), { parse_mode: "Markdown", reply_markup: getMainMenu(ctx) });
});

bot.callbackQuery("confirm_verify", async (ctx) => {
    const club = ctx.session.pendingClub;
    if (club) {
        await query("INSERT INTO clubs (name, city, country, telegram_username, instagram, status) VALUES ($1, $2, $3, $4, $5, $6)", [club.name, club.city, 'Spain', club.username, club.instagram, 'pending']);
        await ctx.editMessageText(t(ctx, 'req_submitted'), { parse_mode: "Markdown" });
    }
    await ctx.answerCallbackQuery();
});

// Admin Callbacks... (simplified)
bot.callbackQuery(/^approve_(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    const clubId = ctx.match[1];
    const clubRes = await query("SELECT * FROM clubs WHERE id = $1", [clubId]);
    const club = clubRes.rows[0];
    if (club) {
        await query("UPDATE clubs SET status = 'verified', verified_at = CURRENT_TIMESTAMP WHERE id = $1", [clubId]);
        await ctx.editMessageText(`✅ *${club.name}* verified!`);
        const channelMsg = `🆕 *NEW VERIFIED CLUB*\n\n✅ *${club.name}* verified!\n📍 ${club.city}\n💬 ${club.telegram_username}\n\n#VFPE #${club.city}`;
        try { await bot.api.sendMessage(process.env.CHANNEL_ID, channelMsg, { parse_mode: "Markdown" }); } catch (e) {}
    }
    await ctx.answerCallbackQuery();
});

bot.command("admin", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const res = await query("SELECT id, name, city FROM clubs WHERE status = 'pending' LIMIT 5");
    const pending = res.rows;
    if (pending.length === 0) return ctx.reply("✅ No pending requests.");
    for (const club of pending) {
        const kb = new InlineKeyboard().text("✅ Approve", `approve_${club.id}`).text("❌ Reject", `reject_${club.id}`);
        await ctx.reply(`🏷 *${club.name}*\n📍 ${club.city}`, { reply_markup: kb });
    }
});

if (require.main === module) {
    bot.start();
    console.log("Main Bot started with Multilingual Support...");
}

module.exports = bot;
