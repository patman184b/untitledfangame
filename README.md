# Project Data Inventory & Analysis

This document provides a full audit and analysis of the data assets currently integrated into the project. The project leverages a mix of community-scraped tactical data and high-fidelity geographic datasets.

## 1. Executive Summary

| Category | Count / Volume | Coverage |
| :--- | :--- | :--- |
| **Commanders** | 72 Templates | 11 Remodeled, 61 Generic/Neutral |
| **Units** | 54 Types | Full stats from "Rise to War 2.0" |
| **Factions** | 6 Major Sides | Historical analogs + Magic themes |
| **World Map** | 57,036 Tiles | Persistent Grid stored in `shard.db` |
| **Geography** | 4 GeoJSON Layers | Middle-earth (Arda 3) Topology |
| **Real-time State** | 33 Tables | Persistence for Alliances, Marches, etc. |

---

## 2. Commanders & Leaders

The commander dataset is structured around **VESI scores** (Relic, Respect, Dmg/Sustain, CC, etc.), which originate from community meta-analysis.

### Analysis of the 72 Commander Templates:
- **Faction Distribution**:
    - `nocturne_carth`: 3 (Zenobia, Akhenaten, Assurbanipal)
    - `iron_dominion`: 2 (Pythagoras, Boudica)
    - `steppe_stormhorde`: 2 (Caligula, Alaric)
    - `byzantine_luminants`: 2 (Apollonius, Themistocles)
    - `auric_legion`: 1 (Leonidas)
    - `verdant_covenant`: 1 (Vercingetorix)
    - **Neutral/Historical Shadow**: 61 entries
- **Attribute Depth**: Each commander has 9 core "VESI" stats and derived growth rates for Attack, Defense, and Initiative.

> [!NOTE]
> The "Remodel" logic maps classic LOTR figures to Historical/Fantasy analogs (e.g., Saruman -> Pythagoras, Sauron -> Caligula).

---

## 3. Troops & Units

The unit data consists of **54 distinct unit types** scraped from high-tier competitive metadata.

### Statistical Coverage:
- **Core Stats**: Range, Speed, Attack, Defense, HP.
- **Role Distribution**: Frontline (Tanks), Ranged Support, Flanking (Cavalry), and Utility (Mages).
- **Faction rosters**: 14+ units specifically assigned to starting rosters in `factions.yaml`.

---

## 4. Factions & Lore

Six primary factions have been established, each with a specific **Historical Analog** and **Magic Theme**.

### Strategic Diversity:
- **Diversity of passive bonuses**: From `SacredGroves` (Regeneration in forest) to `BlackSails` (Coastal movement).
- **Resource Depth**: Factions have unique starting rosters and capitals (e.g., Nova Roma, Emerald Gaul).

---

## 5. World Map & Geography

The data covers the physical topology of Middle-earth (Arda 3).

### Geographic Layers (GeoJSON):
1. **poly_region**: 8 major regional boundaries.
2. **poly_forest**: High-detail forest coverage for regeneration logic.
3. **poly_mountainhigh**: Impassable terrain/mountainous regions.
4. **point_place**: Landmarks and strategic locations.

### Persistence Grid:
The live world is represented by **57,036 pre-calculated tiles** in the SQLite database. This grid supports:
- **Dynamic Terrain**: Hex-based movement and defense modifiers.
- **Visibility**: Integrated Fog of War table (`visibility`).
- **Territories**: Pre-assigned regional ownership zones.

---

## 6. Database Schema Analysis

The backend (`shard.db`) is highly advanced, containing **33 tables** that handle the full RTS lifecycle:

| System | Key Tables |
| :--- | :--- |
| **Movement** | `marches`, `action_queue`, `rally_members` |
| **Economics** | `player_resources`, `buildings`, `player_techs` |
| **Military** | `unit_inventory`, `commander_state`, `commander_army` |
| **Social** | `alliances`, `alliance_members`, `notifications` |
| **Meta-Progression** | `player_gacha`, `commander_respect`, `commander_skills` |

---

## 7. Data Pedigree & Source Analysis

1. **Scraped Data**: Unit stats and Commander "VESI" scores are community-driven meta data, providing a high level of balance parity with established RTS standards.
2. **Procedural Data**: The `tiles` grid was generated from the raw GeoJSON topology to allow for real-time pathfinding.
3. **Manual Curation**: Faction definitions and Event triggers (`events.yaml`) are custom-designed for this specific shard implementation.

> [!IMPORTANT]
> **Data completeness is high**. The baseline for a full "Season 1" shard is present, including both static assets and the dynamic persistence layer required for multiplayer.
