import { query } from "../db.js";
import { v4 as uuidv4 } from "uuid";

// ─────────────────────────────────────────────
// IN-GAME NOTIFICATION SYSTEM
// ─────────────────────────────────────────────

export const NOTIF_TYPES = {
  MARCH_ARRIVED:    "march_arrived",
  UNDER_ATTACK:     "under_attack",
  TILE_LOST:        "tile_lost",
  TILE_CAPTURED:    "tile_captured",
  RALLY_OPENING:    "rally_opening",
  RALLY_LAUNCHED:   "rally_launched",
  BUILD_COMPLETE:   "build_complete",
  RESEARCH_DONE:    "research_done",
  ALLY_JOINED:      "ally_joined",
  SEASON_ENDING:    "season_ending",
  FIRST_CAPTURE:    "first_capture",
};

/**
 * Send a notification to a specific player.
 * The WebSocket server reads pending notifications and pushes them via WS.
 */
export function notifyPlayer(playerId, type, data = {}) {
  const id  = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  query(`
    INSERT INTO notifications (id, player_id, type, data_json, read, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `, [id, playerId, type, JSON.stringify(data), now]);

  console.log(`[Notif] → ${playerId}: ${type}`);
  return id;
}

/** Notify all members of an alliance */
export function notifyAlliance(allianceId, type, data = {}) {
  const members = query("SELECT player_id FROM alliance_members WHERE alliance_id = ?", [allianceId]);
  for (const m of members.rows) notifyPlayer(m.player_id, type, data);
}

/** Get unread notifications for a player */
export function getNotifications(playerId, limit = 50) {
  return query(`
    SELECT id, type, data_json, read, created_at
    FROM notifications
    WHERE player_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `, [playerId, limit]).rows.map(n => ({
    ...n,
    data: JSON.parse(n.data_json || "{}"),
  }));
}

/** Mark a notification as read */
export function markRead(playerId, notifId) {
  query("UPDATE notifications SET read = 1 WHERE id = ? AND player_id = ?", [notifId, playerId]);
}

/** Mark all as read */
export function markAllRead(playerId) {
  query("UPDATE notifications SET read = 1 WHERE player_id = ?", [playerId]);
}

/** Get unread count */
export function getUnreadCount(playerId) {
  return query(
    "SELECT COUNT(*) as c FROM notifications WHERE player_id = ? AND read = 0",
    [playerId]
  ).rows[0].c;
}
