import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DATA_DIR, DB_PATH, ensureDataDir, writeDb } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const FACTIONS = [
  { key: "auric_legion", name: "Auric Legion" },
  { key: "byzantine_luminants", name: "Byzantine Luminants" },
  { key: "steppe_stormhorde", name: "Steppe Stormhorde" },
  { key: "nocturne_carth", name: "Nocturne Carth" },
  { key: "iron_dominion", name: "Iron Dominion" },
  { key: "verdant_covenant", name: "Verdant Covenant" },
];

function loadJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Build initial world from generated map_data + capitals, or a tiny fallback grid.
 */
export function buildFreshWorld() {
  const mapData = loadJson("world-data/generated/map_data.json");
  const capitalsData = loadJson("world-data/generated/capitals.json");

  let width = 24;
  let height = 16;
  let rows = null;

  if (mapData?.rows?.length) {
    height = mapData.rows.length;
    width = mapData.rows[0].length;
    rows = mapData.rows;
  } else {
    rows = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => (x + y) % 3 === 0 ? "Hh" : "Gg")
    );
  }

  /** @type {import("./db.js").Tile[]} */
  const tiles = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const terrain = rows[y][x] || "Gg";
      tiles.push({ x, y, terrain, ownerId: null, capitalName: null });
    }
  }

  const capitals = capitalsData?.capitals || [
    { name: "CapitalA", x: 4, y: 4 },
    { name: "CapitalB", x: width - 5, y: 4 },
    { name: "CapitalC", x: Math.floor(width / 2), y: height - 5 },
  ];

  for (const c of capitals) {
    const x = clamp((c.x || 1) - 1, 0, width - 1);
    const y = clamp((c.y || 1) - 1, 0, height - 1);
    const idx = y * width + x;
    if (tiles[idx]) {
      tiles[idx].capitalName = c.name;
      tiles[idx].terrain = "Ke";
    }
  }

  const meta = {
    tick: 0,
    tickIntervalSec: 5,
    seasonDay: 1,
    seasonLengthDays: 40,
    startedAt: new Date().toISOString(),
  };

  return { meta, tiles, players: [], armies: [], actions: [] };
}

export function seedIfMissing() {
  ensureDataDir();
  if (fs.existsSync(DB_PATH)) return false;
  const world = buildFreshWorld();
  writeDb(world);
  return true;
}

export { FACTIONS };
