import path from "path";
import fs   from "fs";
import { fileURLToPath } from "url";
import { query } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────
// WORLD MAP POPULATION ENGINE
// Shard capacity: 6 factions × 250 players = 1,500 players
// Map: 300×200 = 60,000 tiles
//
// Structure layout per shard:
//   6 Regional Capitals  (5×5 cities)        — 1 per faction
//  30 Fortresses         (2×2)               — 5 per faction
//  60 Forts              (1×1)               — 10 per faction
// ~1,500 Player Base zones                   — 250 per faction region
//   Remaining tiles      → resource tiles with NPC garrisons
// ─────────────────────────────────────────────

const PLAYERS_PER_FACTION = 250;
const FACTION_COUNT       = 6;
const MAX_PLAYERS         = PLAYERS_PER_FACTION * FACTION_COUNT; // 1500

const FACTIONS = [
  { key: "rome",     name: "Rome",     color: "#b00000" },
  { key: "egypt",    name: "Egypt",    color: "#ffcc00" },
  { key: "carthage", name: "Carthage", color: "#3366cc" },
  { key: "gaul",     name: "Gaul",     color: "#006600" },
  { key: "greece",   name: "Greece",   color: "#00ccff" },
  { key: "persia",   name: "Persia",   color: "#9900cc" },
];

// Garrison scaling: troops and siege HP per tile level (1–13)
function garrisonForLevel(level) {
  return {
    troops:   Math.floor(1000 * Math.pow(1.5, level - 1)),
    siege_hp: Math.floor(5000 * Math.pow(1.8, level - 1)),
  };
}

// Tile level distribution probabilities
function rollLevel(structureType) {
  switch (structureType) {
    case "city":     return 13;
    case "fortress": return 10 + Math.floor(Math.random() * 3); // 10–12
    case "fort":     return 6  + Math.floor(Math.random() * 4); // 6–9
    default:
      // Resource tiles: levels 1–5, weighted toward lower
      const roll = Math.random();
      if (roll < 0.35) return 1;
      if (roll < 0.60) return 2;
      if (roll < 0.75) return 3;
      if (roll < 0.88) return 4;
      return 5;
  }
}

export class MapGenerator {
  constructor(options = {}) {
    this.width   = options.width  ?? 300;  // 300×200 = 60,000 tiles for 1,500 players
    this.height  = options.height ?? 200;
    this.playersPerFaction = options.playersPerFaction ?? PLAYERS_PER_FACTION;
  }

  generateWorld() {
    console.log(`[MapGen] Generating ${this.width}x${this.height} world...`);

    // Clear existing tiles
    query("DELETE FROM tiles");
    query("DELETE FROM structures");

    const terrainGrid = this._generateTerrain();
    const placed      = new Set(); // Occupied tile set
    const cityTiles   = new Set(); // Tracks every tile that is part of a city (5x5)
                                   // Bases cannot be adjacent to these — forts/fortresses OK
    const pendingSpawnZones = new Map(); // "x,y" → factionKey, applied after all tiles are written

    // 1. Place regional CITIES (5x5, one per faction)
    const cityPositions = this._spreadPositions(6, 5, placed);
    const regions       = [];

    for (let i = 0; i < 6; i++) {
      const [cx, cy] = cityPositions[i];
      const faction  = FACTIONS[i];
      const structId = `city_${faction.key}`;
      const level    = 13;
      const g        = garrisonForLevel(level);

      query("INSERT INTO structures (id, type, faction_id, anchor_x, anchor_y, width, height) VALUES (?, ?, ?, ?, ?, 5, 5)",
        [structId, "city", faction.key, cx, cy]);

      // Mark all 5x5 tiles
      for (let dy = 0; dy < 5; dy++) {
        for (let dx = 0; dx < 5; dx++) {
          const tx = cx + dx, ty = cy + dy;
          const isAnchor = dx === 2 && dy === 2;
          this._placeTile(tx, ty, terrainGrid, {
            level,
            structure_id: structId,
            is_anchor:    isAnchor ? 1 : 0,
            region_id:    faction.key,
            defenders_json: JSON.stringify([{ unit: "infantry", count: isAnchor ? g.troops : Math.floor(g.troops * 0.2) }]),
            siege_hp:     isAnchor ? g.siege_hp : null,
            max_siege_hp: isAnchor ? g.siege_hp : null,
          });
          placed.add(`${tx},${ty}`);
          cityTiles.add(`${tx},${ty}`);   // Track for spawn exclusion
        }
      }
      regions.push({ id: faction.key, cx: cx + 2, cy: cy + 2, factionKey: faction.key });
    }

    // 2. Place FORTRESSES (2x2) — 5 per faction (30 total)
    const fortressPositions = this._spreadPositions(30, 2, placed);
    for (let i = 0; i < fortressPositions.length; i++) {
      const [fx, fy] = fortressPositions[i];
      const faction  = FACTIONS[i % 6];
      const structId = `fortress_${faction.key}_${i}`;
      const level    = rollLevel("fortress");
      const g        = garrisonForLevel(level);

      query("INSERT INTO structures (id, type, faction_id, anchor_x, anchor_y, width, height) VALUES (?, ?, ?, ?, ?, 2, 2)",
        [structId, "fortress", faction.key, fx, fy]);

      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const tx = fx + dx, ty = fy + dy;
          const isAnchor = dx === 0 && dy === 0;
          this._placeTile(tx, ty, terrainGrid, {
            level,
            structure_id: structId,
            is_anchor:    isAnchor ? 1 : 0,
            region_id:    this._nearestRegion(tx, ty, regions),
            defenders_json: JSON.stringify([{ unit: "infantry", count: isAnchor ? g.troops : Math.floor(g.troops * 0.3) }]),
            siege_hp:     isAnchor ? g.siege_hp : null,
            max_siege_hp: isAnchor ? g.siege_hp : null,
          });
          placed.add(`${tx},${ty}`);
        }
      }
    }

    // 3. Place FORTS (1x1) — 10 per faction (60 total)
    const fortPositions = this._spreadPositions(60, 1, placed);
    for (let i = 0; i < fortPositions.length; i++) {
      const [fx, fy] = fortPositions[i];
      const faction  = FACTIONS[i % 6];
      const level    = rollLevel("fort");
      const g        = garrisonForLevel(level);

      this._placeTile(fx, fy, terrainGrid, {
        level,
        structure_id: null,
        is_anchor:    0,
        region_id:    this._nearestRegion(fx, fy, regions),
        defenders_json: JSON.stringify([{ unit: "infantry", count: g.troops }]),
        siege_hp:     g.siege_hp,
        max_siege_hp: g.siege_hp,
      });
      placed.add(`${fx},${fy}`);
    }

    // 4. Reserve PLAYER BASE SPAWN ZONES
    //    Each faction region gets 250 spawn slots. These are not pre-placed
    //    as player tiles (players build on join) but we seed the metadata
    //    so the spawn system knows which tiles are valid starting points.
    for (let f = 0; f < FACTION_COUNT; f++) {
      const faction = FACTIONS[f];
      const region  = regions[f];
      const spawnCandidates = [];

      // Impassable terrain types — bases cannot be adjacent to these
      const IMPASSABLE = new Set(['Ww', 'Mm']);

      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          if (placed.has(`${x},${y}`)) continue;

          const terrain = terrainGrid[y]?.[x];
          if (!terrain || IMPASSABLE.has(terrain)) continue; // Tile itself is impassable

          // Rule 1: No adjacency to impassable terrain (mountains, water)
          // Check all 8 neighbours (cardinal + diagonal) — bases can't touch rivers or cliffs
          let touchesImpassable = false;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nt = terrainGrid[y + dy]?.[x + dx];
              if (!nt || IMPASSABLE.has(nt)) { touchesImpassable = true; break; }
            }
            if (touchesImpassable) break;
          }
          if (touchesImpassable) continue;

          // Rule 2 (terrain): No adjacency to city tiles
          // Forts and fortresses do NOT appear in cityTiles so they are allowed
          let touchesCity = false;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              if (cityTiles.has(`${x + dx},${y + dy}`)) { touchesCity = true; break; }
            }
            if (touchesCity) break;
          }
          if (touchesCity) continue;

          const dist = Math.abs(x - region.cx) + Math.abs(y - region.cy);
          spawnCandidates.push({ x, y, dist });
        }
      }

      // Sort by proximity to capital — closest spots filled first
      spawnCandidates.sort((a, b) => a.dist - b.dist);

      // Rule 2: No bases touching each other — greedy pick with 2-tile clearance
      // (clearance of 2 means tiles can't be adjacent — 1 empty tile gap minimum)
      const BASE_CLEARANCE = 2;
      const claimedSpawns  = new Set(); // "x,y" keys of accepted spawns
      const spawnZones     = [];

      for (const cand of spawnCandidates) {
        if (spawnZones.length >= this.playersPerFaction) break;

        // Check no existing accepted spawn is within clearance distance
        let tooClose = false;
        for (let dy = -BASE_CLEARANCE; dy <= BASE_CLEARANCE; dy++) {
          for (let dx = -BASE_CLEARANCE; dx <= BASE_CLEARANCE; dx++) {
            if (claimedSpawns.has(`${cand.x + dx},${cand.y + dy}`)) {
              tooClose = true; break;
            }
          }
          if (tooClose) break;
        }
        if (tooClose) continue;

        spawnZones.push(cand);
        claimedSpawns.add(`${cand.x},${cand.y}`);
      }

      for (const sz of spawnZones) {
        // Defer the DB write until after all tiles are placed in step 5
        pendingSpawnZones.set(`${sz.x},${sz.y}`, faction.key);
      }

      if (spawnZones.length < this.playersPerFaction) {
        console.warn(`[MapGen] ${faction.name}: only ${spawnZones.length}/${this.playersPerFaction} spawn zones found after terrain/clearance filtering. Consider enlarging the map.`);
      } else {
        console.log(`[MapGen] ${faction.name}: ${spawnZones.length} spawn zones reserved (terrain-safe, non-adjacent).`);
      }
    }

    // 5. Fill RESOURCE TILES — remaining traversable tiles
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (placed.has(`${x},${y}`)) continue;
        const terrain = terrainGrid[y][x];
        if (terrain === "Ww") continue; // Skip water

        const level = rollLevel("resource");
        const g     = garrisonForLevel(level);

        this._placeTile(x, y, terrainGrid, {
          level,
          structure_id: null,
          is_anchor:    0,
          region_id:    this._nearestRegion(x, y, regions),
          defenders_json: JSON.stringify([{ unit: "infantry", count: g.troops }]),
          siege_hp:     g.siege_hp,
          max_siege_hp: g.siege_hp,
        });
      }
    }

    // 6. Apply spawn_faction labels (must happen after all tiles are written)
    for (const [key, factionKey] of pendingSpawnZones.entries()) {
      const [sx, sy] = key.split(",").map(Number);
      query(
        "UPDATE tiles SET spawn_faction = ? WHERE x = ? AND y = ? AND owner_id IS NULL",
        [factionKey, sx, sy]
      );
    }

    const tileCount = query("SELECT COUNT(*) as c FROM tiles").rows[0].c;
    console.log(`[MapGen] World generated: ${tileCount} tiles placed.`);
    return { tileCount };
  }

  // ─────────────────────────────────────────────
  // TERRAIN GENERATION (Simplex-style noise approximation)
  // ─────────────────────────────────────────────

  _generateTerrain() {
    const grid = [];
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        // Crude noise: edge → water, interior → varied terrain
        const distFromEdge = Math.min(x, y, this.width - 1 - x, this.height - 1 - y);
        if (distFromEdge < 3) { row.push("Ww"); continue; }

        const noise = Math.sin(x * 0.15 + y * 0.11) * Math.cos(x * 0.07 - y * 0.19);
        if (noise > 0.5)       row.push("Mm"); // Mountains
        else if (noise > 0.2)  row.push("Hh"); // Hills / Ore
        else if (noise < -0.3) row.push("Ff"); // Forest / Wood
        else if (noise < -0.5) row.push("Ww"); // Lakes
        else                   row.push("Gg"); // Grassland / Grain
      }
      grid.push(row);
    }
    return grid;
  }

  _placeTile(x, y, terrainGrid, meta) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const terrain = terrainGrid[y]?.[x] ?? "Gg";
    const g       = meta.defenders_json ? JSON.parse(meta.defenders_json)[0] : null;
    query(`
      INSERT OR REPLACE INTO tiles
        (x, y, terrain, level, structure_id, is_anchor, region_id, owner_id,
         defenders_json, siege_hp, max_siege_hp, last_siege_damage_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL)
    `, [
      x, y, terrain,
      meta.level ?? 1,
      meta.structure_id ?? null,
      meta.is_anchor ?? 0,
      meta.region_id ?? null,
      meta.defenders_json ?? null,
      meta.siege_hp ?? 0,
      meta.max_siege_hp ?? 0,
    ]);
  }

  // ─────────────────────────────────────────────
  // UTILITY
  // ─────────────────────────────────────────────

  _spreadPositions(count, size, occupied) {
    const positions = [];
    const padding = size + 8; // Minimum spacing between structures
    let attempts = 0;

    while (positions.length < count && attempts < 5000) {
      attempts++;
      const x = Math.floor(Math.random() * (this.width  - size - 5)) + 3;
      const y = Math.floor(Math.random() * (this.height - size - 5)) + 3;

      // Check clearance
      let clear = true;
      for (let dy = -padding; dy < size + padding; dy++) {
        for (let dx = -padding; dx < size + padding; dx++) {
          if (occupied.has(`${x + dx},${y + dy}`)) { clear = false; break; }
        }
        if (!clear) break;
      }
      if (!clear) continue;

      positions.push([x, y]);
      // Reserve the area
      for (let dy = 0; dy < size; dy++)
        for (let dx = 0; dx < size; dx++)
          occupied.add(`${x + dx},${y + dy}`);
    }

    console.log(`[MapGen] Placed ${positions.length}/${count} structures (${attempts} attempts)`);
    return positions;
  }

  _nearestRegion(x, y, regions) {
    let best = null, bestDist = Infinity;
    for (const r of regions) {
      const d = Math.abs(r.cx - x) + Math.abs(r.cy - y);
      if (d < bestDist) { bestDist = d; best = r.id; }
    }
    return best;
  }
}
