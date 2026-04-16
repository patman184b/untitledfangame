import { query } from "../db.js";

export class FormationManager {
  /**
   * Assign units from player inventory to a commander's formations.
   * slots: array of { slotIndex (1-3), unitId, count }
   */
  static async updateFormation(commanderId, playerId, slots) {
    // 1. Validate Ownership: Total units of each type being assigned must be in inventory
    const required = {};
    for (const s of slots) {
        if (!required[s.unitId]) required[s.unitId] = 0;
        required[s.unitId] += s.count;
    }

    for (const [unitId, needed] of Object.entries(required)) {
        const inv = query("SELECT count FROM unit_inventory WHERE player_id = ? AND unit_id = ?", [playerId, unitId]);
        if (inv.rowCount === 0 || inv.rows[0].count < needed) {
            throw new Error(`Insufficient ${unitId} in inventory.`);
        }
    }

    // 2. Perform Atomic Update
    // [Note] In a production app this would be a single transaction.
    for (const s of slots) {
        query(
            `UPDATE commander_army SET slot_${s.slotIndex}_unit = ?, slot_${s.slotIndex}_count = ? WHERE commander_id = ?`,
            [s.unitId, s.count, commanderId]
        );
    }

    return { ok: true };
  }
}
