import { query } from "../db.js";

/**
 * Production rates per tile level (hourly yield scaled by level 1-13)
 * Units: resources per hour per tile
 */
const PRODUCTION_BY_LEVEL = {
  grain: (lvl) => 50 + (lvl * 25),   // e.g. Lvl 1 = 75/h, Lvl 13 = 375/h
  ore:   (lvl) => 30 + (lvl * 15),
  wood:  (lvl) => 40 + (lvl * 20),
};

const TERRAIN_RESOURCE = {
  'Gg': 'grain',
  'Hh': 'ore',
  'Ff': 'wood',
};

/**
 * Calculate individual player income.
 * Only tiles where owner_id === playerId count toward that player's production.
 * Faction/alliance does NOT receive shared resources.
 */
export function calculatePlayerIncome(playerId) {
  const res = query(`
    SELECT terrain, level
    FROM tiles
    WHERE owner_id = ?
    AND terrain IN ('Gg', 'Hh', 'Ff')
  `, [playerId]);

  let grain = 0, ore = 0, wood = 0;
  for (const tile of res.rows) {
    const resource = TERRAIN_RESOURCE[tile.terrain];
    const rate = PRODUCTION_BY_LEVEL[resource]?.(tile.level ?? 1) ?? 0;
    if (resource === 'grain') grain += rate;
    if (resource === 'ore')   ore   += rate;
    if (resource === 'wood')  wood  += rate;
  }

  return { grain, ore, wood, total: grain + ore + wood };
}

/**
 * Tick job: Apply accumulated income to all players who own tiles.
 * Called every game tick (e.g., hourly real-time or configurable per shard speed).
 */
export async function processResourceTicks() {
  console.log("Processing individual land-based resource income...");

  // Get all distinct player owners
  const owners = query(`
    SELECT DISTINCT owner_id FROM tiles WHERE owner_id IS NOT NULL
  `);

  for (const { owner_id } of owners.rows) {
    const income = calculatePlayerIncome(owner_id);
    if (income.total === 0) continue;

    // Write to player_bases resource balance
    // Note: player_bases tracks gems; a separate resources table may be warranted in production
    // For now we use the grain/ore/wood columns if they exist, or skip gracefully
    try {
      query(`
        UPDATE player_bases 
        SET gems = gems + ?
        WHERE player_id = ?
      `, [Math.floor(income.total / 100), owner_id]); // 100 resources = 1 gem equivalent for now
    } catch (e) {
      console.warn(`Income tick skipped for ${owner_id}: ${e.message}`);
    }
  }
}

/**
 * Get a player's realtime production summary for the strategic HUD overlay.
 * Returns formatted { grain_per_hour, ore_per_hour, wood_per_hour, total_power_production }
 */
export function getPlayerProductionSummary(playerId) {
  const income = calculatePlayerIncome(playerId);
  return {
    grain_per_hour: income.grain,
    ore_per_hour:   income.ore,
    wood_per_hour:  income.wood,
    total_power_production: income.total, // Displayed in Alliance Member list as "Power Production"
  };
}


