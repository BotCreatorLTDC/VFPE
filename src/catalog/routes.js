const express = require('express');
const path = require('path');
const { query } = require('../shared/db');

const router = express.Router();

// ── STATIC: Serve manage.html directly
router.get('/manage.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/public/catalog/manage.html'));
});

// ── PUBLIC: Serve catalog page by slug
router.get('/:slug', (req, res) => {
    if (req.params.slug === 'api') return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(__dirname, '../webapp/public/catalog/index.html'));
});

// ──────────────────────────────────────────────────────────────────────────────
// JSON API
// ──────────────────────────────────────────────────────────────────────────────

// GET catalog data by slug (public)
router.get('/api/:slug', async (req, res) => {
    const { slug } = req.params;
    try {
        const storeRes = await query(
            'SELECT id, slug, name, logo_url, bio, theme_color FROM catalog_stores WHERE slug = $1 AND active = TRUE',
            [slug]
        );
        if (!storeRes.rows.length) return res.status(404).json({ error: 'Catalog not found' });

        const store = storeRes.rows[0];
        const productsRes = await query(
            `SELECT id, name, category, description, photo_url, available, featured
             FROM catalog_products WHERE store_id = $1
             ORDER BY featured DESC, order_index ASC, created_at ASC`,
            [store.id]
        );

        res.json({ store, products: productsRes.rows });
    } catch (e) {
        console.error('[Catalog API GET]', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST toggle product availability (owner only)
router.post('/api/product/toggle', async (req, res) => {
    const { id, available, tg_user_id } = req.body;
    if (!id || available === undefined || !tg_user_id) return res.status(400).json({ error: 'Missing params' });

    try {
        // Verify ownership
        const check = await query(
            `SELECT cp.id FROM catalog_products cp
             JOIN catalog_stores cs ON cs.id = cp.store_id
             WHERE cp.id = $1 AND cs.tg_owner_id = $2`,
            [id, tg_user_id]
        );
        if (!check.rows.length) return res.status(403).json({ error: 'Forbidden' });

        await query('UPDATE catalog_products SET available = $1 WHERE id = $2', [available, id]);
        res.json({ ok: true });
    } catch (e) {
        console.error('[Catalog API toggle]', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST add product (owner only)
router.post('/api/product/add', async (req, res) => {
    const { name, category, description, photo_url, available, tg_user_id } = req.body;
    if (!name || !tg_user_id) return res.status(400).json({ error: 'Missing params' });

    try {
        const storeRes = await query('SELECT id FROM catalog_stores WHERE tg_owner_id = $1', [tg_user_id]);
        if (!storeRes.rows.length) return res.status(403).json({ error: 'No store found for this user' });

        const store_id = storeRes.rows[0].id;
        const result = await query(
            `INSERT INTO catalog_products (store_id, name, category, description, photo_url, available)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [store_id, name, category || 'flower', description || null, photo_url || null, available ?? true]
        );
        res.json({ ok: true, id: result.rows[0].id });
    } catch (e) {
        console.error('[Catalog API add]', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST delete product (owner only)
router.post('/api/product/delete', async (req, res) => {
    const { id, tg_user_id } = req.body;
    if (!id || !tg_user_id) return res.status(400).json({ error: 'Missing params' });

    try {
        const check = await query(
            `SELECT cp.id FROM catalog_products cp
             JOIN catalog_stores cs ON cs.id = cp.store_id
             WHERE cp.id = $1 AND cs.tg_owner_id = $2`,
            [id, tg_user_id]
        );
        if (!check.rows.length) return res.status(403).json({ error: 'Forbidden' });

        await query('DELETE FROM catalog_products WHERE id = $1', [id]);
        res.json({ ok: true });
    } catch (e) {
        console.error('[Catalog API delete]', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST update store theme color (owner only)
router.post('/api/store/color', async (req, res) => {
    const { slug, color, tg_user_id } = req.body;
    if (!slug || !color || !tg_user_id) return res.status(400).json({ error: 'Missing params' });

    try {
        await query(
            'UPDATE catalog_stores SET theme_color = $1 WHERE slug = $2 AND tg_owner_id = $3',
            [color, slug, tg_user_id]
        );
        res.json({ ok: true });
    } catch (e) {
        console.error('[Catalog API color]', e);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
