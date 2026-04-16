import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../shard.db");

// Initialize database
const db = new Database(dbPath);

// Create core tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS shards (
    tick INTEGER DEFAULT 0,
    season_day INTEGER DEFAULT 1
  );

  -- ── PLAYER ACCOUNTS ──────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    pw_hash TEXT,
    salt TEXT,
    token TEXT,
    gems INTEGER DEFAULT 200,
    created_at INTEGER,
    last_login_at INTEGER
  );

  -- ── BASE BUILDINGS ───────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS buildings (
    player_id TEXT,
    building_key TEXT,
    level INTEGER DEFAULT 0,
    upgrade_finish_at INTEGER DEFAULT 0,
    PRIMARY KEY(player_id, building_key)
  );

  -- ── TECHNOLOGY RESEARCH ──────────────────────────────────────
  CREATE TABLE IF NOT EXISTS player_techs (
    player_id TEXT,
    tech_key TEXT,
    started_at INTEGER,
    finish_at INTEGER,
    completed_at INTEGER,
    PRIMARY KEY(player_id, tech_key)
  );

  -- ── MERIT / LEADERBOARDS ─────────────────────────────────────
  CREATE TABLE IF NOT EXISTS player_merit (
    player_id TEXT PRIMARY KEY,
    total_merit INTEGER DEFAULT 0,
    weekly_merit INTEGER DEFAULT 0,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS war_events (
    id TEXT PRIMARY KEY,
    attacker_id TEXT,
    defender_id TEXT,
    event_type TEXT,
    value INTEGER DEFAULT 0,
    merit_awarded INTEGER DEFAULT 0,
    created_at INTEGER
  );

  -- ── RESOURCES (granular) ─────────────────────────────────────
  CREATE TABLE IF NOT EXISTS player_resources (
    player_id TEXT PRIMARY KEY,
    wood INTEGER DEFAULT 500,
    ore INTEGER DEFAULT 500,
    grain INTEGER DEFAULT 500,
    stone INTEGER DEFAULT 200,
    last_tick_at INTEGER
  );
  
  CREATE TABLE IF NOT EXISTS tiles (
    x INTEGER,
    y INTEGER,
    terrain TEXT,
    level INTEGER DEFAULT 1,          -- 1-13 scaling
    region_id TEXT,                   -- Territorial group
    structure_id TEXT,                -- Cluster ID (5x5 City, etc)
    is_anchor INTEGER DEFAULT 0,      -- 1 if this is the center/anchor tile of a structure
    siege_hp INTEGER DEFAULT 100,
    max_siege_hp INTEGER DEFAULT 100,
    defenders_json TEXT,              -- NPC Garrison
    owner_id TEXT,                    -- Individual player who captured this tile
    last_siege_damage_at INTEGER,     -- For siege regen cooldown
    spawn_faction TEXT,               -- Faction this tile is reserved as a player spawn zone
    PRIMARY KEY(x, y)
  );

  CREATE TABLE IF NOT EXISTS alliances (
    id TEXT PRIMARY KEY,
    name TEXT,
    color_hex TEXT,
    leader_id TEXT
  );

  CREATE TABLE IF NOT EXISTS structures (
    id TEXT PRIMARY KEY,
    type TEXT,                    -- city, fortress, fort, player_base
    faction_id TEXT,              -- Controlling faction
    owner_id TEXT,                -- If player-owned, the player ID
    level INTEGER DEFAULT 1,
    anchor_x INTEGER,
    anchor_y INTEGER,
    width INTEGER DEFAULT 1,
    height INTEGER DEFAULT 1
  );

  -- Shard capacity metadata
  CREATE TABLE IF NOT EXISTS shard_factions (
    faction_key TEXT PRIMARY KEY,
    name TEXT,
    color_hex TEXT,
    capital_x INTEGER,
    capital_y INTEGER,
    player_count INTEGER DEFAULT 0,
    max_players INTEGER DEFAULT 250
  );

  CREATE TABLE IF NOT EXISTS visibility (
    player_id TEXT,
    tile_x INTEGER,
    tile_y INTEGER,
    status TEXT DEFAULT 'unexplored',
    PRIMARY KEY(player_id, tile_x, tile_y)
  );

  CREATE TABLE IF NOT EXISTS cities (
    id TEXT PRIMARY KEY,
    name TEXT,
    tier INTEGER,
    x INTEGER,
    y INTEGER,
    max_siege_hp INTEGER,
    current_siege_hp INTEGER,
    faction_id TEXT,
    last_captured_at INTEGER,
    first_captured_at INTEGER,        -- First Occupation timestamp
    first_capturer_id TEXT,           -- Who earned the First Occupation gem reward
    garrison_respawn_at INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS player_bases (
    player_id TEXT PRIMARY KEY,
    level INTEGER DEFAULT 1,
    gems INTEGER DEFAULT 100,
    upgrade_ready_at INTEGER DEFAULT 0,
    faction_id TEXT,
    x INTEGER,
    y INTEGER,
    last_collected_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS territories (
    id TEXT PRIMARY KEY,
    name TEXT,
    region_id TEXT,
    capital_city_id TEXT
  );

  CREATE TABLE IF NOT EXISTS unit_inventory (
    player_id TEXT,
    unit_id TEXT,
    count INTEGER DEFAULT 0,
    PRIMARY KEY(player_id, unit_id)
  );

  CREATE TABLE IF NOT EXISTS recruitment_queue (
    id TEXT PRIMARY KEY,
    player_id TEXT,
    unit_id TEXT,
    count INTEGER,
    finish_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS commander_army (
    commander_id TEXT PRIMARY KEY,
    slot_1_unit TEXT,
    slot_1_count INTEGER DEFAULT 0,
    slot_2_unit TEXT,
    slot_2_count INTEGER DEFAULT 0,
    slot_3_unit TEXT,
    slot_3_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS battle_reports (
    id TEXT PRIMARY KEY,
    attacker_id TEXT,
    defender_id TEXT,
    winner_id TEXT,           -- null = DRAW
    result TEXT DEFAULT 'victory', -- 'victory', 'defeat', 'draw'
    casualties_json TEXT,     -- Aggregated losses for both sides
    rounds_json TEXT,         -- Detailed round-by-round log
    created_at INTEGER,
    season_day INTEGER        -- Wiped on new season start
  );

  -- Timed group attacks coordinated by an alliance leader
  CREATE TABLE IF NOT EXISTS rallies (
    id TEXT PRIMARY KEY,
    leader_id TEXT,
    alliance_id TEXT,
    target_x INTEGER,
    target_y INTEGER,
    trigger_at INTEGER,       -- Unix timestamp when all armies auto-send
    status TEXT DEFAULT 'open' -- 'open', 'launched', 'cancelled'
  );

  CREATE TABLE IF NOT EXISTS rally_members (
    rally_id TEXT,
    player_id TEXT,
    commander_id TEXT,
    PRIMARY KEY(rally_id, player_id)
  );

  -- Alliance social layer
  CREATE TABLE IF NOT EXISTS alliance_members (
    alliance_id TEXT,
    player_id TEXT,
    contribution INTEGER DEFAULT 0,
    merit INTEGER DEFAULT 0,
    squad_id TEXT,
    last_online INTEGER,
    PRIMARY KEY(alliance_id, player_id)
  );

  CREATE TABLE IF NOT EXISTS squads (
    id TEXT PRIMARY KEY,
    alliance_id TEXT,
    name TEXT,
    leader_id TEXT
  );

  -- Per-hero respect (permanent, never decreases)
  CREATE TABLE IF NOT EXISTS commander_respect (
    player_id TEXT,
    commander_id TEXT,
    respect_points INTEGER DEFAULT 0,
    is_unlocked INTEGER DEFAULT 0,    -- 1 = hero available to recruit
    unique_gear_unlocked INTEGER DEFAULT 0, -- 1 = locked Respect 10 gear available
    PRIMARY KEY(player_id, commander_id)
  );

  -- Per-commander stamina and skill reset timer
  CREATE TABLE IF NOT EXISTS commander_state (
    player_id TEXT,
    commander_id TEXT,
    stamina INTEGER DEFAULT 150,
    last_stamina_tick INTEGER DEFAULT 0,
    last_skill_reset_at INTEGER DEFAULT 0,
    PRIMARY KEY(player_id, commander_id)
  );

  -- Gacha pity counter per player
  CREATE TABLE IF NOT EXISTS player_gacha (
    player_id TEXT PRIMARY KEY,
    pity_counter INTEGER DEFAULT 0    -- Forced high-tier drop at 50
  );

  -- ── ACTIONS & MARCHES ─────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS action_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    player_id TEXT,
    payload TEXT,
    start_tick INTEGER,
    end_tick INTEGER,
    status TEXT DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS marches (
    id TEXT PRIMARY KEY,
    player_id TEXT,
    commander_id TEXT,
    from_x INTEGER,
    from_y INTEGER,
    to_x INTEGER,
    to_y INTEGER,
    troops INTEGER,
    grain_cost INTEGER,
    status TEXT DEFAULT 'marching', -- 'marching', 'completed', 'recalled', 'failed'
    depart_at INTEGER,
    arrive_at INTEGER,
    result TEXT
  );

  -- ── NOTIFICATIONS ───────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    player_id TEXT,
    type TEXT,
    data_json TEXT,
    read INTEGER DEFAULT 0,
    created_at INTEGER
  );

  -- Per-commander skill points spent
  CREATE TABLE IF NOT EXISTS commander_skills (
    player_id TEXT,
    commander_id TEXT,
    skill_id TEXT,
    level INTEGER DEFAULT 0,
    PRIMARY KEY(player_id, commander_id, skill_id)
  );

  -- Equipment equipped to commanders
  CREATE TABLE IF NOT EXISTS commander_gear (
    player_id TEXT,
    commander_id TEXT,
    slot TEXT, -- 'weapon', 'helmet', 'armor', 'accessory'
    gear_id TEXT,
    PRIMARY KEY(player_id, commander_id, slot)
  );

  -- Player gear inventory (unequipped)
  CREATE TABLE IF NOT EXISTS player_gear_inventory (
    id TEXT PRIMARY KEY,
    player_id TEXT,
    gear_id TEXT,
    refine_level INTEGER DEFAULT 0,
    strengthen_level INTEGER DEFAULT 0
  );
`);

export function query(sql, params = []) {
  if (sql.trim().toUpperCase().startsWith("SELECT")) {
    const stmt = db.prepare(sql);
    return { rows: stmt.all(...params), rowCount: stmt.all(...params).length };
  } else {
    const stmt = db.prepare(sql);
    const info = stmt.run(...params);
    return { rowCount: info.changes };
  }
}

export async function ensureShard() {
  const res = query("SELECT * FROM shards LIMIT 1");
  if (res.rowCount === 0) {
    console.log("No shard found, initializing SQLite state...");
    query("INSERT INTO shards (tick, season_day) VALUES (0, 1)");
  }
  return res.rows[0];
}

export function getShard() {
  const res = query("SELECT * FROM shards LIMIT 1");
  return res.rows[0];
}

export function updateShardTick(tick, seasonDay) {
  query("UPDATE shards SET tick = ?, season_day = ?", [tick, seasonDay]);
}
