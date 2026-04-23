const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Render/ElephantSQL
    }
});

// Initialize database
async function initDb() {
    try {
        const schema = fs.readFileSync(path.resolve(__dirname, '../database/schema.sql'), 'utf8');
        await pool.query(schema);
        console.log('PostgreSQL Database initialized successfully.');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
}

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    initDb
};
