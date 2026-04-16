import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { ensureShard, query } from "./db.js";
import { shardEngine } from "./engine/shard-engine.js";
import { MapGenerator } from "./engine/map-generator.js";
import { RecruitmentManager } from "./engine/recruitment-manager.js";
import { FormationManager } from "./engine/formation-manager.js";
import { registerPlayer, loginPlayer, requireAuth, getProfile } from "./auth.js";
import { BUILDINGS, getBuildingUpgradeCost, startBuildingUpgrade, collectBuildingUpgrades, getBuildings } from "./engine/buildings.js";
import { TECH_TREE, getPlayerTechs, getTechEffects, startResearch, collectResearch } from "./engine/tech-tree.js";
import { getGlobalLeaderboard, getWeeklyLeaderboard, getAllianceLeaderboard, getAllianceMemberRanking, awardMerit } from "./engine/leaderboard.js";
import { tickStamina, tickSiegeRegen, tickRallies, createRally, performGachaPull, applyRespectItem, resetCommanderSkills, wipeSeasonBattleReports, grantContribution } from "./actions/handlers.js";
import { getPlayerProductionSummary } from "./engine/economy.js";
import { getResources, spendResources, earnResources, processResourceTicks } from "./engine/resources.js";
import { queueMarch, getActiveMarches, getAllMarches, tickMarches } from "./engine/march-engine.js";
import { getNotifications, getUnreadCount, markRead, markAllRead } from "./engine/notifications.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.join(__dirname, "../data");

const app        = express();
const httpServer = createServer(app);
const wss        = new WebSocketServer({ server: httpServer });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Player→WebSocket session map for targeted broadcasts
const playerSockets = new Map(); // playerId → ws

// ═══════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════

app.get("/api", (req, res) => {
  res.json({
    server: "Historical Fantasy Grand Strategy — Shard Engine v1.0",
    status: "online",
    endpoints: [
      "GET  /api/factions",
      "POST /api/auth/register",
      "POST /api/auth/login",
      "GET  /api/profile",
      "GET  /api/map",
      "GET  /api/marches/active",
      "POST /api/marches/queue",
      "GET  /api/resources",
      "GET  /api/commanders",
      "GET  /api/notifications",
      "GET  /api/leaderboard/global",
    ]
  });
});

// ═══════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════

app.post("/api/auth/register", (req, res) => {
  try {
    const { username, password, displayName, factionKey } = req.body;
    const result = registerPlayer(username, password, displayName, factionKey);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Faction list + capacity
app.get("/api/factions", (req, res) => {
  const factions = [
    { key: "rome",     name: "Rome",     color: "#b00000", description: "Legions of the Republic. Unmatched discipline and heavy infantry." },
    { key: "egypt",    name: "Egypt",    color: "#ffcc00", description: "Empire of the Nile. Masters of logistics and wealth." },
    { key: "carthage", name: "Carthage", color: "#3366cc", description: "Naval superpower. Famous for exotic units and mercenaries." },
    { key: "gaul",     name: "Gaul",     color: "#006600", description: "Fierce tribal confederation. High mobility and ambush tactics." },
    { key: "greece",   name: "Greece",   color: "#00ccff", description: "Hellenic phalanxes. Superior defense and naval prowess." },
    { key: "persia",   name: "Persia",   color: "#9900cc", description: "The Achaemenid Empire. Diverse armies and elite Immortals." },
  ];

  // Merge live capacity from DB if shard_factions table is populated
  const capacityRes = query("SELECT faction_key, player_count, max_players FROM shard_factions");
  const capacityMap = {};
  for (const r of capacityRes.rows) capacityMap[r.faction_key] = r;

  res.json(factions.map(f => ({
    ...f,
    playerCount: capacityMap[f.key]?.player_count ?? 0,
    maxPlayers:  capacityMap[f.key]?.max_players  ?? 250,
    isFull:      (capacityMap[f.key]?.player_count ?? 0) >= 250,
  })));
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { username, password } = req.body;
    const result = loginPlayer(username, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.get("/api/profile", requireAuth, (req, res) => {
  res.json(getProfile(req.player.id));
});

// ═══════════════════════════════════════════════════════════════
// MAP & MARCHES
// ═══════════════════════════════════════════════════════════════

app.get("/api/map", requireAuth, (req, res) => {
  const tiles = query("SELECT x, y, terrain, level, owner_id, structure_id, siege_hp, max_siege_hp FROM tiles");
  const marches = getAllMarches();
  res.json({ tiles: tiles.rows, marches });
});

app.get("/api/marches/active", requireAuth, (req, res) => {
  res.json(getActiveMarches(req.player.id));
});

app.post("/api/marches/queue", requireAuth, (req, res) => {
  try {
    const result = queueMarch(req.player.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/admin/generate-map", (req, res) => {
  const gen = new MapGenerator();
  gen.generateWorld();
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════
// UNITS & INVENTORY
// ═══════════════════════════════════════════════════════════════

app.get("/api/units", (req, res) => {
  const units = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "unit-data.json"), "utf8")).units;
  res.json(units);
});

app.post("/api/recruit", requireAuth, async (req, res) => {
  try {
    const { unitId, count } = req.body;
    const result = await RecruitmentManager.startRecruitment(req.player.id, unitId, count);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/inventory", requireAuth, (req, res) => {
  const inv = query("SELECT * FROM unit_inventory WHERE player_id = ?", [req.player.id]);
  res.json(inv.rows);
});

// ═══════════════════════════════════════════════════════════════
// FORMATION
// ═══════════════════════════════════════════════════════════════

app.post("/api/formation/update", requireAuth, async (req, res) => {
  try {
    const { commanderId, slots } = req.body;
    const result = await FormationManager.updateFormation(commanderId, req.player.id, slots);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// BATTLE REPORTS
// ═══════════════════════════════════════════════════════════════

app.get("/api/battle-history", requireAuth, (req, res) => {
  const results = query(
    "SELECT id, attacker_id, defender_id, winner_id, result, created_at FROM battle_reports WHERE attacker_id = ? OR defender_id = ? ORDER BY created_at DESC LIMIT 50",
    [req.player.id, req.player.id]
  );
  res.json(results.rows);
});

app.get("/api/battle-report/:id", requireAuth, (req, res) => {
  const result = query("SELECT * FROM battle_reports WHERE id = ?", [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: "Report not found." });
  res.json(result.rows[0]);
});

// ═══════════════════════════════════════════════════════════════
// BASE BUILDINGS
// ═══════════════════════════════════════════════════════════════

app.get("/api/buildings", requireAuth, (req, res) => {
  collectBuildingUpgrades(req.player.id);
  res.json(getBuildings(req.player.id));
});

app.get("/api/buildings/catalog", (req, res) => {
  const catalog = Object.entries(BUILDINGS).map(([key, def]) => ({
    key,
    name:        def.name,
    description: def.description,
    maxLevel:    def.maxLevel,
    unlocks:     def.unlocks ?? {},
  }));
  res.json(catalog);
});

app.post("/api/buildings/upgrade", requireAuth, (req, res) => {
  try {
    const { buildingKey } = req.body;
    const result = startBuildingUpgrade(req.player.id, buildingKey);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/buildings/upgrade-cost", requireAuth, (req, res) => {
  try {
    const { buildingKey } = req.query;
    const bRes = query(
      "SELECT level FROM buildings WHERE player_id = ? AND building_key = ?",
      [req.player.id, buildingKey]
    );
    const cost = getBuildingUpgradeCost(buildingKey, bRes.rows[0]?.level ?? 0);
    res.json(cost);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// TECHNOLOGY TREE
// ═══════════════════════════════════════════════════════════════

app.get("/api/tech/tree", (req, res) => {
  res.json(TECH_TREE);
});

app.get("/api/tech/player", requireAuth, (req, res) => {
  collectResearch(req.player.id);
  const techs   = getPlayerTechs(req.player.id);
  const effects = getTechEffects(req.player.id);
  res.json({ researched: techs, effects });
});

app.post("/api/tech/research", requireAuth, (req, res) => {
  try {
    const { techKey } = req.body;
    const result = startResearch(req.player.id, techKey);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// COMMANDERS
// ═══════════════════════════════════════════════════════════════

app.get("/api/commanders", (req, res) => {
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "commander-data.json"), "utf8"));
  res.json(data.commanders);
});

app.get("/api/commanders/player", requireAuth, (req, res) => {
  const respect = query(
    "SELECT * FROM commander_respect WHERE player_id = ?",
    [req.player.id]
  );
  res.json(respect.rows);
});

app.post("/api/commanders/respect", requireAuth, (req, res) => {
  try {
    const { commanderId, points } = req.body;
    applyRespectItem(req.player.id, commanderId, points);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/commanders/skills/reset", requireAuth, (req, res) => {
  try {
    const { commanderId } = req.body;
    const result = resetCommanderSkills(req.player.id, commanderId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/commanders/skills/upgrade", requireAuth, (req, res) => {
  try {
    const { commanderId, skillId } = req.body;
    // 1. Get Respect Level (determines total available points)
    const respectRes = query("SELECT respect_points FROM commander_respect WHERE player_id = ? AND commander_id = ?", [req.player.id, commanderId]);
    const respectLvl = Math.floor((respectRes.rows[0]?.respect_points ?? 0) / 1000);
    const totalPoints = respectLvl * 2; // 2 points per respect level

    // 2. Get Spent Points
    const spentRes = query("SELECT SUM(level) as spent FROM commander_skills WHERE player_id = ? AND commander_id = ?", [req.player.id, commanderId]);
    const spent = spentRes.rows[0]?.spent ?? 0;

    if (spent >= totalPoints) throw new Error("No available skill points.");

    // 3. Perform Upgrade
    query(`
      INSERT INTO commander_skills (player_id, commander_id, skill_id, level)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(player_id, commander_id, skill_id) DO UPDATE SET level = level + 1
    `, [req.player.id, commanderId, skillId]);

    res.json({ success: true, spent: spent + 1, totalPoints });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/commanders/:id/details", requireAuth, (req, res) => {
  const commanderId = req.params.id;
  const respect = query("SELECT * FROM commander_respect WHERE player_id = ? AND commander_id = ?", [req.player.id, commanderId]);
  const skills = query("SELECT * FROM commander_skills WHERE player_id = ? AND commander_id = ?", [req.player.id, commanderId]);
  const army = query("SELECT * FROM commander_army WHERE commander_id = ?", [commanderId]);
  const gear = query("SELECT * FROM commander_gear WHERE player_id = ? AND commander_id = ?", [req.player.id, commanderId]);
  
  res.json({
    respect: respect.rows[0],
    skills: skills.rows,
    army: army.rows[0],
    gear: gear.rows
  });
});

// ── GEAR MANAGEMENT ──

app.get("/api/gear/inventory", requireAuth, (req, res) => {
  const inv = query("SELECT * FROM player_gear_inventory WHERE player_id = ?", [req.player.id]);
  res.json(inv.rows);
});

app.post("/api/gear/equip", requireAuth, (req, res) => {
  try {
    const { commanderId, gearInstanceId, slot } = req.body;
    // 1. Check ownership & existence
    const gearRes = query("SELECT * FROM player_gear_inventory WHERE id = ? AND player_id = ?", [gearInstanceId, req.player.id]);
    if (gearRes.rowCount === 0) throw new Error("Gear not found in inventory.");
    const gear = gearRes.rows[0];

    // 2. Atomic Equip: Upsert into commander_gear, remove from inventory
    query(`INSERT INTO commander_gear (player_id, commander_id, slot, gear_id) VALUES (?, ?, ?, ?)
           ON CONFLICT(player_id, commander_id, slot) DO UPDATE SET gear_id = excluded.gear_id`,
      [req.player.id, commanderId, slot, gear.gear_id]);
      
    query("DELETE FROM player_gear_inventory WHERE id = ?", [gearInstanceId]);

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/gear/unequip", requireAuth, (req, res) => {
  try {
    const { commanderId, slot } = req.body;
    const gearRes = query("SELECT * FROM commander_gear WHERE player_id = ? AND commander_id = ? AND slot = ?", [req.player.id, commanderId, slot]);
    if (gearRes.rowCount === 0) throw new Error("No gear in this slot.");
    const gear = gearRes.rows[0];

    // Remove from commander, add back to player inventory (as a new instance)
    const newId = `gear_${Date.now()}`;
    query("INSERT INTO player_gear_inventory (id, player_id, gear_id) VALUES (?, ?, ?)", [newId, req.player.id, gear.gear_id]);
    query("DELETE FROM commander_gear WHERE player_id = ? AND commander_id = ? AND slot = ?", [req.player.id, commanderId, slot]);

    res.json({ success: true, inventoryId: newId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GACHA / MATHOM
// ═══════════════════════════════════════════════════════════════

app.post("/api/gacha/pull", requireAuth, (req, res) => {
  try {
    const result = performGachaPull(req.player.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/gacha/pity", requireAuth, (req, res) => {
  const res2 = query("SELECT pity_counter FROM player_gacha WHERE player_id = ?", [req.player.id]);
  res.json({ pityCounter: res2.rows[0]?.pity_counter ?? 0, pityAt: 50 });
});

// ═══════════════════════════════════════════════════════════════
// RESOURCES & ECONOMY
// ═══════════════════════════════════════════════════════════════

app.get("/api/resources", requireAuth, (req, res) => {
  const balance = getResources(req.player.id);
  const production = getPlayerProductionSummary(req.player.id);
  res.json({ balance, production });
});
// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

app.get("/api/notifications", requireAuth, (req, res) => {
  res.json(getNotifications(req.player.id));
});

app.get("/api/notifications/unread", requireAuth, (req, res) => {
  res.json({ unreadCount: getUnreadCount(req.player.id) });
});

app.post("/api/notifications/read", requireAuth, (req, res) => {
  const { id, all } = req.body;
  if (all) markAllRead(req.player.id);
  else if (id) markRead(req.player.id, id);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// RALLY SYSTEM
// ═══════════════════════════════════════════════════════════════

app.post("/api/rally/create", requireAuth, (req, res) => {
  try {
    const { targetX, targetY, triggerIn } = req.body; // triggerIn = seconds from now
    const allianceRes = query("SELECT alliance_id FROM alliance_members WHERE player_id = ?", [req.player.id]);
    const allianceId  = allianceRes.rows[0]?.alliance_id ?? null;
    const triggerAt   = Math.floor(Date.now() / 1000) + (triggerIn ?? 300);
    const rallyId = createRally(req.player.id, allianceId, targetX, targetY, triggerAt);
    res.json({ rallyId, triggerAt });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/rally/join", requireAuth, (req, res) => {
  try {
    const { rallyId, commanderId } = req.body;
    const rally = query("SELECT * FROM rallies WHERE id = ? AND status = 'open'", [rallyId]);
    if (rally.rowCount === 0) throw new Error("Rally not found or already launched.");
    query("INSERT OR IGNORE INTO rally_members (rally_id, player_id, commander_id) VALUES (?, ?, ?)",
      [rallyId, req.player.id, commanderId]);
    res.json({ joined: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/rally/active", requireAuth, (req, res) => {
  const allianceRes = query("SELECT alliance_id FROM alliance_members WHERE player_id = ?", [req.player.id]);
  const allianceId  = allianceRes.rows[0]?.alliance_id ?? null;
  if (!allianceId) return res.json([]);
  const rallies = query(
    "SELECT r.*, (SELECT COUNT(*) FROM rally_members rm WHERE rm.rally_id = r.id) as member_count FROM rallies r WHERE r.alliance_id = ? AND r.status = 'open'",
    [allianceId]
  );
  res.json(rallies.rows);
});

// ═══════════════════════════════════════════════════════════════
// ALLIANCES
// ═══════════════════════════════════════════════════════════════

app.post("/api/alliance/create", requireAuth, (req, res) => {
  try {
    const { name, colorHex } = req.body;
    if (!name || name.length < 2) throw new Error("Alliance name too short.");

    // Check player isn't already in one
    const existing = query("SELECT * FROM alliance_members WHERE player_id = ?", [req.player.id]);
    if (existing.rowCount > 0) throw new Error("Already in an alliance. Leave first.");

    const id = require("uuid").v4();
    query("INSERT INTO alliances (id, name, color_hex, leader_id) VALUES (?, ?, ?, ?)",
      [id, name, colorHex ?? "#888888", req.player.id]);
    query("INSERT INTO alliance_members (alliance_id, player_id, contribution, merit, last_online) VALUES (?, ?, 0, 0, ?)",
      [id, req.player.id, Math.floor(Date.now() / 1000)]);
    res.json({ allianceId: id, name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/alliance/my", requireAuth, (req, res) => {
  const memberRes = query("SELECT alliance_id FROM alliance_members WHERE player_id = ?", [req.player.id]);
  if (memberRes.rowCount === 0) return res.json(null);
  const allianceId = memberRes.rows[0].alliance_id;
  const alliance   = query("SELECT * FROM alliances WHERE id = ?", [allianceId]);
  const members    = getAllianceMemberRanking(allianceId);
  res.json({ ...alliance.rows[0], members });
});

app.get("/api/alliance/:id/members", (req, res) => {
  res.json(getAllianceMemberRanking(req.params.id));
});

// ═══════════════════════════════════════════════════════════════
// LEADERBOARDS
// ═══════════════════════════════════════════════════════════════

app.get("/api/leaderboard/global",   (req, res) => res.json(getGlobalLeaderboard()));
app.get("/api/leaderboard/weekly",   (req, res) => res.json(getWeeklyLeaderboard()));
app.get("/api/leaderboard/alliance", (req, res) => res.json(getAllianceLeaderboard()));

// ═══════════════════════════════════════════════════════════════
// GEAR
// ═══════════════════════════════════════════════════════════════

app.get("/api/gear", (req, res) => {
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "gear-data.json"), "utf8"));
  res.json(data);
});

// ═══════════════════════════════════════════════════════════════
// WEBSOCKET — Real-time sync
// ═══════════════════════════════════════════════════════════════

wss.on("connection", (ws, req) => {
  console.log("Client connected to shard WS.");

  // Send initial shard sync
  if (shardEngine.currentShard) {
    ws.send(JSON.stringify({ type: "SYNC", data: shardEngine.currentShard }));
  }

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw);
      // Client identifies itself for targeted broadcasts
      if (msg.type === "IDENTIFY" && msg.token) {
        const res = query("SELECT id FROM players WHERE token = ?", [msg.token]);
        if (res.rowCount > 0) {
          const playerId = res.rows[0].id;
          playerSockets.set(playerId, ws);
          ws.send(JSON.stringify({ type: "IDENTIFIED", playerId }));
        }
      }
    } catch {}
  });

  ws.on("close", () => {
    // Clean up player socket mapping
    for (const [id, sock] of playerSockets) {
      if (sock === ws) { playerSockets.delete(id); break; }
    }
  });
});

// Broadcast tick updates to all connected clients
shardEngine.onTick = (shard) => {
  const payload = JSON.stringify({ type: "TICK", data: shard });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
};

// ═══════════════════════════════════════════════════════════════
// GLOBAL CRON TICKS
// ═══════════════════════════════════════════════════════════════

// Stamina: +1 every 10 minutes
setInterval(() => tickStamina(),    10 * 60 * 1000);

// Siege regen: 5%/hr on uncaptured tiles
setInterval(() => tickSiegeRegen(), 60 * 60 * 1000);

// Rally tick: check every 30 seconds for due rallies
setInterval(() => tickRallies(),    30 * 1000);

// Resource income tick: every 5 minutes
setInterval(() => processResourceTicks(), 5 * 60 * 1000);

// March arrival tick: every 5 seconds
setInterval(() => tickMarches(), 5 * 1000);

// ═══════════════════════════════════════════════════════════════
// SERVER START
// ═══════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3847;

async function start() {
  await ensureShard();
  await shardEngine.init();
  shardEngine.start();
  httpServer.listen(PORT, () => {
    console.log(`\n⚔️  Imperium — Historical Fantasy Grand Strategy`);
    console.log(`   Shard Server running on port ${PORT}`);
    console.log(`   API:       http://localhost:${PORT}/api`);
    console.log(`   WebSocket: ws://localhost:${PORT}\n`);
  });
}

start().catch(console.error);

