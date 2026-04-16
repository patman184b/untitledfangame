import { query } from "../db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const unitData = JSON.parse(fs.readFileSync(path.join(__dirname, "../../data/unit-data.json"), "utf8")).units;

export class RecruitmentManager {
  /**
   * Start training a batch of units.
   */
  static async startRecruitment(playerId, unitId, count) {
    const unit = unitData.find(u => u.id === unitId);
    if (!unit) throw new Error("Unit not found.");

    // Resource check & deduction
    const totalCost = {
      wood:  (unit.cost?.wood  || 0) * count,
      ore:   (unit.cost?.ore   || 0) * count,
      grain: (unit.cost?.grain || 0) * count,
      stone: (unit.cost?.stone || 0) * count,
    };

    import("./resources.js").then(m => m.spendResources(playerId, totalCost));

    const trainingTimeSec = (unit.trainingTimeSec || 1) * count;
    const finishAt = Math.floor(Date.now() / 1000) + trainingTimeSec;

    const id = `recruit_${Date.now()}`;
    query(
      "INSERT INTO recruitment_queue (id, player_id, unit_id, count, finish_at) VALUES (?, ?, ?, ?, ?)",
      [id, playerId, unitId, count, finishAt]
    );

    return { id, finishAt, unitId, count };
  }

  static getTrainingTime(type) {
    switch (type) {
      case "small": return 1;
      case "medium": return 2;
      case "large": return 5;
      default: return 1;
    }
  }

  /**
   * Process and complete finished recruitment orders.
   * Called by the ShardEngine on every tick.
   */
  static async processQueue() {
    const finished = query(
      "SELECT * FROM recruitment_queue WHERE finish_at <= ?",
      [Date.now()]
    );

    for (const order of finished.rows) {
      console.log(`Completing recruitment for Player ${order.player_id}: ${order.count} x ${order.unit_id}`);
      
      // Add units to inventory
      query(
        "INSERT INTO unit_inventory (player_id, unit_id, count) VALUES (?, ?, ?) ON CONFLICT(player_id, unit_id) DO UPDATE SET count = count + ?",
        [order.player_id, order.unit_id, order.count, order.count]
      );

      // Remove from queue
      query("DELETE FROM recruitment_queue WHERE id = ?", [order.id]);
    }
  }
}
