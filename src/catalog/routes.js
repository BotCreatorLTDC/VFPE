const express = require('express');
const path = require('path');
const { query } = require('../shared/db');

const router = express.Router();

// Serve the public catalog page
router.get('/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/public/catalog/index.html'));
});

// ─── API ──────────────────────────────────────────────────────────────────────

// GET full catalog data for a slug
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
            'SELECT id, name, category, description, photo_url, available, featured FROM catalog_products WHERE store_id = $1 ORDER BY featured DESC, order_index ASC, created_at ASC',
            [store.id]
        );

        res.json({ store, products: productsRes.rows });
    } catch (e) {
        console.error('[Catalog API]', e);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
