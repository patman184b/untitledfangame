import { query } from "../db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGIONS_PATH = path.join(__dirname, "../data/world-regions.json");
const regionsData = JSON.parse(fs.readFileSync(REGIONS_PATH, "utf-8")).regions;

export class PlayerManager {
  static async spawnPlayer(playerId, factionId) {
    const region = regionsData.find(r => r.faction_id === factionId);
    if (!region) throw new Error("Invalid faction or region missing.");

    // Find a suitable Gg (Grass) tile within region bounds
    const tiles = query(
      "SELECT x, y FROM tiles WHERE terrain = 'Gg' AND x >= ? AND x <= ? AND y >= ? AND y <= ? LIMIT 50",
      [region.bounds.minQ, region.bounds.maxQ, region.bounds.minR, region.bounds.maxR]
    );

    if (tiles.rowCount === 0) throw new Error("No suitable tiles found for spawning.");

    // Pick a random one
    const spawnTile = tiles.rows[Math.floor(Math.random() * tiles.rowCount)];

    // Register Player Base
    query(
      "INSERT INTO visibility (player_id, tile_x, tile_y, status) VALUES (?, ?, ?, 'occupied')",
      [playerId, spawnTile.x, spawnTile.y]
    );

    query(
      "INSERT INTO player_bases (player_id, level, gems, x, y, faction_id) VALUES (?, 1, 500, ?, ?, ?)",
      [playerId, spawnTile.x, spawnTile.y, factionId]
    );

    console.log(`Player ${playerId} spawned in ${region.name} at (${spawnTile.x}, ${spawnTile.y})`);
    
    return {
      regionName: region.name,
      capital: region.capital.name,
      x: spawnTile.x,
      y: spawnTile.y
    };
  }
}
