import { query } from "../db.js";

export class CommanderManager {
  static async addExperience(commanderId, xpAmount) {
    const res = await query("SELECT * FROM commanders WHERE id = $1", [commanderId]);
    if (res.rowCount === 0) return;
    
    let { level, xp } = res.rows[0];
    xp += xpAmount;
    
    // Simple level up logic: level * 1000
    let levelUpXp = level * 1000;
    let didLevelUp = false;
    
    while (xp >= levelUpXp) {
      xp -= levelUpXp;
      level += 1;
      levelUpXp = level * 1000;
      didLevelUp = true;
    }
    
    if (didLevelUp) {
      await query(
        "UPDATE commanders SET level = $1, xp = $2, skill_points = skill_points + 1 WHERE id = $3",
        [level, xp, commanderId]
      );
    } else {
      await query("UPDATE commanders SET xp = $1 WHERE id = $2", [xp, commanderId]);
    }
    
    return { level, xp, didLevelUp };
  }

  static async getStats(commanderId) {
    // [TODO] Calculate derived stats based on growth + level
  }
}
