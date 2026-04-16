import { query } from "./src/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CITIES_DATA_PATH = path.join(__dirname, "data/world-cities.json");
const cities = JSON.parse(fs.readFileSync(CITIES_DATA_PATH, "utf-8")).cities;

async function run() {
  try {
    console.log("Initializing Historical Cities in the Shard...");
    for (const city of cities) {
      query(
        "INSERT OR REPLACE INTO cities (id, name, tier, x, y, max_siege_hp, current_siege_hp, faction_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [city.id, city.name, city.level, city.q, city.r, city.siege_hp, city.siege_hp, city.faction_id]
      );
    }
    console.log(`Successfully initialized ${cities.length} cities.`);
    process.exit(0);
  } catch (err) {
    console.error("Error initializing cities:", err);
    process.exit(1);
  }
}

run();
