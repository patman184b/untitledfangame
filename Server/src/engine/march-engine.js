import { query } from "../db.js";
import { spendResources, earnResources, getResources } from "./resources.js";
import { v4 as uuidv4 } from "uuid";

// ─────────────────────────────────────────────
// MARCH ENGINE
// Handles queuing, validating, and completing marches.
// ─────────────────────────────────────────────

const MARCH_SPEED_TILES_PER_MIN = 2;       // Base: 2 tiles/min
const GRAIN_COST_PER_1000_TROOPS = 50;     // Grain consumed on departure

export function queueMarch(playerId, payload) {
  const { commanderId, toX, toY, troops } = payload;

  // Validate player base location
  const baseRes = query("SELECT x, y FROM player_bases WHERE player_id = ?", [playerId]);
  if (baseRes.rowCount === 0) throw new Error("No base found for player.");
  const { x: fromX, y: fromY } = baseRes.rows[0];

  // Validate destination tile exists and is passable
  const tileRes = query("SELECT * FROM tiles WHERE x = ? AND y = ?", [toX, toY]);
  if (tileRes.rowCount === 0) throw new Error("Invalid destination tile.");
  const tile = tileRes.rows[0];
  if (tile.terrain === "Ww") throw new Error("Cannot march into water.");

  // Validate troop count
  const troopCount = Number(troops) || 1000;
  if (troopCount < 1 || troopCount > 500_000) throw new Error("Invalid troop count.");

  // Grain cost
  const grainCost = Math.floor((troopCount / 1000) * GRAIN_COST_PER_1000_TROOPS);
  spendResources(playerId, { grain: grainCost });

  // Calculate travel time
  const dist     = Math.abs(toX - fromX) + Math.abs(toY - fromY);
  const travelMs = Math.max(30_000, (dist / MARCH_SPEED_TILES_PER_MIN) * 60_000);
  const now      = Math.floor(Date.now() / 1000);
  const arriveAt = now + Math.floor(travelMs / 1000);

  const marchId = uuidv4();

  query(`
    INSERT INTO marches
      (id, player_id, commander_id, from_x, from_y, to_x, to_y, troops,
       grain_cost, status, depart_at, arrive_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'marching', ?, ?)
  `, [marchId, playerId, commanderId ?? null, fromX, fromY, toX, toY,
      troopCount, grainCost, now, arriveAt]);

  console.log(`[March] ${playerId} → (${toX},${toY}) | troops:${troopCount} | arrives:${new Date(arriveAt * 1000).toISOString()}`);

  return { marchId, fromX, fromY, toX, toY, troopCount, arriveAt, grainCost };
}

export function getActiveMarches(playerId) {
  return query(
    "SELECT * FROM marches WHERE player_id = ? AND status = 'marching' ORDER BY arrive_at ASC",
    [playerId]
  ).rows;
}

export function getAllMarches() {
  // For map overlay — all active marches visible to clients
  return query("SELECT * FROM marches WHERE status = 'marching'").rows;
}

export function recallMarch(playerId, marchId) {
  const res = query(
    "SELECT * FROM marches WHERE id = ? AND player_id = ? AND status = 'marching'",
    [marchId, playerId]
  );
  if (res.rowCount === 0) throw new Error("March not found or already completed.");
  query("UPDATE marches SET status = 'recalled' WHERE id = ?", [marchId]);
  // Refund half the grain
  const march = res.rows[0];
  if (march.grain_cost > 0) earnResources(playerId, { grain: Math.floor(march.grain_cost / 2) });
  return { recalled: true };
}

/**
 * Process all marches that have arrived — called on server tick.
 * Returns list of completed march IDs.
 */
export async function tickMarches() {
  const now = Math.floor(Date.now() / 1000);
  const due = query(
    "SELECT * FROM marches WHERE status = 'marching' AND arrive_at <= ?",
    [now]
  );

  const completed = [];
  for (const march of due.rows) {
    try {
      await resolveMarchArrival(march);
      completed.push(march.id);
    } catch (e) {
      console.error(`[March] Failed to resolve ${march.id}:`, e.message);
      query("UPDATE marches SET status = 'failed' WHERE id = ?", [march.id]);
    }
  }
  return completed;
}

async function resolveMarchArrival(march) {
  const tile = query("SELECT * FROM tiles WHERE x = ? AND y = ?", [march.to_x, march.to_y]).rows[0];
  if (!tile) { query("UPDATE marches SET status = 'failed' WHERE id = ?", [march.id]); return; }

  if (!tile.owner_id || tile.owner_id === march.player_id) {
    // Uncaptured or own tile — claim it
    query("UPDATE tiles SET owner_id = ? WHERE x = ? AND y = ?",
      [march.player_id, march.to_x, march.to_y]);
    query("UPDATE marches SET status = 'completed', result = 'capture' WHERE id = ?", [march.id]);
    console.log(`[March] ${march.player_id} captured (${march.to_x},${march.to_y})`);
  } else {
    // Enemy tile — trigger combat (imports from handlers.js to avoid circular dep)
    const { completeMarch } = await import("../actions/handlers.js");
    await completeMarch({
      playerId:    march.player_id,
      commanderId: march.commander_id,
      toX:         march.to_x,
      toY:         march.to_y,
      troops:      march.troops,
      marchId:     march.id,
    });
  }
}
