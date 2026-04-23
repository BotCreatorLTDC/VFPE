require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { query } = require('../shared/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/clubs', async (req, res) => {
    try {
        const clubsRes = await query("SELECT * FROM clubs WHERE status = 'verified'");
        res.json(clubsRes.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch clubs" });
    }
});

app.post('/api/verify', async (req, res) => {
    const { name, city, country, telegram_username, instagram, description } = req.body;
    if (!name || !city || !country || !telegram_username) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        await query(
            "INSERT INTO clubs (name, city, country, telegram_username, instagram, description, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [name, city, country, telegram_username, instagram, description, 'pending']
        );
        res.json({ success: true, message: "Request received!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to submit request" });
    }
});

app.listen(PORT, () => {
    console.log(`Mini App Server running at http://localhost:${PORT}`);
});
