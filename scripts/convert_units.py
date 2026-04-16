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

def convert():
    csv_path = Path("Rise to War 2.0 Units - Units.csv")
    if not csv_path.exists():
        print(f"Error: {csv_path} not found.")
        return

    # Use encoding='utf-8-sig' to handle potential BOM
    content = csv_path.read_text(encoding='utf-8-sig').splitlines()
    # Skip the 'Updated' line
    reader = csv.DictReader(content[1:])

    units = []
    for row in reader:
        name = row["Name"].strip()
        race = row["Race"].strip()
        
        faction = MAPPING.get(race, "neutral")
        if name in BYZANTINE_UNITS:
            faction = "byzantine_luminants"
        elif race == "Men" and faction == "auric_legion":
             # Keep as auric unless special case
             pass

        unit = {
            "id": name.lower().replace(" ", "_").replace("-", "_"),
            "name": name,
            "tier": int(row["Tier"] or 0),
            "size": row["Size"],
            "supply": int(row["Supply"] or 0),
            "formationSize": int(row["Number of Units in a Formation"].replace(",", "") or 0),
            "race": race,
            "faction": faction,
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
        units.append(unit)

    out_path = Path("fangame/Server/data/unit-data.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({"units": units}, indent=2), encoding="utf-8")
    print(f"Converted {len(units)} units to {out_path}")

if __name__ == "__main__":
    convert()
