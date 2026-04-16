import csv
import json
from pathlib import Path

# Mapping CSV Race/Name to Game Factions
MAPPING = {
    "Men": "auric_legion",  # Default for Men, will split later
    "Orcs": "steppe_stormhorde",
    "Uruk-Hai": "steppe_stormhorde",
    "Trolls": "steppe_stormhorde",
    "Evil Men": "steppe_stormhorde",
    "Elves": "nocturne_carth",
    "Undead": "nocturne_carth",
    "Dwarves": "iron_dominion",
    "Beornings": "verdant_covenant",
    "Ents": "verdant_covenant",
    "Beasts": "verdant_covenant"
}

# Specific unit overrides for Byzantine
BYZANTINE_UNITS = ["Swan Knight", "Ranger of the North", "Dale Watchman", "Woses Hunter", "Sentinel"]

# Mapping CSV Race to Classic LotR Factions
CLASSIC_MAPPING = {
    "Orcs": "mordor",
    "Uruk-Hai": "isengard",
    "Trolls": "mordor",
    "Evil Men": "mordor", # Harad/Rhun
    "Men": "gondor",     # Default for Men
    "Elves": "lothlorien",
    "Dwarves": "erebor",
    "Beornings": "beornings",
    "Ents": "neutral",
    "Beasts": "neutral",
    "Undead": "angmar"
}

# Specific unit overrides for Classic Factions
CLASSIC_OVERRIDES = {
    "Rohan Spearman": "rohan",
    "Rohan Archer": "rohan",
    "Rider of Rohan": "rohan",
    "Marsh Marshall": "rohan",
    "Swan Knight": "gondor",
    "Sentinel": "lindon",
    "Dale Watchman": "erebor",
    "Iron Warrior": "erebor"
}

def convert():
    csv_path = Path("Rise to War 2.0 Units - Units.csv")
    if not csv_path.exists():
        print(f"Error: {csv_path} not found.")
        return

    # Use encoding='utf-8-sig' to handle potential BOM
    content = csv_path.read_text(encoding='utf-8-sig').splitlines()
    # Skip the 'Updated' line
    reader = csv.DictReader(content[1:])

    remodeled_units = []
    classic_units = []

    for row in reader:
        name = row["Name"].strip()
        race = row["Race"].strip()
        
        # Remodeled Logic
        faction = MAPPING.get(race, "neutral")
        if name in BYZANTINE_UNITS:
            faction = "byzantine_luminants"
        
        unit_id = name.lower().replace(" ", "_").replace("-", "_")
        
        common_data = {
            "id": unit_id,
            "tier": int(row["Tier"] or 0),
            "size": row["Size"],
            "supply": int(row["Supply"] or 0),
            "formationSize": int(row["Number of Units in a Formation"].replace(",", "") or 0),
            "race": race,
            "range": row["Range"],
            "dmgMin": int(row["Damage Min"] or 0),
            "dmgMax": int(row["Damage Max"] or 0),
            "attack": int(row["Attack"] or 0),
            "initiative": int(row["Initiative"] or 0),
            "hp": int(row["HP"] or 0),
            "defense": int(row["Defense"] or 0),
            "siege": int(row["Siege"] or 0),
            "maxSiege": int(row["Max Siege per Formation"].replace(",", "") or 0),
            "speed": int(row["March Speed"] or 0),
            "specials": [
                s.strip() for s in [row["Special 1"], row["Special 2"], row["Special 3"]] if s and s.strip()
            ],
            "costs": {
                "wood": int(row["Wood"] or 0),
                "ore": int(row["Ore"] or 0),
                "grain": int(row["Grain"] or 0),
                "contribution": int(row["Contribution"] or 0)
            }
        }

        # Remodeled Entry
        remodeled_units.append({
            **common_data,
            "name": name,
            "faction": faction
        })

        # Classic Entry
        classic_units.append({
            **common_data,
            "name": name,
            "faction": CLASSIC_OVERRIDES.get(name, CLASSIC_MAPPING.get(race, "neutral"))
        })

    # Save Remodeled
    out_path = Path("Server/data/unit-data.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({"units": remodeled_units}, indent=2), encoding="utf-8")
    
    # Save Classic
    classic_out_path = Path("Server/data/unit-data-classic.json")
    classic_out_path.write_text(json.dumps({"units": classic_units}, indent=2), encoding="utf-8")
    
    print(f"Converted {len(remodeled_units)} units to both standard and classic formats.")

if __name__ == "__main__":
    convert()
