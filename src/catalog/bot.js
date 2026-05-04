require('dotenv').config();
const { Bot, InlineKeyboard, session } = require('grammy');
const { conversations, createConversation } = require('@grammyjs/conversations');
const { query } = require('../shared/db');

const bot = new Bot(process.env.CATALOG_BOT_TOKEN);

const CATEGORY_LABELS = {
    flower:    '🌿 Flower',
    extract:   '🧪 Extract',
    edible:    '🍫 Edible',
    accessory: '🛒 Accessory',
    other:     '✨ Other'
};

const THEME_COLORS = [
    { label: '🟢 Green',  hex: '#00d26a' },
    { label: '🟣 Purple', hex: '#9b59b6' },
    { label: '🔵 Blue',   hex: '#3498db' },
    { label: '🟡 Gold',   hex: '#FFD700' },
    { label: '🔴 Red',    hex: '#e74c3c' },
    { label: '🟠 Orange', hex: '#e67e22' },
];

bot.use(session({ initial: () => ({}) }));
bot.use(conversations());

bot.catch((err) => {
    console.error(`[CatalogBot] Error ${err.ctx?.update?.update_id}:`, err.error);
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function getStore(tgOwnerId) {
    const res = await query('SELECT * FROM catalog_stores WHERE tg_owner_id = $1', [tgOwnerId]);
    return res.rows[0] || null;
}

function catalogUrl(slug) {
    return `${process.env.WEBAPP_URL || 'https://vfpe.onrender.com'}/catalog/${slug}`;
}

function mainMenu(store) {
    return new InlineKeyboard()
        .webApp('📖 View My Catalog', catalogUrl(store.slug)).row()
        .text('➕ Add Product',     'cat_add').row()
        .text('📋 My Products',     'cat_list').row()
        .text('⚙️ Edit My Store',   'cat_settings').row()
        .text('🔗 Share Link',      'cat_share');
}

// ─── SETUP CONVERSATION ────────────────────────────────────────────────────────

async function setupConversation(conversation, ctx) {
    // Step 1: Name
    await ctx.reply(
        '👋 *Welcome to HashANDCrafts Catalog Bot!*\n\nLet\'s set up your catalog in a few steps.\n\n📝 *What\'s the name of your catalog?*\n_(This will be displayed to your customers)_',
        { parse_mode: 'Markdown' }
    );
    const { message: nameMsg } = await conversation.wait();
    const name = nameMsg.text?.trim();
    if (!name) return ctx.reply('❌ Invalid name. Please try again with /start');

    // Step 2: Slug
    const autoSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
    await ctx.reply(
        `✅ Great! Your catalog URL will be:\n\`/catalog/${autoSlug}\`\n\n📸 *Send your logo URL* (a direct image link)\nor type \`skip\` to use no logo for now.`,
        { parse_mode: 'Markdown' }
    );
    const { message: logoMsg } = await conversation.wait();
    const logoUrl = logoMsg.text?.toLowerCase() === 'skip' ? null : logoMsg.text?.trim();

    // Step 3: Bio
    await ctx.reply('📝 *Write a short bio for your catalog* (max 150 chars)\nor type `skip`', { parse_mode: 'Markdown' });
    const { message: bioMsg } = await conversation.wait();
    const bio = bioMsg.text?.toLowerCase() === 'skip' ? null : bioMsg.text?.trim().slice(0, 150);

    // Step 4: Theme Color
    const colorKb = new InlineKeyboard();
    THEME_COLORS.forEach((c, i) => {
        colorKb.text(c.label, `setup_color_${c.hex.replace('#', '')}`);
        if (i % 2 === 1) colorKb.row();
    });
    await ctx.reply('🎨 *Choose a theme color for your catalog:*', { parse_mode: 'Markdown', reply_markup: colorKb });

    let themeColor = '#00d26a';
    while (true) {
        const { callbackQuery: colorQuery } = await conversation.waitFor('callback_query');
        await colorQuery.answer();
        if (colorQuery.data.startsWith('setup_color_')) {
            themeColor = '#' + colorQuery.data.replace('setup_color_', '');
            break;
        }
    }

    // Save to DB
    await query(
        `INSERT INTO catalog_stores (slug, name, tg_owner_id, logo_url, bio, theme_color)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tg_owner_id) DO NOTHING`,
        [autoSlug, name, ctx.from.id, logoUrl, bio, themeColor]
    );

    const store = await getStore(ctx.from.id);
    await ctx.reply(
        `🎉 *Your catalog is live!*\n\n🔗 Share this link with your clients:\n${catalogUrl(store.slug)}\n\nNow add your first products 👇`,
        { parse_mode: 'Markdown', reply_markup: mainMenu(store) }
    );
}

// ─── ADD PRODUCT CONVERSATION ─────────────────────────────────────────────────

async function addProductConversation(conversation, ctx) {
    const store = await getStore(ctx.from.id);
    if (!store) return ctx.reply('❌ Please set up your catalog first with /start');

    await ctx.reply('📦 *New Product — Step 1/4*\n\nWhat\'s the name of this product?', { parse_mode: 'Markdown' });
    const { message: nameMsg } = await conversation.wait();
    const name = nameMsg.text?.trim();

    // Category
    const catKb = new InlineKeyboard();
    Object.entries(CATEGORY_LABELS).forEach(([k, v], i) => {
        catKb.text(v, `addcat_${k}`);
        if (i % 2 === 1) catKb.row();
    });
    await ctx.reply('📂 *Step 2/4 — Select category:*', { parse_mode: 'Markdown', reply_markup: catKb });

    let category = 'flower';
    while (true) {
        const { callbackQuery: catQuery } = await conversation.waitFor('callback_query');
        await catQuery.answer();
        if (catQuery.data.startsWith('addcat_')) {
            category = catQuery.data.replace('addcat_', '');
            break;
        }
    }

    // Description
    await ctx.reply('📝 *Step 3/4 — Short description* (max 200 chars)\nor type `skip`', { parse_mode: 'Markdown' });
    const { message: descMsg } = await conversation.wait();
    const description = descMsg.text?.toLowerCase() === 'skip' ? null : descMsg.text?.trim().slice(0, 200);

    // Photo
    await ctx.reply('📸 *Step 4/4 — Photo URL* (direct image link)\nor type `skip`', { parse_mode: 'Markdown' });
    const { message: photoMsg } = await conversation.wait();
    const photoUrl = photoMsg.text?.toLowerCase() === 'skip' ? null : photoMsg.text?.trim();

    // Save
    await query(
        'INSERT INTO catalog_products (store_id, name, category, description, photo_url) VALUES ($1, $2, $3, $4, $5)',
        [store.id, name, category, description, photoUrl]
    );

    await ctx.reply(
        `✅ *${name}* added to your catalog!\n\nCategory: ${CATEGORY_LABELS[category]}`,
        { parse_mode: 'Markdown', reply_markup: mainMenu(store) }
    );
}

bot.use(createConversation(setupConversation));
bot.use(createConversation(addProductConversation));

// ─── COMMANDS ─────────────────────────────────────────────────────────────────

bot.command('start', async (ctx) => {
    const store = await getStore(ctx.from.id);
    if (!store) {
        return ctx.conversation.enter('setupConversation');
    }
    const productCount = await query('SELECT COUNT(*) FROM catalog_products WHERE store_id = $1', [store.id]);
    await ctx.reply(
        `🏪 *${store.name}*\n\n📦 ${productCount.rows[0].count} products in your catalog\n🔗 ${catalogUrl(store.slug)}`,
        { parse_mode: 'Markdown', reply_markup: mainMenu(store) }
    );
});

// ─── CALLBACKS ────────────────────────────────────────────────────────────────

bot.callbackQuery('cat_add', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter('addProductConversation');
});

bot.callbackQuery('cat_share', async (ctx) => {
    await ctx.answerCallbackQuery();
    const store = await getStore(ctx.from.id);
    if (!store) return;
    await ctx.reply(
        `🔗 *Share your catalog:*\n\n${catalogUrl(store.slug)}\n\n_Send this link to your clients or pin it in your Telegram group._`,
        { parse_mode: 'Markdown' }
    );
});

bot.callbackQuery('cat_list', async (ctx) => {
    await ctx.answerCallbackQuery();
    const store = await getStore(ctx.from.id);
    if (!store) return;

    const res = await query(
        'SELECT * FROM catalog_products WHERE store_id = $1 ORDER BY order_index, created_at',
        [store.id]
    );

    if (!res.rows.length) {
        return ctx.reply('📦 You have no products yet. Tap *➕ Add Product* to get started!', { parse_mode: 'Markdown' });
    }

    const lines = res.rows.map(p =>
        `${p.available ? '✅' : '❌'} *${p.name}* — ${CATEGORY_LABELS[p.category]}`
    ).join('\n');

    const kb = new InlineKeyboard();
    res.rows.forEach(p => {
        kb.text(
            `${p.available ? '✅' : '❌'} ${p.name}`,
            `cat_toggle_${p.id}`
        ).row();
    });
    kb.text('← Back', 'cat_back');

    await ctx.editMessageText(
        `📋 *Your Products:*\n\nTap any product to toggle availability.\n\n${lines}`,
        { parse_mode: 'Markdown', reply_markup: kb }
    );
});

bot.callbackQuery(/^cat_toggle_(\d+)$/, async (ctx) => {
    const productId = parseInt(ctx.match[1]);
    const res = await query('SELECT * FROM catalog_products WHERE id = $1', [productId]);
    const product = res.rows[0];
    if (!product) return ctx.answerCallbackQuery('Product not found');

    const newAvail = !product.available;
    await query('UPDATE catalog_products SET available = $1 WHERE id = $2', [newAvail, productId]);
    await ctx.answerCallbackQuery(newAvail ? '✅ Now Available' : '❌ Marked as Unavailable');

    // Re-render the list
    const store = await getStore(ctx.from.id);
    const allRes = await query(
        'SELECT * FROM catalog_products WHERE store_id = $1 ORDER BY order_index, created_at',
        [store.id]
    );

    const kb = new InlineKeyboard();
    allRes.rows.forEach(p => {
        kb.text(`${p.available ? '✅' : '❌'} ${p.name}`, `cat_toggle_${p.id}`).row();
    });
    kb.text('← Back', 'cat_back');

    await ctx.editMessageReplyMarkup({ reply_markup: kb });
});

bot.callbackQuery('cat_settings', async (ctx) => {
    await ctx.answerCallbackQuery();
    const store = await getStore(ctx.from.id);
    if (!store) return;

    const kb = new InlineKeyboard()
        .text('✏️ Change Name',  'settings_name').row()
        .text('📸 Change Logo',  'settings_logo').row()
        .text('📝 Change Bio',   'settings_bio').row()
        .text('🎨 Change Color', 'settings_color').row()
        .text('← Back', 'cat_back');

    await ctx.editMessageText(
        `⚙️ *Store Settings*\n\n🏪 Name: ${store.name}\n🔗 Slug: \`${store.slug}\`\n🎨 Color: ${store.theme_color}`,
        { parse_mode: 'Markdown', reply_markup: kb }
    );
});

bot.callbackQuery('cat_back', async (ctx) => {
    await ctx.answerCallbackQuery();
    const store = await getStore(ctx.from.id);
    if (!store) return;
    const productCount = await query('SELECT COUNT(*) FROM catalog_products WHERE store_id = $1', [store.id]);
    await ctx.editMessageText(
        `🏪 *${store.name}*\n\n📦 ${productCount.rows[0].count} products in your catalog\n🔗 ${catalogUrl(store.slug)}`,
        { parse_mode: 'Markdown', reply_markup: mainMenu(store) }
    );
});

module.exports = {
    start: () => {
        bot.start();
        console.log('✅ HashANDCrafts Catalog Bot started.');
    },
    bot
};
