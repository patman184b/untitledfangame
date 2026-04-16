import { query } from "./db.js";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

// ─────────────────────────────────────────────
// Simple SHA-256 password hashing (no external deps needed)
// ─────────────────────────────────────────────

function hashPassword(password, salt) {
  return crypto.createHmac("sha256", salt).update(password).digest("hex");
}

function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// ─────────────────────────────────────────────
// REGISTRATION
// ─────────────────────────────────────────────

export function registerPlayer(username, password, displayName, factionKey) {
  if (!username || username.length < 3) throw new Error("Username must be at least 3 characters.");
  if (!password || password.length < 6) throw new Error("Password must be at least 6 characters.");

  // Validate faction
  const validFactions = ["rome","egypt","carthage","gaul","greece","persia"];
  if (!factionKey || !validFactions.includes(factionKey)) throw new Error(`Invalid faction. Choose: ${validFactions.join(", ")}`);

  // Check faction capacity
  const capacityRes = query(
    "SELECT player_count, max_players FROM shard_factions WHERE faction_key = ?",
    [factionKey]
  );
  if (capacityRes.rowCount > 0) {
    const { player_count, max_players } = capacityRes.rows[0];
    if (player_count >= max_players) throw new Error(`${factionKey} is full (${max_players} players). Choose another faction.`);
  }

  // Check username uniqueness
  const existing = query("SELECT id FROM players WHERE username = ?", [username.toLowerCase()]);
  if (existing.rowCount > 0) throw new Error("Username already taken.");

  const salt     = generateSalt();
  const pwHash   = hashPassword(password, salt);
  const playerId = uuidv4();
  const token    = generateToken();
  const now      = Math.floor(Date.now() / 1000);

  // Insert player account
  query(`
    INSERT INTO players (id, username, display_name, pw_hash, salt, token, gems, created_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, 200, ?, ?)
  `, [playerId, username.toLowerCase(), displayName || username, pwHash, salt, token, now, now]);

  // Assign spawn tile
  const spawn = assignPlayerSpawn(playerId, factionKey, now);

  // Seed starter base record
  query(`
    INSERT INTO player_bases (player_id, level, gems, faction_id, x, y, last_collected_at)
    VALUES (?, 1, 200, ?, ?, ?, ?)
  `, [playerId, factionKey, spawn?.x ?? 0, spawn?.y ?? 0, now]);

  // Update faction capacity counter
  query(`
    INSERT INTO shard_factions (faction_key, player_count) VALUES (?, 1)
    ON CONFLICT(faction_key) DO UPDATE SET player_count = player_count + 1
  `, [factionKey]);

  // Seed gacha pity tracker
  query("INSERT OR IGNORE INTO player_gacha (player_id, pity_counter) VALUES (?, 0)", [playerId]);

  // Initialize empty merit row
  query("INSERT OR IGNORE INTO player_merit (player_id, total_merit, weekly_merit) VALUES (?, 0, 0)", [playerId]);

  // Initialize resource wallet
  query(`
    INSERT OR IGNORE INTO player_resources (player_id, wood, ore, grain, stone, last_tick_at)
    VALUES (?, 1000, 1000, 1000, 500, ?)
  `, [playerId, now]);

  console.log(`[Auth] Player registered: ${username} (${playerId}) → ${factionKey} spawn (${spawn?.x},${spawn?.y})`);
  return { player: { id: playerId }, token, displayName: displayName || username, factionKey, spawn };
}

/**
 * Assign the next available spawn-zone tile to a new player.
 * Picks the closest unoccupied spawn_faction tile nearest to the faction capital.
 */
function assignPlayerSpawn(playerId, factionKey, now) {
  // Find an unclaimed spawn zone tile for this faction
  const spawnRes = query(`
    SELECT x, y FROM tiles
    WHERE spawn_faction = ? AND owner_id IS NULL
    ORDER BY ROWID ASC
    LIMIT 1
  `, [factionKey]);

  if (spawnRes.rowCount === 0) {
    console.warn(`[Spawn] No spawn zones available for ${factionKey}. Shard may be full.`);
    return null;
  }

  const { x, y } = spawnRes.rows[0];

  // Claim the tile as this player's base
  query("UPDATE tiles SET owner_id = ?, spawn_faction = NULL WHERE x = ? AND y = ?", [playerId, x, y]);

  // Register a player_base structure on the anchor tile
  const structId = `base_${playerId}`;
  query(`
    INSERT OR IGNORE INTO structures (id, type, faction_id, owner_id, level, anchor_x, anchor_y, width, height)
    VALUES (?, 'player_base', ?, ?, 1, ?, ?, 1, 1)
  `, [structId, factionKey, playerId, x, y]);

  return { x, y, structId };
}


// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────

export function loginPlayer(username, password) {
  const res = query("SELECT * FROM players WHERE username = ?", [username.toLowerCase()]);
  if (res.rowCount === 0) throw new Error("Invalid username or password.");

  const player = res.rows[0];
  const attempt = hashPassword(password, player.salt);
  if (attempt !== player.pw_hash) throw new Error("Invalid username or password.");

  const token = generateToken();
  const now   = Math.floor(Date.now() / 1000);
  query("UPDATE players SET token = ?, last_login_at = ? WHERE id = ?", [token, now, player.id]);

  return {
    playerId:    player.id,
    token,
    displayName: player.display_name,
    gems:        player.gems,
  };
}

// ─────────────────────────────────────────────
// TOKEN VALIDATION MIDDLEWARE
// ─────────────────────────────────────────────

export function requireAuth(req, res, next) {
  const token = req.headers["x-player-token"] || req.query.token;
  if (!token) return res.status(401).json({ error: "Authentication required." });

  const res2 = query("SELECT id, display_name, gems FROM players WHERE token = ?", [token]);
  if (res2.rowCount === 0) return res.status(401).json({ error: "Invalid or expired token." });

  req.player = res2.rows[0]; // { id, display_name, gems }
  next();
}

// ─────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────

export function getProfile(playerId) {
  const p = query("SELECT id, username, display_name, gems, created_at, last_login_at FROM players WHERE id = ?", [playerId]);
  const b = query("SELECT level, faction_id, x, y FROM player_bases WHERE player_id = ?", [playerId]);
  return { ...p.rows[0], base: b.rows[0] };
}
