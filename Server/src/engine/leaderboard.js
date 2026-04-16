import { query } from "../db.js";

// ─────────────────────────────────────────────
// LEADERBOARDS & PVP SCORING
// ─────────────────────────────────────────────

/**
 * Merit points are awarded for:
 * - Killing enemy troops  (1 pt per 100 troops)
 * - Capturing tiles       (50 pts each)
 * - Capturing structures  (500 pts each, scaled by tier)
 * - Rally victories       (200 pts per participant ally)
 * - Defending your base   (100 pts per successful defense)
 */

// ─────────────────────────────────────────────
// MERIT AWARD
// ─────────────────────────────────────────────

export function awardMerit(playerId, amount, reason) {
  if (amount <= 0) return;
  const now = Math.floor(Date.now() / 1000);

  // Update player total merit
  query(`
    INSERT INTO player_merit (player_id, total_merit, weekly_merit, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      total_merit  = total_merit  + excluded.total_merit,
      weekly_merit = weekly_merit + excluded.weekly_merit,
      updated_at   = excluded.updated_at
  `, [playerId, amount, amount, now]);

  // Also contribute to alliance merit
  const allianceRes = query("SELECT alliance_id FROM alliance_members WHERE player_id = ?", [playerId]);
  if (allianceRes.rowCount > 0) {
    query(
      "UPDATE alliance_members SET merit = merit + ? WHERE player_id = ? AND alliance_id = ?",
      [amount, playerId, allianceRes.rows[0].alliance_id]
    );
  }

  console.log(`[Merit] ${playerId} +${amount} (${reason})`);
}

// ─────────────────────────────────────────────
// LEADERBOARDS
// ─────────────────────────────────────────────

/** Top 100 players by total merit (all-time) */
export function getGlobalLeaderboard(limit = 100) {
  return query(`
    SELECT p.id, p.display_name, m.total_merit, m.weekly_merit,
           pb.level as base_level, pb.faction_id
    FROM player_merit m
    JOIN players p ON p.id = m.player_id
    JOIN player_bases pb ON pb.player_id = m.player_id
    ORDER BY m.total_merit DESC
    LIMIT ?
  `, [limit]).rows;
}

/** Top players by merit this week */
export function getWeeklyLeaderboard(limit = 100) {
  return query(`
    SELECT p.id, p.display_name, m.weekly_merit,
           pb.faction_id
    FROM player_merit m
    JOIN players p ON p.id = m.player_id
    JOIN player_bases pb ON pb.player_id = m.player_id
    ORDER BY m.weekly_merit DESC
    LIMIT ?
  `, [limit]).rows;
}

/** Alliance ranking by total contribution of all members */
export function getAllianceLeaderboard(limit = 50) {
  return query(`
    SELECT a.id, a.name, a.color_hex,
           SUM(am.contribution) as total_contribution,
           COUNT(am.player_id) as member_count
    FROM alliances a
    JOIN alliance_members am ON am.alliance_id = a.id
    GROUP BY a.id
    ORDER BY total_contribution DESC
    LIMIT ?
  `, [limit]).rows;
}

/** Player ranking within their own alliance */
export function getAllianceMemberRanking(allianceId) {
  return query(`
    SELECT p.id, p.display_name, am.contribution, am.merit, am.last_online,
           pb.level as base_level
    FROM alliance_members am
    JOIN players p ON p.id = am.player_id
    JOIN player_bases pb ON pb.player_id = am.player_id
    WHERE am.alliance_id = ?
    ORDER BY am.contribution DESC
  `, [allianceId]).rows;
}

/** Reset weekly merit scores (call at start of each season week) */
export function resetWeeklyMerit() {
  query("UPDATE player_merit SET weekly_merit = 0");
  console.log("[Leaderboard] Weekly merit reset.");
}

// ─────────────────────────────────────────────
// WAR SCORE TRACKING (Alliance Wars)
// ─────────────────────────────────────────────

export function recordWarEvent(attackerId, defenderId, eventType, value) {
  const now = Math.floor(Date.now() / 1000);
  // Merit rewards per event type
  const meritRewards = {
    tile_capture:        100,
    city_capture:        500,
    fortress_capture:    300,
    player_troop_kill:   Math.floor(value / 100), // 1 pt per 100 troops killed
    base_defense:        150,
    rally_victory:       200,
  };

  const merit = meritRewards[eventType] ?? 0;
  if (merit > 0) awardMerit(attackerId, merit, eventType);

  // Log the war event
  query(`
    INSERT INTO war_events (id, attacker_id, defender_id, event_type, value, merit_awarded, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    attackerId, defenderId, eventType, value, merit, now
  ]);
}
