# Lord of the Rings: Rise to War — Fan Game Restoration

A fan-made, personal-archival restoration of the **"Lord of the Rings: Rise to War"** mobile grand strategy game, targeting the **Classic 2.0** ruleset. The project ships a fully functional browser-playable shard server alongside a Unity client stub and a comprehensive dataset of reverse-engineered game data.

> **Disclaimer:** This is a non-commercial fan project created for personal use and archival purposes only. All Lord of the Rings IP belongs to its respective rights holders.

---

## 🗂️ Project Structure

```
fangame/
├── Server/                          # Node.js shard server (Express + better-sqlite3 + WebSocket)
│   ├── src/
│   │   ├── server.js                # Main HTTP/WS entry point — all REST routes defined here
│   │   ├── auth.js                  # JWT-style token auth (register / login / requireAuth)
│   │   ├── db.js                    # SQLite schema bootstrap & query helper
│   │   ├── game.js                  # Top-level game loop helpers
│   │   ├── seed.js                  # Initial world seed script
│   │   ├── actions/
│   │   │   └── handlers.js          # Action handlers: stamina ticks, gacha, rallies, respect items
│   │   ├── engine/
│   │   │   ├── shard-engine.js      # Core tick loop & shard state
│   │   │   ├── combat-resolver.js   # Physical / Focus / Siege damage formulas
│   │   │   ├── march-engine.js      # March queuing, pathfinding, arrival resolution
│   │   │   ├── buildings.js         # Base-building upgrade system
│   │   │   ├── tech-tree.js         # Research system and effect application
│   │   │   ├── economy.js           # Production summary computation
│   │   │   ├── resources.js         # Resource balances, spending, income ticks
│   │   │   ├── recruitment-manager.js
│   │   │   ├── formation-manager.js
│   │   │   ├── leaderboard.js       # Global / Weekly / Alliance rankings
│   │   │   ├── map-generator.js     # Procedural world map generation
│   │   │   ├── pathfinding.js
│   │   │   ├── notifications.js
│   │   │   ├── vision-engine.js
│   │   │   ├── base-manager.js
│   │   │   ├── footprint-manager.js
│   │   │   └── player-manager.js
│   │   └── models/
│   ├── data/                        # Game data JSON files (see Data section below)
│   ├── public/                      # Static browser UI served by Express
│   ├── sql/                         # Raw SQL migration/init scripts
│   ├── init_world.js               # One-time world initialisation helper
│   ├── init_cities.js              # One-time city seed helper
│   ├── setup_fog_table.js          # Fog-of-war table bootstrap
│   ├── shard.db                    # SQLite database (auto-generated)
│   └── package.json
│
├── scripts/                         # Python data-pipeline utilities
│   ├── convert_units.py             # CSV → JSON unit converter (classic & remodeled variants)
│   ├── ingest_vesi_commanders.py    # Vesi-score commander parser → JSON templates
│   └── parse_commanders.py          # Early prototype parser (stub)
│
├── UnityClient/                     # Unity 2022.3+ project stub (3D client in progress)
│   ├── Assets/
│   ├── Packages/
│   └── ProjectSettings/
│
├── world-data/                      # Geographic and design data for Middle-earth
│   ├── classic/                     # Classic LotR faction/region data (empty — see raw/)
│   ├── events/
│   │   └── events.yaml              # World event definitions
│   ├── factions/
│   │   ├── factions.json            # Faction definitions (JSON)
│   │   └── factions.yaml            # Faction definitions (YAML source)
│   ├── generated/                   # Output from map-generator runs
│   ├── raw/
│   │   └── arda3/                   # Raw Arda geographic source data
│   ├── remodeled/                   # Alternate "historical fantasy" remodel data
│   └── schema/
│       └── faction.schema.json      # JSON Schema for faction data validation
│
├── Rise to War 2.0 Units - Units.csv  # Source spreadsheet for unit data pipeline
├── shard_design_doc.md              # Game mechanics reference (formulas, tables, progression)
└── README.md
```

---

## 📦 Data Repository (`Server/data/`)

The server loads game data from JSON files at runtime. Two parallel datasets exist — **Classic** (faithful to the original LotR: Rise to War factions) and **Remodeled** (a historical-fantasy reskin):

| File | Description |
|------|-------------|
| `unit-data-classic.json` | 54 unit types mapped to classic LotR factions (Gondor, Mordor, Rohan, etc.) |
| `unit-data.json` | Same units mapped to remodeled faction keys |
| `commander-templates-classic.json` | ~70 commanders with Vesi scores mapped to classic factions |
| `commander-templates.json` | Same commanders mapped to historical-fantasy remodel names/factions |
| `commander-data.json` | Detailed commander stat blocks served via `/api/commanders` |
| `commander-skills.json` | Skill tree structure (base) |
| `commander-skills-v2.json` | Expanded skill tree (v2) |
| `commander-skills-final.json` | Current authoritative skill tree |
| `final_commander_manifest.json` | Merged manifest of active commanders |
| `gear-data.json` | Equipment definitions and progression slots |
| `formulas-config.json` | Configurable formula constants (damage divisors, etc.) |
| `progression-metadata.json` | XP thresholds and level-up data |
| `respect-levels.json` | Respect tier bonuses (R1–Z1) |
| `world-metadata.json` | Strategic landmark and region metadata |
| `world-regions.json` | Region definitions |
| `world-cities.json` | City/settlement seed data |
| `game.json` | Full world snapshot (exported shard state) |

---

## 🔧 Engine Architecture

The shard server (`Server/src/`) is a **Node.js ESM** application using:

- **Express 4** — REST API
- **better-sqlite3** — synchronous SQLite for all persistence (no async DB calls)
- **ws** — WebSocket server for real-time tick broadcasts
- **nanoid / uuid** — ID generation

### API Surface

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api` | Health check & endpoint listing |
| `POST` | `/api/auth/register` | Player registration with faction selection |
| `POST` | `/api/auth/login` | Login, returns session token |
| `GET` | `/api/profile` | Authenticated player profile |
| `GET` | `/api/map` | Full tile map + active marches |
| `POST` | `/api/marches/queue` | Queue a march to a tile |
| `GET` | `/api/resources` | Current resources & production rates |
| `GET` | `/api/commanders` | All commander definitions |
| `POST` | `/api/commanders/skills/upgrade` | Spend skill points (gated by Respect level) |
| `GET` | `/api/buildings` | Player base buildings & levels |
| `POST` | `/api/buildings/upgrade` | Start a building upgrade |
| `GET` | `/api/tech/tree` | Full research tree |
| `POST` | `/api/tech/research` | Begin researching a tech |
| `POST` | `/api/gacha/pull` | Mathom draw (50-pull pity) |
| `POST` | `/api/recruit` | Recruit units |
| `POST` | `/api/rally/create` | Start an alliance rally |
| `GET` | `/api/leaderboard/global` | Global power leaderboard |
| `GET` | `/api/notifications` | Player notification feed |

### Background Ticks

The server runs several `setInterval` loops used to simulate real-time game state:

| System | Frequency |
|--------|-----------|
| Stamina (`+1`) | Every 10 minutes |
| Siege HP regen (`5%`) | Every 60 minutes |
| Rally trigger checks | Every 30 seconds |
| Resource income | Every 5 minutes |
| March arrivals | Every 5 seconds |

---

## 🐍 Data Pipeline Scripts

All scripts are run from the **project root** (`fangame/`). Python 3.8+ required.

### `scripts/convert_units.py`
Reads `Rise to War 2.0 Units - Units.csv` and produces both unit data files:

```bash
python scripts/convert_units.py
# → Server/data/unit-data.json          (remodeled faction keys)
# → Server/data/unit-data-classic.json  (classic LotR faction keys)
```

Maps unit races to factions, supports specific overrides (e.g., Swan Knight → Gondor, Sentinel → Lindon).

### `scripts/ingest_vesi_commanders.py`
Parses a raw Vesi-score text block (~70 commanders) and outputs both commander template files:

```bash
python scripts/ingest_vesi_commanders.py
# → Server/data/commander-templates.json          (remodeled names + factions)
# → Server/data/commander-templates-classic.json  (original LotR names + factions)
```

Derives `baseLeadership` and stat `growth` from Vesi-score subcategories (Dmg/Sustain, Stat Boost, CC).

### `scripts/parse_commanders.py`
Early prototype parser stub — superseded by `ingest_vesi_commanders.py`.

---

## 🎮 Dual-Mode Design

The dataset supports two parallel "skins" of the same game:

| Mode | Factions | Commander Names |
|------|----------|-----------------|
| **Classic** | Gondor, Mordor, Rohan, Erebor, Isengard, Lothlórien, Angmar, Lindon, … | Gandalf, Aragorn, Sauron, Galadriel, … |
| **Remodeled** | Auric Legion, Steppe Stormhorde, Nocturne Carth, Iron Dominion, Verdant Covenant, Byzantine Luminants | Leonidas, Caligula, Zenobia, Pythagoras, … |

The server currently loads the **remodeled** unit & commander data by default. Swap the filenames in `server.js` to activate Classic mode.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (for the server)
- **Python 3.8+** (for data scripts, optional)
- **Unity 2022.3+** (for the 3D client, optional)

### 1. Run the Shard Server

```powershell
cd Server
npm install
npm start
```

The server starts on **port 3847** by default:

```
⚔️  Imperium — Historical Fantasy Grand Strategy
   Shard Server running on port 3847
   API:       http://localhost:3847/api
   WebSocket: ws://localhost:3847
```

Open the browser UI at **http://localhost:3847/** — do *not* open `index.html` directly via `file://`, as ES module imports and `/api` calls will break.

**Hot-reload dev mode:**
```powershell
npm run dev
```

**Custom port:**
```powershell
$env:PORT=3848; npm start
```

> If `npm start` fails with a `better-sqlite3` native binding error, run `npm rebuild better-sqlite3`.

### 2. Regenerate Game Data (Optional)

Run from the project root:

```bash
python scripts/convert_units.py
python scripts/ingest_vesi_commanders.py
```

### 3. Unity Client (Optional)

Open the `UnityClient/` folder in **Unity 2022.3 LTS** or later. The Unity client is currently a project stub; backend connectivity work is ongoing.

---

## 📖 Reference Documents

- **`shard_design_doc.md`** — Complete mechanics reference including all damage formulas, healing calculations, siege tables, Respect progression bonuses, XP thresholds, tile affluence values, and high-tier unit stats.
- **`Server/README.md`** — Quick-start server instructions.
- **`world-data/schema/faction.schema.json`** — JSON Schema for validating faction data files.

---

*Fan project — for personal use and archival purposes only.*
