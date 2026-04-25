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

    // Start Web App
    require('./webapp/server');

    // Start Scheduler (must be after bot so module cache has bot instance)
    require('./scheduler/scheduler');

    console.log("All services are starting up...");
}

startApp().catch(err => console.error("Startup Error:", err));
