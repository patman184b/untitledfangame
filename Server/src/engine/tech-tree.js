import { query } from "../db.js";
import { spendResources } from "./resources.js";

// ─────────────────────────────────────────────
// TECHNOLOGY TREE
// ─────────────────────────────────────────────

/**
 * Tech tree organized into 3 branches: Military, Economy, Fortification.
 * Each tech has prerequisites and Academy level requirements.
 */
export const TECH_TREE = {
  // ── MILITARY BRANCH ──
  mil_training_1: {
    name: "Basic Training",
    branch: "military",
    description: "+5% unit attack for all armies.",
    tier: 1,
    requires: [],
    academyRequired: 1,
    cost: { wood: 300, ore: 300, grain: 100 },
    researchTimeSec: 600,
    effect: { unit_attack_pct: 5 },
  },
  mil_training_2: {
    name: "Advanced Tactics",
    branch: "military",
    description: "+10% unit attack, +5% unit defense.",
    tier: 2,
    requires: ["mil_training_1"],
    academyRequired: 5,
    cost: { wood: 600, ore: 700, grain: 200 },
    researchTimeSec: 1800,
    effect: { unit_attack_pct: 10, unit_defense_pct: 5 },
  },
  mil_siege_1: {
    name: "Siege Engineering",
    branch: "military",
    description: "+15% siege damage dealt to structures.",
    tier: 2,
    requires: ["mil_training_1"],
    academyRequired: 5,
    cost: { wood: 500, ore: 800, grain: 100 },
    researchTimeSec: 1800,
    effect: { siege_damage_pct: 15 },
  },
  mil_cavalry_1: {
    name: "Horse Breeding",
    branch: "military",
    description: "+10% cavalry march speed.",
    tier: 2,
    requires: ["mil_training_1"],
    academyRequired: 5,
    cost: { wood: 200, ore: 400, grain: 500 },
    researchTimeSec: 1500,
    effect: { cavalry_speed_pct: 10 },
  },
  mil_elite_1: {
    name: "Elite Corps",
    branch: "military",
    description: "+20% all unit stats. Unlocks Tier 3 unit training globally.",
    tier: 3,
    requires: ["mil_training_2", "mil_siege_1"],
    academyRequired: 10,
    cost: { wood: 1200, ore: 1500, grain: 500 },
    researchTimeSec: 7200,
    effect: { unit_all_pct: 20 },
  },
  mil_warband_1: {
    name: "War Council",
    branch: "military",
    description: "Unlocks the Rally Attack feature. Allows commanding up to 5 allies.",
    tier: 4,
    requires: ["mil_elite_1"],
    academyRequired: 15,
    cost: { wood: 2000, ore: 3000, grain: 1000 },
    researchTimeSec: 14400,
    effect: { rally_enabled: true },
  },

  // ── ECONOMY BRANCH ──
  eco_farming_1: {
    name: "Crop Rotation",
    branch: "economy",
    description: "+10% grain production from all owned tiles.",
    tier: 1,
    requires: [],
    academyRequired: 1,
    cost: { wood: 200, ore: 50, grain: 300 },
    researchTimeSec: 600,
    effect: { grain_pct: 10 },
  },
  eco_mining_1: {
    name: "Deep Mining",
    branch: "economy",
    description: "+10% ore production from all owned tiles.",
    tier: 1,
    requires: [],
    academyRequired: 1,
    cost: { wood: 100, ore: 400, grain: 100 },
    researchTimeSec: 600,
    effect: { ore_pct: 10 },
  },
  eco_lumber_1: {
    name: "Lumbermills",
    branch: "economy",
    description: "+10% wood production from all owned tiles.",
    tier: 1,
    requires: [],
    academyRequired: 1,
    cost: { wood: 400, ore: 100, grain: 100 },
    researchTimeSec: 600,
    effect: { wood_pct: 10 },
  },
  eco_trade_1: {
    name: "Trade Routes",
    branch: "economy",
    description: "+5 gems per hour passively.",
    tier: 2,
    requires: ["eco_farming_1", "eco_mining_1"],
    academyRequired: 5,
    cost: { wood: 500, ore: 500, grain: 500 },
    researchTimeSec: 3600,
    effect: { gems_per_hour: 5 },
  },
  eco_logistics_1: {
    name: "Supply Chains",
    branch: "economy",
    description: "+25% march army capacity.",
    tier: 3,
    requires: ["eco_trade_1"],
    academyRequired: 10,
    cost: { wood: 1000, ore: 1000, grain: 1000 },
    researchTimeSec: 7200,
    effect: { army_capacity_pct: 25 },
  },

  // ── FORTIFICATION BRANCH ──
  fort_masonry_1: {
    name: "Stone Masonry",
    branch: "fortification",
    description: "+20% Siege HP on your base.",
    tier: 1,
    requires: [],
    academyRequired: 1,
    cost: { wood: 100, ore: 500, grain: 50 },
    researchTimeSec: 900,
    effect: { base_siege_hp_pct: 20 },
  },
  fort_traps_1: {
    name: "Trench Warfare",
    branch: "fortification",
    description: "Attackers take 5% of their own force as casualties when attacking your base.",
    tier: 2,
    requires: ["fort_masonry_1"],
    academyRequired: 5,
    cost: { wood: 400, ore: 600, grain: 200 },
    researchTimeSec: 2400,
    effect: { attacker_trench_loss_pct: 5 },
  },
  fort_ramparts_1: {
    name: "Ramparts",
    branch: "fortification",
    description: "+50% Siege HP on your base. Drastically slows structure regen time after capture.",
    tier: 3,
    requires: ["fort_traps_1"],
    academyRequired: 10,
    cost: { wood: 800, ore: 2000, grain: 300 },
    researchTimeSec: 10800,
    effect: { base_siege_hp_pct: 50, structure_regen_rate_pct: -30 },
  },
};

// ─────────────────────────────────────────────
// RESEARCH FUNCTIONS
// ─────────────────────────────────────────────

/** Get all researched techs for a player */
export function getPlayerTechs(playerId) {
  const res = query("SELECT tech_key, completed_at FROM player_techs WHERE player_id = ?", [playerId]);
  return res.rows;
}

/** Get the aggregate effects of all researched techs */
export function getTechEffects(playerId) {
  const techs = getPlayerTechs(playerId);
  const effects = {};
  for (const t of techs) {
    const def = TECH_TREE[t.tech_key];
    if (!def) continue;
    for (const [k, v] of Object.entries(def.effect)) {
      effects[k] = (effects[k] || 0) + v;
    }
  }
  return effects;
}

/** Start researching a technology */
export function startResearch(playerId, techKey) {
  const def = TECH_TREE[techKey];
  if (!def) throw new Error(`Unknown technology: ${techKey}`);

  // Check already researched
  const existing = query(
    "SELECT * FROM player_techs WHERE player_id = ? AND tech_key = ?",
    [playerId, techKey]
  );
  if (existing.rowCount > 0) throw new Error(`${def.name} is already researched.`);

  // Check prerequisites
  for (const req of def.requires) {
    const prereq = query(
      "SELECT * FROM player_techs WHERE player_id = ? AND tech_key = ?",
      [playerId, req]
    );
    if (prereq.rowCount === 0) {
      throw new Error(`Prerequisite not met: ${TECH_TREE[req]?.name ?? req}`);
    }
  }

  // Check Academy level
  const buildingRes = query(
    "SELECT level FROM buildings WHERE player_id = ? AND building_key = 'academy'",
    [playerId]
  );
  const academyLevel = buildingRes.rows[0]?.level ?? 0;
  if (academyLevel < def.academyRequired) {
    throw new Error(`Academy level ${def.academyRequired} required (yours: ${academyLevel}).`);
  }

  // Check no other research running
  const activeRes = query(
    "SELECT * FROM player_techs WHERE player_id = ? AND finish_at > ?",
    [playerId, Math.floor(Date.now() / 1000)]
  );
  if (activeRes.rowCount > 0) throw new Error("Already researching a technology.");

  // Cost check via the resource system
  spendResources(playerId, {
    wood: def.cost.wood,
    ore: def.cost.ore,
    grain: def.cost.grain,
    stone: def.cost.stone || 0
  });

  const now = Math.floor(Date.now() / 1000);
  const finishAt = now + def.researchTimeSec;

  query(`
    INSERT INTO player_techs (player_id, tech_key, started_at, finish_at, completed_at)
    VALUES (?, ?, ?, ?, NULL)
  `, [playerId, techKey, now, finishAt]);

  return { techKey, name: def.name, finishAt };
}

/** Collect completed research (call on tick or login) */
export function collectResearch(playerId) {
  const now = Math.floor(Date.now() / 1000);
  const done = query(
    "SELECT * FROM player_techs WHERE player_id = ? AND finish_at <= ? AND completed_at IS NULL",
    [playerId, now]
  );
  for (const t of done.rows) {
    query(
      "UPDATE player_techs SET completed_at = ? WHERE player_id = ? AND tech_key = ?",
      [now, playerId, t.tech_key]
    );
    console.log(`[Tech] ${playerId} completed research: ${t.tech_key}`);
  }
  return done.rows.length;
}
