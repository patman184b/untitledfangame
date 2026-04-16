import { nanoid } from "nanoid";
import { getDb, setDb } from "./db.js";
import { FACTIONS, buildFreshWorld } from "./seed.js";

function tileIndex(db, x, y) {
  const w = db.width;
  return y * w + x;
}

function deriveWidthHeight(db) {
  let maxX = 0;
  let maxY = 0;
  for (const t of db.tiles) {
    maxX = Math.max(maxX, t.x);
    maxY = Math.max(maxY, t.y);
  }
  return { width: maxX + 1, height: maxY + 1 };
}

/** Ensure db has width/height cached */
export function ensureDimensions(db) {
  if (db.width == null || db.height == null) {
    const { width, height } = deriveWidthHeight(db);
    db.width = width;
    db.height = height;
  }
  return db;
}

export function getTile(db, x, y) {
  ensureDimensions(db);
  if (x < 0 || y < 0 || x >= db.width || y >= db.height) return null;
  return db.tiles[tileIndex(db, x, y)];
}

export function getArmiesAt(db, x, y) {
  return db.armies.filter((a) => a.x === x && a.y === y);
}

export function getPlayer(db, id) {
  return db.players.find((p) => p.id === id) || null;
}

export function publicState(db) {
  ensureDimensions(db);
  return {
    meta: { ...db.meta },
    width: db.width,
    height: db.height,
    tiles: db.tiles.map((t) => ({
      x: t.x,
      y: t.y,
      terrain: t.terrain,
      ownerId: t.ownerId,
      capitalName: t.capitalName,
    })),
    players: db.players.map((p) => ({
      id: p.id,
      name: p.name,
      factionKey: p.factionKey,
      factionLabel: p.factionLabel,
      wood: p.wood,
      ore: p.ore,
      grain: p.grain,
    })),
    armies: db.armies.map((a) => ({ id: a.id, playerId: a.playerId, x: a.x, y: a.y, power: a.power })),
    actions: db.actions
      .filter((a) => a.status === "pending")
      .map((a) => ({ id: a.id, type: a.type, playerId: a.playerId, endTick: a.endTick })),
  };
}

function nextFactionIndex(db) {
  const used = new Set(db.players.map((p) => p.factionKey));
  for (let i = 0; i < FACTIONS.length; i++) {
    if (!used.has(FACTIONS[i].key)) return i;
  }
  return db.players.length % FACTIONS.length;
}

function capitalTiles(db) {
  return db.tiles.filter((t) => t.capitalName);
}

export function joinPlayer(displayName) {
  const db = ensureDimensions(getDb());
  if (!db) throw new Error("No database");
  const capitals = capitalTiles(db);
  if (db.players.length >= capitals.length) {
    throw new Error("Shard full (all capitals taken)");
  }
  const fi = nextFactionIndex(db);
  const faction = FACTIONS[fi];
  const cap = capitals.find((t) => !db.players.some((p) => p.spawnX === t.x && p.spawnY === t.y));
  const spawn = cap || capitals[db.players.length % capitals.length];

  const player = {
    id: nanoid(10),
    name: String(displayName || "Player").slice(0, 32),
    factionKey: faction.key,
    factionLabel: faction.name,
    wood: 200,
    ore: 200,
    grain: 200,
    spawnX: spawn.x,
    spawnY: spawn.y,
  };
  db.players.push(player);
  spawn.ownerId = player.id;
  const army = {
    id: nanoid(10),
    playerId: player.id,
    x: spawn.x,
    y: spawn.y,
    power: 120,
  };
  db.armies.push(army);
  setDb(db);
  return { player, army };
}

export function recruit(playerId) {
  const db = ensureDimensions(getDb());
  const p = getPlayer(db, playerId);
  if (!p) throw new Error("Unknown player");
  const army = db.armies.find((a) => a.playerId === p.id && a.x === p.spawnX && a.y === p.spawnY);
  const a = army || db.armies.find((ar) => ar.playerId === p.id);
  if (!a) throw new Error("No army");
  const tile = getTile(db, a.x, a.y);
  if (!tile?.capitalName || tile.ownerId !== p.id) throw new Error("Stand on your capital");

  const cost = { wood: 40, ore: 40, grain: 40 };
  if (p.wood < cost.wood || p.ore < cost.ore || p.grain < cost.grain) throw new Error("Not enough resources");
  p.wood -= cost.wood;
  p.ore -= cost.ore;
  p.grain -= cost.grain;
  a.power += 30;
  setDb(db);
  return a;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function queueMarch(playerId, toX, toY) {
  const db = ensureDimensions(getDb());
  const p = getPlayer(db, playerId);
  if (!p) throw new Error("Unknown player");
  const army = db.armies.find((a) => a.playerId === playerId);
  if (!army) throw new Error("No army");

  const pending = db.actions.some((a) => a.playerId === playerId && a.status === "pending");
  if (pending) throw new Error("Already marching");

  const tx = Number(toX);
  const ty = Number(toY);
  if (!Number.isInteger(tx) || !Number.isInteger(ty)) throw new Error("Bad coordinates");
  if (manhattan({ x: army.x, y: army.y }, { x: tx, y: ty }) !== 1) throw new Error("Can only march to adjacent tile");

  const dest = getTile(db, tx, ty);
  if (!dest) throw new Error("Out of bounds");
  if (dest.terrain === "Ww") throw new Error("Cannot march into deep water");

  const action = {
    id: nanoid(10),
    type: "march",
    playerId,
    armyId: army.id,
    fromX: army.x,
    fromY: army.y,
    toX: tx,
    toY: ty,
    endTick: db.meta.tick + 1,
    status: "pending",
  };
  db.actions.push(action);
  setDb(db);
  return action;
}

function combat(db, attacker, defender) {
  const ra = 0.85 + Math.random() * 0.3;
  const rd = 0.85 + Math.random() * 0.3;
  const aPow = Math.floor(attacker.power * ra);
  const dPow = Math.floor(defender.power * rd);
  defender.power -= aPow;
  attacker.power -= Math.floor(dPow * 0.6);
  if (defender.power <= 0) {
    db.armies = db.armies.filter((x) => x.id !== defender.id);
  }
  if (attacker.power <= 0) {
    db.armies = db.armies.filter((x) => x.id !== attacker.id);
  }
}

function applyMarchComplete(db, action) {
  const army = db.armies.find((a) => a.id === action.armyId);
  if (!army) {
    action.status = "cancelled";
    return;
  }
  const { toX, toY } = action;
  const enemies = getArmiesAt(db, toX, toY).filter((a) => a.playerId !== action.playerId);
  army.x = toX;
  army.y = toY;
  const tile = getTile(db, toX, toY);

  if (enemies.length > 0) {
    for (const enemy of enemies) {
      if (db.armies.some((a) => a.id === army.id)) combat(db, army, enemy);
    }
  }

  if (tile && db.armies.some((a) => a.id === army.id)) {
    tile.ownerId = action.playerId;
  }

  const same = getArmiesAt(db, toX, toY).filter((a) => a.playerId === action.playerId);
  if (same.length > 1) {
    const [keep, ...rest] = same;
    for (const r of rest) {
      keep.power += r.power;
      db.armies = db.armies.filter((a) => a.id !== r.id);
    }
  }

  action.status = "done";
}

function incomeTick(db) {
  for (const p of db.players) {
    const owned = db.tiles.filter((t) => t.ownerId === p.id).length;
    p.wood += 2 + Math.floor(owned / 20);
    p.ore += 2 + Math.floor(owned / 25);
    p.grain += 2 + Math.floor(owned / 22);
  }
}

export function runTick() {
  const db = ensureDimensions(getDb());
  if (!db) return null;

  db.meta.tick += 1;

  const ticksPerSeasonDay = 12;
  if (db.meta.tick % ticksPerSeasonDay === 0) {
    db.meta.seasonDay = Math.min(db.meta.seasonLengthDays, db.meta.seasonDay + 1);
  }

  const due = db.actions.filter((a) => a.status === "pending" && a.endTick <= db.meta.tick);
  for (const a of due) {
    if (a.type === "march") applyMarchComplete(db, a);
  }

  incomeTick(db);
  setDb(db);
  return db.meta.tick;
}

export function resetWorld() {
  const world = buildFreshWorld();
  ensureDimensions(world);
  setDb(world);
  return world;
}
