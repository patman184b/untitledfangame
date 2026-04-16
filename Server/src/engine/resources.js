import { query } from "../db.js";

// ─────────────────────────────────────────────
// RESOURCE ENGINE
// Handles earn / spend / check for wood, ore, grain, stone
// ─────────────────────────────────────────────

// Storage caps per resource (scales with Granary level)
const BASE_STORAGE = {
  wood:  50_000,
  ore:   50_000,
  grain: 50_000,
  stone: 20_000,
};

const STORAGE_PER_GRANARY_LEVEL = {
  wood:  2_000,
  ore:   1_500,
  grain: 3_000,
  stone: 800,
};

export function getStorageCap(playerId) {
  const granaryRes = query(
    "SELECT level FROM buildings WHERE player_id = ? AND building_key = 'granary'",
    [playerId]
  );
  const granaryLevel = granaryRes.rows[0]?.level ?? 0;
  return {
    wood:  BASE_STORAGE.wood  + granaryLevel * STORAGE_PER_GRANARY_LEVEL.wood,
    ore:   BASE_STORAGE.ore   + granaryLevel * STORAGE_PER_GRANARY_LEVEL.ore,
    grain: BASE_STORAGE.grain + granaryLevel * STORAGE_PER_GRANARY_LEVEL.grain,
    stone: BASE_STORAGE.stone + granaryLevel * STORAGE_PER_GRANARY_LEVEL.stone,
  };
}

export function getResources(playerId) {
  const res = query(
    "SELECT wood, ore, grain, stone FROM player_resources WHERE player_id = ?",
    [playerId]
  );
  if (res.rowCount === 0) {
    // Initialize if missing
    const now = Math.floor(Date.now() / 1000);
    query(
      "INSERT INTO player_resources (player_id, wood, ore, grain, stone, last_tick_at) VALUES (?, 1000, 1000, 1000, 500, ?)",
      [playerId, now]
    );
    return { wood: 1000, ore: 1000, grain: 1000, stone: 500 };
  }
  return res.rows[0];
}

/**
 * Spend resources. Throws if insufficient.
 * cost = { wood?, ore?, grain?, stone? }
 */
export function spendResources(playerId, cost) {
  const bal = getResources(playerId);

  for (const [res, amount] of Object.entries(cost)) {
    if (!amount) continue;
    if ((bal[res] ?? 0) < amount) {
      throw new Error(`Insufficient ${res}: need ${amount}, have ${bal[res] ?? 0}.`);
    }
  }

  // Build SET clause dynamically
  const sets  = [];
  const vals  = [];
  for (const [res, amount] of Object.entries(cost)) {
    if (!amount) continue;
    sets.push(`${res} = ${res} - ?`);
    vals.push(amount);
  }
  vals.push(playerId);
  query(`UPDATE player_resources SET ${sets.join(", ")} WHERE player_id = ?`, vals);
}

/**
 * Add resources, capped at storage cap.
 * amounts = { wood?, ore?, grain?, stone? }
 */
export function earnResources(playerId, amounts) {
  const cap = getStorageCap(playerId);
  const bal = getResources(playerId);

  const sets = [];
  const vals = [];
  for (const [res, amount] of Object.entries(amounts)) {
    if (!amount) continue;
    const capped = Math.min(amount, cap[res] - (bal[res] ?? 0));
    if (capped <= 0) continue;
    sets.push(`${res} = ${res} + ?`);
    vals.push(capped);
  }

  if (sets.length === 0) return; // All capped
  vals.push(playerId);
  query(`UPDATE player_resources SET ${sets.join(", ")} WHERE player_id = ?`, vals);
}

/**
 * Check affordability without spending.
 * Returns { canAfford: bool, missing: { wood, ore, grain, stone } }
 */
export function checkAffordable(playerId, cost) {
  const bal = getResources(playerId);
  const missing = {};
  let canAfford = true;

  for (const [res, amount] of Object.entries(cost)) {
    if (!amount) continue;
    const deficit = amount - (bal[res] ?? 0);
    if (deficit > 0) {
      missing[res] = deficit;
      canAfford = false;
    }
  }
  return { canAfford, missing, balance: bal };
}

/**
 * Building upgrade costs — real resources, replacing gem proxy.
 * Mirrors the gem cost formula but in wood/ore/grain.
 */
export function buildingResourceCost(buildingDef, currentLevel) {
  const scale = Math.pow(buildingDef.costScale, currentLevel);
  return {
    wood:    Math.floor((buildingDef.baseCost.wood  || 0) * scale),
    ore:     Math.floor((buildingDef.baseCost.ore   || 0) * scale),
    grain:   Math.floor((buildingDef.baseCost.grain || 0) * scale),
  };
}

/**
 * Income tick — called by cron.
 * Adds per-tile owned production to each player.
 */
export function processResourceTicks() {
  // Get all owned tiles grouped by owner
  const tiles = query(`
    SELECT owner_id, terrain, level FROM tiles
    WHERE owner_id IS NOT NULL
  `);

  // Group by player
  const byPlayer = {};
  for (const t of tiles.rows) {
    if (!byPlayer[t.owner_id]) byPlayer[t.owner_id] = [];
    byPlayer[t.owner_id].push(t);
  }

  const TICK_RATE = 1 / 12; // Income per tile per tick (~5min ticks, 12/hour)
  const TERRAIN_YIELDS = {
    Gg: { grain: 10 },
    Hh: { ore: 8 },
    Mm: { stone: 6 },
    Ff: { wood: 10 },
    Kk: { grain: 5, ore: 3, wood: 3 }, // Capital
  };

  for (const [playerId, playerTiles] of Object.entries(byPlayer)) {
    const totals = { wood: 0, ore: 0, grain: 0, stone: 0 };

    for (const tile of playerTiles) {
      const yields = TERRAIN_YIELDS[tile.terrain] ?? { grain: 5 };
      const levelMult = 1 + (tile.level - 1) * 0.15; // +15% per level above 1
      for (const [res, base] of Object.entries(yields)) {
        totals[res] += Math.floor(base * levelMult * TICK_RATE);
      }
    }

    try {
      earnResources(playerId, totals);
    } catch (e) {
      // Swallow — player may have hit caps
    }
  }
}
