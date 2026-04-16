import { query } from "../db.js";
import { HexPathfinding } from "./engine/pathfinding.js";

export class VisionEngine {
  /**
   * Update the visibility table for a player based on their bases and active armies.
   */
  static async updatePlayerVision(playerId) {
    // 1. Get all player's bases
    const bases = query(
      "SELECT x, y FROM player_bases WHERE player_id = ?",
      [playerId]
    );

    // 2. Clear existing 'visible' status for previously seen tiles
    // [Note] In Traditional Fog, we only track 'explored' (dimmed) and 'occupied' (bright).
    // We update 'occupied' for current vision.
    
    for (const b of bases.rows) {
      this.revealRadius(playerId, b.x, b.y, 10, 'occupied');
    }

    // [TODO] Add vision for active marches when march-manager is updated
  }

  static revealRadius(playerId, q, r, radius, status) {
    // Collect all hexes within radius
    const points = this.getHexCircle(q, r, radius);
    
    for (const p of points) {
      query(
        "INSERT OR REPLACE INTO visibility (player_id, tile_x, tile_y, status) VALUES (?, ?, ?, ?)",
        [playerId, p.q, p.r, status]
      );
    }
  }

  static getHexCircle(q, r, radius) {
    const results = [];
    for (let dq = -radius; dq <= radius; dq++) {
      for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
        results.push({ q: q + dq, r: r + dr });
      }
    }
    return results;
  }
}
