require('dotenv').config();
const { initDb } = require('./shared/db');

async function startApp() {
    // Initialize Database
    await initDb();

    console.log("--- Starting VFPE Ecosystem ---");

    // Start Main Bot
    const mainBot = require('./bot/bot');
    mainBot.start().catch(err => console.error("Main Bot Error:", err));

    // Start Moderator Bot
    // FIX: moderator now exports { start, moderatorBot } instead of just the bot instance
    const moderator = require('./moderator/moderator');
    moderator.start().catch(err => console.error("Moderator Bot Error:", err));

    // Start Catalog Bot (HashANDCrafts Catalog Service)
    if (process.env.CATALOG_BOT_TOKEN) {
        const catalogBot = require('./catalog/bot');
        catalogBot.start().catch(err => console.error("Catalog Bot Error:", err));
    } else {
        console.log("⚠️  CATALOG_BOT_TOKEN not set — Catalog Bot skipped.");
    }

    // Start Web App
    require('./webapp/server');

    // Start Scheduler (must be after bot so module cache has bot instance)
    require('./scheduler/scheduler');

    console.log("All services are starting up...");
}

startApp().catch(err => console.error("Startup Error:", err));
