import { query } from "../db.js";
import { spendResources, buildingResourceCost } from "./resources.js";

// ─────────────────────────────────────────────
// BASE BUILDING SYSTEM
// ─────────────────────────────────────────────

/**
 * Building definitions. Each building has upgrade levels 1-20.
 * Costs scale with level. Certain buildings unlock unit tiers.
 */
export const BUILDINGS = {
  main_hall: {
    name: "Main Hall",
    description: "The heart of your settlement. Governs base level and unlocks other buildings.",
    maxLevel: 20,
    baseCost: { wood: 200, ore: 150, grain: 100 },
    costScale: 1.6,
    buildTimeSec: (lvl) => 60 * lvl * lvl,   // Scales quadratically
  },
  barracks: {
    name: "Barracks",
    description: "Trains infantry and unlocks higher unit tiers.",
    maxLevel: 20,
    baseCost: { wood: 150, ore: 200, grain: 50 },
    costScale: 1.5,
    buildTimeSec: (lvl) => 45 * lvl * lvl,
    unlocks: { 10: "tier3_infantry", 16: "tier4_infantry" },
  },
  stables: {
    name: "Stables",
    description: "Trains cavalry. Required for mounted commanders.",
    maxLevel: 20,
    baseCost: { wood: 100, ore: 250, grain: 100 },
    costScale: 1.5,
    buildTimeSec: (lvl) => 50 * lvl * lvl,
    unlocks: { 10: "tier3_cavalry", 16: "tier4_cavalry" },
  },
  archery_range: {
    name: "Archery Range",
    description: "Trains ranged units. Required for siege engineers.",
    maxLevel: 20,
    baseCost: { wood: 250, ore: 100, grain: 75 },
    costScale: 1.5,
    buildTimeSec: (lvl) => 40 * lvl * lvl,
    unlocks: { 10: "tier3_ranged", 16: "tier4_ranged" },
  },
  treasury: {
    name: "Treasury",
    description: "Increases Gem income and storage capacity.",
    maxLevel: 15,
    baseCost: { wood: 100, ore: 300, grain: 50 },
    costScale: 1.7,
    buildTimeSec: (lvl) => 90 * lvl * lvl,
  },
  granary: {
    name: "Granary",
    description: "Increases grain production and storage. Required for large army marches.",
    maxLevel: 20,
    baseCost: { wood: 200, ore: 50, grain: 200 },
    costScale: 1.4,
    buildTimeSec: (lvl) => 30 * lvl * lvl,
  },
  forge: {
    name: "Forge",
    description: "Required for equipment crafting and gear strengthening.",
    maxLevel: 15,
    baseCost: { wood: 50, ore: 400, grain: 50 },
    costScale: 1.6,
    buildTimeSec: (lvl) => 120 * lvl * lvl,
    unlocks: { 5: "gear_crafting", 10: "gear_refinement" },
  },
  watchtower: {
    name: "Watchtower",
    description: "Expands Fog of War visibility radius around your base.",
    maxLevel: 10,
    baseCost: { wood: 300, ore: 100, grain: 50 },
    costScale: 1.3,
    buildTimeSec: (lvl) => 20 * lvl * lvl,
  },
  wall: {
    name: "Fortification Wall",
    description: "Increases your base's Siege HP. Makes your city harder to capture.",
    maxLevel: 20,
    baseCost: { wood: 100, ore: 500, grain: 0 },
    costScale: 1.5,
    buildTimeSec: (lvl) => 60 * lvl * lvl,
  },
  academy: {
    name: "Academy",
    description: "Required for technology research. Higher levels unlock advanced techs.",
    maxLevel: 20,
    baseCost: { wood: 150, ore: 150, grain: 150 },
    costScale: 1.5,
    buildTimeSec: (lvl) => 80 * lvl * lvl,
    unlocks: { 5: "tech_tier2", 10: "tech_tier3", 15: "tech_tier4" },
  },
};

/**
 * Get the resource cost for upgrading a building to the next level.
 */
export function getBuildingUpgradeCost(buildingKey, currentLevel) {
  const def = BUILDINGS[buildingKey];
  if (!def) throw new Error(`Unknown building: ${buildingKey}`);
  const nextLevel = currentLevel + 1;
  if (nextLevel > def.maxLevel) throw new Error(`${def.name} is already at max level.`);

  const scale = Math.pow(def.costScale, currentLevel);
  return {
    wood:  Math.floor((def.baseCost.wood  || 0) * scale),
    ore:   Math.floor((def.baseCost.ore   || 0) * scale),
    grain: Math.floor((def.baseCost.grain || 0) * scale),
    timeSec: def.buildTimeSec(nextLevel),
  };
}

/**
 * Start a building upgrade. Returns the finish timestamp.
 */
export function startBuildingUpgrade(playerId, buildingKey) {
  const def = BUILDINGS[buildingKey];
  if (!def) throw new Error(`Unknown building: ${buildingKey}`);

  // Get current building level
  const bRes = query(
    "SELECT * FROM buildings WHERE player_id = ? AND building_key = ?",
    [playerId, buildingKey]
  );
  const currentLevel = bRes.rows[0]?.level ?? 0;

  // Check nothing else is building (Main Hall locks 1 slot)
  const activeRes = query(
    "SELECT * FROM buildings WHERE player_id = ? AND upgrade_finish_at > ?",
    [playerId, Math.floor(Date.now() / 1000)]
  );
  if (activeRes.rowCount > 0) {
    throw new Error("Another building is already under construction. Queue not yet available.");
  }

  const cost = getBuildingUpgradeCost(buildingKey, currentLevel);

  // Use the refined resource system
  spendResources(playerId, {
    wood: cost.wood,
    ore: cost.ore,
    grain: cost.grain
  });

  const now = Math.floor(Date.now() / 1000);
  const finishAt = now + cost.timeSec;

  query(`
    INSERT INTO buildings (player_id, building_key, level, upgrade_finish_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(player_id, building_key) DO UPDATE SET upgrade_finish_at = excluded.upgrade_finish_at
  `, [playerId, buildingKey, currentLevel, finishAt]);

  return { building: buildingKey, currentLevel, nextLevel: currentLevel + 1, finishAt };
}

/**
 * Collect completed building upgrades (call on player login or tick).
 */
export function collectBuildingUpgrades(playerId) {
  const now = Math.floor(Date.now() / 1000);
  const done = query(
    "SELECT * FROM buildings WHERE player_id = ? AND upgrade_finish_at <= ? AND upgrade_finish_at > 0",
    [playerId, now]
  );

  for (const b of done.rows) {
    const def = BUILDINGS[b.building_key];
    const newLevel = (b.level ?? 0) + 1;
    query(
      "UPDATE buildings SET level = ?, upgrade_finish_at = 0 WHERE player_id = ? AND building_key = ?",
      [newLevel, playerId, b.building_key]
    );

    // Check if main_hall upgrade also bumps base level
    if (b.building_key === "main_hall") {
      query("UPDATE player_bases SET level = ? WHERE player_id = ?", [newLevel, playerId]);
    }

    console.log(`[Building] ${playerId} completed ${b.building_key} → Lvl ${newLevel}`);

    // Handle unlock side-effects
    if (def?.unlocks?.[newLevel]) {
      console.log(`[Building] Unlock triggered: ${def.unlocks[newLevel]} for ${playerId}`);
    }
  }

  return done.rows.length;
}

/**
 * Get all building levels for a player.
 */
export function getBuildings(playerId) {
  const res = query("SELECT * FROM buildings WHERE player_id = ?", [playerId]);
  const now = Math.floor(Date.now() / 1000);
  return res.rows.map(b => ({
    key:         b.building_key,
    level:       b.level ?? 0,
    name:        BUILDINGS[b.building_key]?.name ?? b.building_key,
    maxLevel:    BUILDINGS[b.building_key]?.maxLevel ?? 20,
    isUpgrading: (b.upgrade_finish_at ?? 0) > now,
    finishAt:    b.upgrade_finish_at ?? 0,
    secondsLeft: Math.max(0, (b.upgrade_finish_at ?? 0) - now),
  }));
}
