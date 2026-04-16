import { query } from "../db.js";
import { HexPathfinding } from "./engine/pathfinding.js";
import { VisionEngine } from "./vision-engine.js";

export class MarchManager {
  static async startMarch(playerId, commanderId, startHex, goalHex) {
    // 1. Calculate Path
    const path = HexPathfinding.findPath(startHex, goalHex, (q, r) => {
        return true; 
    });

    if (!path) throw new Error("No path to goal.");

    // Initial vision reveal
    VisionEngine.revealRadius(playerId, startHex.q, startHex.r, 5, 'occupied');

    const marchId = `march_${Date.now()}`;
    const startTime = Date.now();
    const duration = path.length * 10000; // 10 seconds per hex
    const arrivalTime = startTime + duration;

    // 2. Persist March & Update Visibility
    await this.revealPathTiles(playerId, path);

    return {
      marchId,
      path,
      startTime,
      arrivalTime,
      duration
    };
  }

  static async revealPathTiles(playerId, path) {
    for (const step of path) {
      const neighbors = HexPathfinding.getNeighbors(step.q, step.r);
      const pointsToReveal = [...neighbors, step];
      
      for (const p of pointsToReveal) {
        query(
          "INSERT OR IGNORE INTO visibility (player_id, tile_x, tile_y, status) VALUES (?, ?, ?, 'explored')",
          [playerId, p.q, p.r]
        );
      }
    }
  }
}
