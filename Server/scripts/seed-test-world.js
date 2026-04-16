import { query, ensureShard } from "../src/db.js";
import { MapGenerator } from "../src/engine/map-generator.js";
import { registerPlayer } from "../src/auth.js";
import { earnResources } from "../src/engine/resources.js";

/**
 * SEED SCRIPT: Prepares a local testing environment.
 * Run this to have a fully populated map and test accounts.
 */

async function seed() {
    console.log("🚀 Starting Shard Seeding...");

    // 1. Initialize Shard
    await ensureShard();

    // 2. Generate Map
    console.log("🗺️ Generating World Map (300x200)...");
    const gen = new MapGenerator();
    gen.generateWorld();
    console.log("✅ Map Generated.");

    // 3. Register Test Players
    const factions = ["rome", "egypt", "carthage", "gaul", "greece", "persia"];
    
    for (const faction of factions) {
        const username = `test_${faction}`;
        try {
            console.log(`👤 Registering ${username}...`);
            const reg = registerPlayer(username, "password123", `Commander ${faction}`, faction);
            const playerId = reg.player.id;

            // 4. Boost Resources
            earnResources(playerId, { wood: 50000, ore: 50000, grain: 50000, stone: 20000 });
            
            // 5. Bump Main Hall to Level 10
            query("UPDATE buildings SET level = 10 WHERE player_id = ? AND building_key = 'main_hall'", [playerId]);
            query("UPDATE player_bases SET level = 10 WHERE player_id = ?", [playerId]);

            console.log(`✨ ${username} seeded successfully.`);
        } catch (e) {
            console.log(`⚠️ ${username} might already exist or failed: ${e.message}`);
        }
    }

    console.log("\n🏁 Seeding Complete! Run 'npm start' to begin testing.");
    process.exit(0);
}

seed().catch(err => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});
