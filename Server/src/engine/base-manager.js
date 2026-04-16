import { query } from "../db.js";

export class BaseManager {
  /**
   * Start a base upgrade process.
   */
  static async startUpgrade(playerId) {
    const base = query("SELECT * FROM player_bases WHERE player_id = ?", [playerId]).rows[0];
    if (!base) throw new Error("Base not found.");

    if (base.upgrade_ready_at > Date.now()) {
      throw new Error("Upgrade already in progress.");
    }

    // Cost logic: Simplified for now
    const durationMinutes = base.level * 30; // 30 mins per level
    const upgradeReadyAt = Date.now() + (durationMinutes * 60 * 1000);

    query(
      "UPDATE player_bases SET upgrade_ready_at = ? WHERE player_id = ?",
      [upgradeReadyAt, playerId]
    );

    return { 
      currentLevel: base.level, 
      nextLevel: base.level + 1,
      upgradeReadyAt 
    };
  }

  /**
   * Spend gems to skip the countdown.
   */
  static async skipUpgrade(playerId) {
    const base = query("SELECT * FROM player_bases WHERE player_id = ?", [playerId]).rows[0];
    if (!base) throw new Error("Base not found.");

    const remainingTimeMs = base.upgrade_ready_at - Date.now();
    if (remainingTimeMs <= 0) throw new Error("No active upgrade to skip.");

    const gemCost = Math.ceil(remainingTimeMs / (1000 * 60 * 5)); // 1 gem per 5 minutes
    
    if (base.gems < gemCost) throw new Error("Insufficient Gems.");

    // Transactional Update
    query(
      "UPDATE player_bases SET gems = gems - ?, level = level + 1, upgrade_ready_at = 0 WHERE player_id = ?",
      [gemCost, playerId]
    );

    return { newLevel: base.level + 1, remainingGems: base.gems - gemCost };
  }
}
