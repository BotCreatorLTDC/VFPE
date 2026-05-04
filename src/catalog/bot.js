require('dotenv').config();
const { Bot, InlineKeyboard } = require('grammy');
const { query } = require('../shared/db');

const bot = new Bot(process.env.CATALOG_BOT_TOKEN);
const BASE_URL = process.env.WEBAPP_URL || 'https://vfpe.onrender.com';

bot.catch((err) => console.error(`[CatalogBot] Error:`, err.error));

async function getStore(tgOwnerId) {
    const res = await query('SELECT * FROM catalog_stores WHERE tg_owner_id = $1', [tgOwnerId]);
    return res.rows[0] || null;
}

// /start — main menu
bot.command('start', async (ctx) => {
    const store = await getStore(ctx.from.id);
    const kb = new InlineKeyboard();

    if (store) {
        kb.webApp('📖 View My Catalog', `${BASE_URL}/catalog/${store.slug}`).row()
          .webApp('⚙️ Manage My Catalog', `${BASE_URL}/catalog/manage.html?slug=${store.slug}`).row();
    }

    // Demo buttons — always visible for showcasing
    kb.webApp('👁 Demo — Customer View', `${BASE_URL}/catalog/index.html?demo=true`).row()
      .webApp('🛠 Demo — Owner Panel',   `${BASE_URL}/catalog/manage.html?demo=true`).row();

    if (!store) {
        kb.text('🚀 Create My Catalog', 'create_catalog');
    }

    const text = store
        ? `🏪 *${store.name}*\n\n📦 Your catalog is live. Manage it below or preview the demo.`
        : `🌿 *HashANDCrafts Catalog Bot*\n\nCreate a professional product catalog and share it with your clients via a beautiful Mini App.\n\nTap *Demo* to preview, or *Create My Catalog* to get started.`;

    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
});

// Start catalog creation flow
bot.callbackQuery('create_catalog', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
        `📋 *Let\'s set up your catalog!*\n\nSend me the name for your catalog:\n_(e.g. HashAndCrafts, The Green Lab, Cali King...)_`,
        { parse_mode: 'Markdown' }
    );
});

// Handle name input → create store
bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    const store = await getStore(ctx.from.id);
    if (store) return; // Already has store, ignore free text

    const name = ctx.message.text.trim().slice(0, 60);
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);

    if (!slug) return ctx.reply('❌ Invalid name. Please use letters or numbers only.');

    try {
        await query(
            `INSERT INTO catalog_stores (slug, name, tg_owner_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [slug, name, ctx.from.id]
        );

        const kb = new InlineKeyboard()
            .webApp('⚙️ Open Manager', `${BASE_URL}/catalog/manage.html?slug=${slug}`).row()
            .webApp('📖 View Public Catalog', `${BASE_URL}/catalog/${slug}`);

        await ctx.reply(
            `✅ *${name}* is ready!\n\n🔗 Public link:\n\`${BASE_URL}/catalog/${slug}\`\n\nOpen the manager to add your products 👇`,
            { parse_mode: 'Markdown', reply_markup: kb }
        );
    } catch (e) {
        console.error('[CatalogBot] Create store error:', e);
        await ctx.reply('❌ Something went wrong. Please try /start again.');
    }
});

module.exports = {
    start: () => {
        console.log('✅ HashANDCrafts Catalog Bot started.');
        return bot.start(); // Must return the Promise for .catch() in index.js
    },
    bot
};
