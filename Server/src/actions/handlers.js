import { query } from "../db.js";
import { CombatResolver } from "../engine/combat-resolver.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Handle completion of a recruitment action.
 */
export async function completeRecruit(payload) {
  const { playerId, unitId, count } = payload;
  console.log(`[Recruit] Completed training: ${count}x ${unitId} for ${playerId}`);

  query(`
    INSERT INTO unit_inventory (player_id, unit_id, count)
    VALUES (?, ?, ?)
    ON CONFLICT(player_id, unit_id) DO UPDATE SET count = count + excluded.count
  `, [playerId, unitId, count]);
}

/**
 * Handle completion of a march action.
 */
export async function completeMarch(payload) {
  const { armyId, toX, toY, playerId } = payload;
  console.log(`March complete for army ${armyId} to (${toX}, ${toY})`);
  
  // 1. Fetch Tile State
  const tileRes = query("SELECT * FROM tiles WHERE x = ? AND y = ?", [toX, toY]);
  const tile = tileRes.rows[0];

  if (!tile) {
      console.error("Target tile does not exist!");
      return;
  }

  // 2. Resolve Tile Defense (NPC or Player)
  const defenderRes = query(
    "SELECT * FROM player_bases WHERE x = ? AND y = ? AND player_id != ?",
    [toX, toY, playerId]
  );
  
  const attacker = await getFullArmy(armyId);
  let combatResult = null;

  if (defenderRes.rowCount > 0) {
    const defender = await getFullArmy(defenderRes.rows[0].player_id);
    combatResult = CombatResolver.resolve(attacker, defender);
  } else if (tile.defenders_json) {
    // NPC Garrison Combat
    combatResult = CombatResolver.resolve(attacker, { formations: tile.defenders_json, commander: { name: "Garrison", might: 0, focus: 0, speed: 0, command: 1 } });
  }

  if (combatResult) {
    // Save battle report (tagged with current season_day)
    const shardRes = query("SELECT season_day FROM shards LIMIT 1");
    const seasonDay = shardRes.rows[0]?.season_day ?? 1;
    saveBattleReport(playerId, defenderRes.rows[0]?.player_id, combatResult, seasonDay);

    applyCasualties(attacker.commanderId, combatResult.casualties.attacker);

    if (combatResult.result === 'draw') {
      // Stay on tile — schedule re-engagement in 5 minutes
      const reTrigger = Math.floor(Date.now() / 1000) + 300;
      query(
        `INSERT OR REPLACE INTO rallies (id, leader_id, alliance_id, target_x, target_y, trigger_at, status)
         VALUES (?, ?, NULL, ?, ?, ?, 'draw_reengagement')`,
        [uuidv4(), playerId, toX, toY, reTrigger]
      );
      console.log(`DRAW at (${toX}, ${toY}) — re-engagement scheduled in 5 min.`);
      return;
    }

    if (combatResult.winner === 'defender') {
      console.log(`Attack failed at (${toX}, ${toY}).`);
      return;
    }

    // Grant contribution for captures
    grantContribution(playerId, 50);
  }

  // 3. Resolve Siege (Wall Damage)
  const siegeRes = CombatResolver.resolveSiege(attacker, tile.siege_hp);
  const now = Math.floor(Date.now() / 1000);

  if (tile.structure_id) {
    query("UPDATE tiles SET siege_hp = ?, last_siege_damage_at = ? WHERE structure_id = ?",
      [siegeRes.remainingHP, now, tile.structure_id]);
  } else {
    query("UPDATE tiles SET siege_hp = ?, last_siege_damage_at = ? WHERE x = ? AND y = ?",
      [siegeRes.remainingHP, now, toX, toY]);
  }

  if (siegeRes.remainingHP <= 0) {
    await captureTile(toX, toY, playerId, tile.region_id, tile.structure_id);
  }

  // 4. Update army position
  query("UPDATE player_bases SET x = ?, y = ? WHERE player_id = ?", [toX, toY, playerId]);
}

async function captureTile(x, y, newOwner, regionId, structureId) {
  console.log(`Tile Captured at (${x}, ${y}) by ${newOwner}`);

  // Individual ownership — only this specific tile, not the whole faction
  query("UPDATE tiles SET owner_id = ? WHERE x = ? AND y = ?", [newOwner, x, y]);

  if (structureId) {
    const structRes = query("SELECT * FROM structures WHERE id = ?", [structureId]);
    const struct = structRes.rows[0];

    if (struct?.type === 'city') {
      console.log(`CITY CAPTURED: Flipping Region ${regionId}`);
      await flipRegion(regionId, newOwner);

      // First Occupation Reward (one-time, per city)
      const cityRes = query("SELECT * FROM cities WHERE x = ? AND y = ?", [x, y]);
      const city = cityRes.rows[0];
      if (city && !city.first_capturer_id) {
        const ts = Math.floor(Date.now() / 1000);
        query("UPDATE cities SET first_capturer_id = ?, first_captured_at = ? WHERE x = ? AND y = ?",
          [newOwner, ts, x, y]);
        query("UPDATE player_bases SET gems = gems + 100 WHERE player_id = ?", [newOwner]);
        console.log(`FIRST OCCUPATION: +100 gems granted to ${newOwner}`);
      }
    }

    // Reset Siege HP on capture
    query("UPDATE tiles SET siege_hp = max_siege_hp WHERE structure_id = ?", [structureId]);
  } else {
    query("UPDATE tiles SET siege_hp = max_siege_hp WHERE x = ? AND y = ?", [x, y]);
  }
}

async function flipRegion(regionId, newFactionId) {
  // Map tinting pulse — individual resource tiles remain neutral until captured
  query("UPDATE tiles SET defenders_json = NULL WHERE region_id = ?", [regionId]);
  console.log(`Region ${regionId} map color flipped to faction ${newFactionId}`);
}

// ─────────────────────────────────────────────
// RALLY SYSTEM
// ─────────────────────────────────────────────

/**
 * Create a timed group attack. Allies join; all armies auto-send at trigger_at.
 */
export function createRally(leaderId, allianceId, targetX, targetY, triggerAt) {
  const id = uuidv4();
  query(
    "INSERT INTO rallies (id, leader_id, alliance_id, target_x, target_y, trigger_at, status) VALUES (?, ?, ?, ?, ?, ?, 'open')",
    [id, leaderId, allianceId, targetX, targetY, triggerAt]
  );
  query("INSERT OR IGNORE INTO rally_members (rally_id, player_id, commander_id) VALUES (?, ?, ?)",
    [id, leaderId, leaderId]);
  console.log(`Rally ${id} scheduled. Launches: ${new Date(triggerAt * 1000).toISOString()}`);
  return id;
}

/** Tick: Launch all rallies and draw re-engagements that are due. */
export function tickRallies() {
  const now = Math.floor(Date.now() / 1000);
  const ready = query(
    "SELECT * FROM rallies WHERE status IN ('open', 'draw_reengagement') AND trigger_at <= ?", [now]
  );
  for (const rally of ready.rows) {
    const members = query("SELECT * FROM rally_members WHERE rally_id = ?", [rally.id]);
    for (const m of members.rows) {
      completeMarch({ armyId: m.commander_id, toX: rally.target_x, toY: rally.target_y, playerId: m.player_id });
    }
    query("UPDATE rallies SET status = 'launched' WHERE id = ?", [rally.id]);
    console.log(`Rally ${rally.id} launched with ${members.rowCount} army/armies.`);
  }
}

// ─────────────────────────────────────────────
// STAMINA TICK (global cron — every 10 minutes)
// ─────────────────────────────────────────────

export function tickStamina() {
  const now = Math.floor(Date.now() / 1000);
  // +1 stamina per tick, regardless of location, capped at 150
  query(`
    UPDATE commander_state 
    SET stamina = MIN(150, stamina + 1), last_stamina_tick = ?
    WHERE stamina < 150
  `, [now]);
}

// ─────────────────────────────────────────────
// SIEGE REGEN TICK (global cron — every hour)
// ─────────────────────────────────────────────

export function tickSiegeRegen() {
  const now = Math.floor(Date.now() / 1000);
  // 5% HP regen per hour on uncaptured tiles idle for >1h since last damage
  query(`
    UPDATE tiles
    SET siege_hp = MIN(max_siege_hp, siege_hp + CAST(max_siege_hp * 0.05 AS INTEGER))
    WHERE owner_id IS NULL
      AND last_siege_damage_at IS NOT NULL
      AND (? - last_siege_damage_at) > 3600
  `, [now]);
}

// ─────────────────────────────────────────────
// RESPECT SYSTEM
// ─────────────────────────────────────────────

/** Apply Respect items from Gacha/Mathom. Permanently unlocks heroes and gear. */
export function applyRespectItem(playerId, commanderId, pointsGained) {
  query(`
    INSERT INTO commander_respect (player_id, commander_id, respect_points)
    VALUES (?, ?, ?)
    ON CONFLICT(player_id, commander_id) DO UPDATE SET
      respect_points = respect_points + excluded.respect_points
  `, [playerId, commanderId, pointsGained]);

  const row = query(
    "SELECT * FROM commander_respect WHERE player_id = ? AND commander_id = ?",
    [playerId, commanderId]
  ).rows[0];

  const level = Math.min(10, Math.floor(row.respect_points / 1000));

  if (level >= 1 && !row.is_unlocked) {
    query("UPDATE commander_respect SET is_unlocked = 1 WHERE player_id = ? AND commander_id = ?",
      [playerId, commanderId]);
    console.log(`Hero ${commanderId} UNLOCKED for ${playerId}`);
  }

  // Unique Gear unlock at Respect Level 10 — permanent, no drop required
  if (level >= 10 && !row.unique_gear_unlocked) {
    query("UPDATE commander_respect SET unique_gear_unlocked = 1 WHERE player_id = ? AND commander_id = ?",
      [playerId, commanderId]);
    console.log(`Unique Gear for ${commanderId} UNLOCKED for ${playerId}`);
  }
}

// ─────────────────────────────────────────────
// SKILL RESET
// ─────────────────────────────────────────────

export function resetCommanderSkills(playerId, commanderId) {
  const stateRes = query(
    "SELECT last_skill_reset_at FROM commander_state WHERE player_id = ? AND commander_id = ?",
    [playerId, commanderId]
  );
  const now = Math.floor(Date.now() / 1000);
  const last = stateRes.rows[0]?.last_skill_reset_at ?? 0;

  if ((now - last) < 86400) {
    // Within 24h cooldown — charge 50 gems
    const gemRes = query("SELECT gems FROM player_bases WHERE player_id = ?", [playerId]);
    if ((gemRes.rows[0]?.gems ?? 0) < 50) {
      return { success: false, reason: 'cooldown_active_insufficient_gems', gemCost: 50 };
    }
    query("UPDATE player_bases SET gems = gems - 50 WHERE player_id = ?", [playerId]);
    console.log(`Skill reset early (gem bypass) for ${commanderId}.`);
  }

  query(`
    INSERT INTO commander_state (player_id, commander_id, last_skill_reset_at)
    VALUES (?, ?, ?)
    ON CONFLICT(player_id, commander_id) DO UPDATE SET last_skill_reset_at = excluded.last_skill_reset_at
  `, [playerId, commanderId, now]);

  return { success: true };
}

// ─────────────────────────────────────────────
// GACHA / MATHOM SYSTEM
// ─────────────────────────────────────────────

const HIGH_TIER_POOL = ['commander_imrahil', 'commander_gilgalad', 'gear_dwarven_slingshot'];
const NORMAL_POOL    = ['respect_item_common', 'gear_common_sword', 'stamina_potion'];

export function performGachaPull(playerId) {
  query(`INSERT INTO player_gacha (player_id, pity_counter) VALUES (?, 0) ON CONFLICT(player_id) DO NOTHING`, [playerId]);
  const res = query("SELECT pity_counter FROM player_gacha WHERE player_id = ?", [playerId]);
  let pity = (res.rows[0]?.pity_counter ?? 0) + 1;

  let item;
  if (pity >= 50) {
    // Guaranteed high-tier at pity 50
    item = HIGH_TIER_POOL[Math.floor(Math.random() * HIGH_TIER_POOL.length)];
    pity = 0;
    console.log(`PITY TRIGGERED for ${playerId}: ${item}`);
  } else {
    item = Math.random() < 0.05
      ? HIGH_TIER_POOL[Math.floor(Math.random() * HIGH_TIER_POOL.length)]
      : NORMAL_POOL[Math.floor(Math.random() * NORMAL_POOL.length)];
    if (HIGH_TIER_POOL.includes(item)) pity = 0;
  }

  query("UPDATE player_gacha SET pity_counter = ? WHERE player_id = ?", [pity, playerId]);
  return { item, pityCounter: pity };
}

// ─────────────────────────────────────────────
// ALLIANCE CONTRIBUTION
// ─────────────────────────────────────────────

export function grantContribution(playerId, amount) {
  const res = query("SELECT alliance_id FROM alliance_members WHERE player_id = ?", [playerId]);
  if (res.rowCount === 0) return;
  query(
    "UPDATE alliance_members SET contribution = contribution + ? WHERE player_id = ? AND alliance_id = ?",
    [amount, playerId, res.rows[0].alliance_id]
  );
}

// ─────────────────────────────────────────────
// SEASON WIPE
// ─────────────────────────────────────────────

export function wipeSeasonBattleReports(completedSeasonDay) {
  query("DELETE FROM battle_reports WHERE season_day <= ?", [completedSeasonDay]);
  console.log(`Battle reports wiped for season up to day ${completedSeasonDay}.`);
}

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

async function getFullArmy(commanderId) {
  const res = query("SELECT * FROM commander_army WHERE commander_id = ?", [commanderId]);
  const cmd = res.rows[0];
  return {
    commanderId,
    commander: { name: commanderId, might: 100, focus: 50, speed: 50, command: 30 },
    formations: [
      { unitId: cmd.slot_1_unit, count: cmd.slot_1_count },
      { unitId: cmd.slot_2_unit, count: cmd.slot_2_count },
      { unitId: cmd.slot_3_unit, count: cmd.slot_3_count }
    ].filter(f => f.unitId)
  };
}

function applyCasualties(commanderId, losses) {
  const res = query("SELECT * FROM commander_army WHERE commander_id = ?", [commanderId]);
  const row = res.rows[0];
  const slots = [
    { u: row.slot_1_unit, c: row.slot_1_count, key: 'slot_1_count' },
    { u: row.slot_2_unit, c: row.slot_2_count, key: 'slot_2_count' },
    { u: row.slot_3_unit, c: row.slot_3_count, key: 'slot_3_count' }
  ];
  for (const s of slots) {
    if (!s.u) continue;
    query(`UPDATE commander_army SET ${s.key} = ? WHERE commander_id = ?`,
      [Math.max(0, s.c - (losses[s.u] || 0)), commanderId]);
  }
}

function saveBattleReport(attackerId, defenderId, combatResult, seasonDay) {
  query(`
    INSERT INTO battle_reports
      (id, attacker_id, defender_id, winner_id, result, casualties_json, rounds_json, created_at, season_day)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    uuidv4(), attackerId, defenderId,
    combatResult.winner,
    combatResult.result,
    JSON.stringify(combatResult.casualties),
    JSON.stringify(combatResult.log),
    Math.floor(Date.now() / 1000),
    seasonDay
  ]);
}


