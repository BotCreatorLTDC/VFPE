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
        verify_tg: "💬 *¿Cuál es el usuario de Telegram?* (ej: @clubname)\n\n⚠️ Debe empezar por @",
        verify_tg_invalid: "❌ El usuario debe empezar por @. Inténtalo de nuevo:",
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
        verify_tg: "💬 *What's the Telegram username?* (e.g. @clubname)\n\n⚠️ Must start with @",
        verify_tg_invalid: "❌ Username must start with @. Please try again:",
        verify_ig: "📸 *Instagram handle?* (or type 'skip')",
        verify_confirm: "📋 *Review your information:*",
        confirm_btn: "✅ Confirm & Submit",
        edit_btn: "✏️ Edit",
        cancel_btn: "❌ Cancel",
        about_text: "ℹ️ *About VFPE*\n\nWe are Europe's first verified directory. We connect members with real, safe clubs."
    }
};

// Default cities shown even if no verified clubs yet
const DEFAULT_CITIES_BY_COUNTRY = {
    ES: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Málaga'],
    DE: ['Berlin', 'Hamburg', 'Munich'],
    NL: ['Amsterdam', 'Rotterdam']
};

const isAdmin = (ctx) => ADMIN_IDS.includes(ctx.from?.id.toString());

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
    await ctx.reply(t(ctx, 'verify_intro'), { parse_mode: "Markdown" });
    const { message: nameMsg } = await conversation.wait();

    await ctx.reply(t(ctx, 'verify_city'), { parse_mode: "Markdown" });
    const { message: cityMsg } = await conversation.wait();

    // FIX: Validate @username format — re-ask until valid
    await ctx.reply(t(ctx, 'verify_tg'), { parse_mode: "Markdown" });
    let userMsg;
    while (true) {
        const { message } = await conversation.wait();
        if (message.text && message.text.startsWith('@')) {
            userMsg = message;
            break;
        }
        await ctx.reply(t(ctx, 'verify_tg_invalid'), { parse_mode: "Markdown" });
    }

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
    .webApp("📱 Open Directory", `${process.env.WEBAPP_URL || 'https://vfpe.onrender.com'}/index.html`).row()
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
    await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^setlang_(.+)$/, async (ctx) => {
    ctx.session.lang = ctx.match[1];
    await ctx.editMessageText(t(ctx, 'welcome'), { parse_mode: "Markdown", reply_markup: getMainMenu(ctx) });
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("menu_find", async (ctx) => {
    const kb = new InlineKeyboard()
        .text("🇪🇸 España", "country_ES").row()
        .text("🇩🇪 Alemania", "country_DE").row()
        .text("🇳🇱 Países Bajos", "country_NL").row()
        .text(t(ctx, 'back'), "back_main");
    await ctx.editMessageText(t(ctx, 'select_country'), { parse_mode: "Markdown", reply_markup: kb });
    await ctx.answerCallbackQuery();
});

// FIX: Dynamic cities from DB + default list, with answerCallbackQuery
bot.callbackQuery(/^country_(.+)$/, async (ctx) => {
    const countryCode = ctx.match[1];

    // Load cities that already have verified clubs
    let verifiedCities = [];
    try {
        const res = await query(
            "SELECT DISTINCT city FROM clubs WHERE status = 'verified' AND country = $1 ORDER BY city",
            [countryCode]
        );
        verifiedCities = res.rows.map(r => r.city);
    } catch (e) {
        console.error('Error fetching cities:', e);
    }

    // Merge defaults + verified cities (deduplicated)
    const defaults = DEFAULT_CITIES_BY_COUNTRY[countryCode] || [];
    const allCities = [...new Set([...defaults, ...verifiedCities])];

    const cities = new InlineKeyboard();
    allCities.forEach((city, i) => {
        cities.text(`📍 ${city}`, `city_${city}`);
        if (i % 2 === 1) cities.row();
    });
    cities.row().text(t(ctx, 'back'), "menu_find");

    const cityLabel = { ES: '🇪🇸 *España', DE: '🇩🇪 *Alemania', NL: '🇳🇱 *Países Bajos' }[countryCode] || '🌍';
    await ctx.editMessageText(`${cityLabel} — Selecciona tu ciudad:*`, { parse_mode: "Markdown", reply_markup: cities });
    await ctx.answerCallbackQuery();
});

// FIX: Added answerCallbackQuery
bot.callbackQuery(/^city_(.+)$/, async (ctx) => {
    const city = ctx.match[1];
    const res = await query("SELECT * FROM clubs WHERE city = $1 AND status = 'verified'", [city]);
    const clubs = res.rows;

    if (clubs.length === 0) {
        const kb = new InlineKeyboard().text(t(ctx, 'apply_btn'), "menu_verify").row().text(t(ctx, 'back'), "menu_find");
        await ctx.editMessageText(t(ctx, 'no_clubs').replace('{city}', city), { parse_mode: "Markdown", reply_markup: kb });
        return ctx.answerCallbackQuery();
    }

    await ctx.editMessageText(t(ctx, 'verified_clubs').replace('{city}', city), { parse_mode: "Markdown" });
    for (const club of clubs) {
        const kb = new InlineKeyboard()
            .url(t(ctx, 'contact_btn'), `https://t.me/${club.telegram_username.replace('@', '')}`)
            .text(t(ctx, 'info_btn'), `info_${club.id}`);
        await ctx.reply(`✅ *${club.name}*\n📍 ${club.city}\n💬 ${club.telegram_username}`, { parse_mode: "Markdown", reply_markup: kb });
    }
    await ctx.answerCallbackQuery();
});

// FIX: Use editMessageText and answerCallbackQuery
bot.callbackQuery("menu_community", async (ctx) => {
    const kb = new InlineKeyboard()
        .url("👥 Unirme al Grupo", "https://t.me/+vHqaWGNOnEJkOWM0").row()
        .text(t(ctx, 'back'), "back_main");
    await ctx.editMessageText("👥 *Comunidad VFPE*\n\nÚnete al grupo oficial de la comunidad.", { parse_mode: "Markdown", reply_markup: kb });
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("menu_verify", async (ctx) => {
    await ctx.conversation.enter("verifyClubConversation");
    await ctx.answerCallbackQuery();
});

// FIX: Use editMessageText
bot.callbackQuery("menu_about", async (ctx) => {
    const kb = new InlineKeyboard().text(t(ctx, 'back'), "back_main");
    await ctx.editMessageText(t(ctx, 'about_text'), { parse_mode: "Markdown", reply_markup: kb });
    await ctx.answerCallbackQuery();
});

// FIX: Added answerCallbackQuery
bot.callbackQuery("back_main", async (ctx) => {
    await ctx.editMessageText(t(ctx, 'welcome'), { parse_mode: "Markdown", reply_markup: getMainMenu(ctx) });
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("confirm_verify", async (ctx) => {
    const club = ctx.session.pendingClub;
    if (club) {
        // FIX: Use ISO country code 'ES' instead of 'Spain'
        await query(
            "INSERT INTO clubs (name, city, country, telegram_username, instagram, status) VALUES ($1, $2, $3, $4, $5, $6)",
            [club.name, club.city, 'ES', club.username, club.instagram, 'pending']
        );
        await ctx.editMessageText(t(ctx, 'req_submitted'), { parse_mode: "Markdown" });

        // Notify admins of new pending request
        for (const adminId of ADMIN_IDS) {
            if (!adminId) continue;
            try {
                const kb = new InlineKeyboard()
                    .webApp("🖥 Abrir Panel Admin", `${process.env.WEBAPP_URL || 'https://vfpe.onrender.com'}/admin.html`);
                await bot.api.sendMessage(
                    adminId,
                    `📬 *Nueva solicitud de verificación:*\n\n🏷 ${club.name}\n📍 ${club.city}\n💬 ${club.username}\n\nRevisa esta solicitud en el Panel de Administración.`,
                    { parse_mode: "Markdown", reply_markup: kb }
                );
            } catch (e) { /* Admin might not have started the bot */ }
        }
    }
    await ctx.answerCallbackQuery();
});

// Admin: approve
bot.callbackQuery(/^approve_(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCallbackQuery("❌ Sin permisos");
    const clubId = ctx.match[1];
    const clubRes = await query("SELECT * FROM clubs WHERE id = $1", [clubId]);
    const club = clubRes.rows[0];
    if (club) {
        await query("UPDATE clubs SET status = 'verified', verified_at = CURRENT_TIMESTAMP WHERE id = $1", [clubId]);
        await ctx.editMessageText(`✅ *${club.name}* verificado!`, { parse_mode: "Markdown" });
        const channelMsg = `🆕 *NUEVO CLUB VERIFICADO*\n\n✅ *${club.name}*\n📍 ${club.city}\n💬 ${club.telegram_username}\n\n#VFPE #${club.city}`;
        try { await bot.api.sendMessage(process.env.CHANNEL_ID, channelMsg, { parse_mode: "Markdown" }); } catch (e) {}
    }
    await ctx.answerCallbackQuery();
});

// FIX: Reject handler — was missing entirely
bot.callbackQuery(/^reject_(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCallbackQuery("❌ Sin permisos");
    const clubId = ctx.match[1];
    const clubRes = await query("SELECT * FROM clubs WHERE id = $1", [clubId]);
    const club = clubRes.rows[0];
    if (club) {
        await query("UPDATE clubs SET status = 'rejected' WHERE id = $1", [clubId]);
        await ctx.editMessageText(`❌ *${club.name}* rechazado.`, { parse_mode: "Markdown" });
    }
    await ctx.answerCallbackQuery();
});

bot.command("admin", async (ctx) => {
    if (!isAdmin(ctx)) return;

    const res = await query("SELECT COUNT(*) FROM clubs WHERE status = 'pending'");
    const pendingCount = parseInt(res.rows[0].count);

    const kb = new InlineKeyboard()
        .webApp("🖥 Web Admin Panel", `${process.env.WEBAPP_URL || 'https://vfpe.onrender.com'}/admin.html`)
        .row();

    if (pendingCount === 0) {
        return ctx.reply("✅ No hay solicitudes pendientes.\n\nPuedes gestionar el directorio completo en el panel web:", { 
            parse_mode: "Markdown", 
            reply_markup: kb 
        });
    }

    await ctx.reply(`📊 *Panel de Administración*\n\nHay *${pendingCount}* solicitudes pendientes.\n\nAccede al Panel Web para gestionar (Aceptar, Enviar Billetera, Publicar):`, {
        parse_mode: "Markdown",
        reply_markup: kb
    });
});

if (require.main === module) {
    bot.start();
    console.log("Main Bot started with Multilingual Support...");
}

module.exports = bot;
