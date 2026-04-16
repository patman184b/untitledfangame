import { query } from "./src/db.js";

async function setup() {
  try {
    console.log("Creating visibility table...");
    await query(`
      CREATE TABLE IF NOT EXISTS visibility (
        player_id UUID,
        tile_x INT,
        tile_y INT,
        status VARCHAR(20) DEFAULT 'unexplored',
        PRIMARY KEY(player_id, tile_x, tile_y)
      );
    `);
    console.log("Success: Visibility table ready.");
    process.exit(0);
  } catch (err) {
    console.error("Error creating table:", err);
    process.exit(1);
  }
}

setup();
