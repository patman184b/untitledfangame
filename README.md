# Lord of the Rings: Rise to War - Fan Game Restoration

This repository contains the core datasets and server infrastructure for a fan-made restoration project of the "Lord of the Rings: Rise to War" experience (Classic 2.0 format).

## 🗂️ Project Structure

- **`Server/`**: Backend implementation for the game shard.
    - **`Server/data/`**: The primary data repository containing LotR "Classic" datasets in JSON format.
        - `unit-data-classic.json`: Detailed stats for 54 unit types.
        - `commander-templates-classic.json`: Core templates for legendary commanders.
        - `commander-skills.json`: Complete skill trees and metadata.
        - `gear-data.json`: Equipment stats and progression logic.
        - `world-metadata.json`: Strategic landmarks and regional data.
- **`scripts/`**: Python utility scripts for data ingestion and normalization.
- **`UnityClient/`**: High-fidelity 3D client project files.
- **`world-data/`**: Geographic and topological data for Middle-earth.
- **`shard_design_doc.md`**: Technical overview of the state management and narrative architecture.

## 🚀 Restoration Status

The project has been successfully "rolled back" from a remodeled state to a classic LotR format. 
Key features currently integrated:
- **Classic Data Synchronization**: Full parity with the original game's unit and commander stats.
- **Dual-Mode Backend**: The server is configured to load and persist core LotR assets.
- **Geographic Data**: Initial Middle-earth topology is integrated via GeoJSON layers in the `world-data` directory.

## 🛠️ Getting Started

1. **Backend**: Navigate to `Server/` and follow the setup instructions in that directory.
2. **Data Processing**: Use scripts in `scripts/` to ingest new historical data or adjust existing balances.
3. **Unity Client**: Open the `UnityClient/` folder in the Unity Editor (Version 2022.3+ recommended).

---
*Note: This is a fan-made project for personal use and archival purposes.*
