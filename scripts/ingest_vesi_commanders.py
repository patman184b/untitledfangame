import json
import re
from pathlib import Path

# The data provided by the user in the prompt
RAW_DATA = """
Beorn – 18
Relic: 1 | Respect: 2 | Dmg/Sustain: 4 | Stat Boost: 1 | CC: 2 | Utility: 3 | Versatility: 2 | Synergy: 1 | Gear: 2

Saruman – 18
Relic: 2 | Respect: 2 | Dmg/Sustain: 4 | Stat Boost: 1 | CC: 1 | Utility: 3 | Versatility: 2 | Synergy: 1 | Gear: 2

Sauron – 18
Relic: 1 | Respect: 2 | Dmg/Sustain: 3 | Stat Boost: 2 | CC: 2 | Utility: 3 | Versatility: 2 | Synergy: 1 | Gear: 2

Galadriel – 17
Relic: 2 | Respect: 1.5 | Dmg/Sustain: 4 | Stat Boost: 0.5 | CC: 2 | Utility: 2.5 | Versatility: 2 | Synergy: 1 | Gear: 1.5

Gandalf the White – 17
Relic: 2 | Respect: 2 | Dmg/Sustain: 4 | Stat Boost: 0.25 | CC: 0.75 | Utility: 3 | Versatility: 2 | Synergy: 1 | Gear: 2

Undying – 17
Relic: 2 | Respect: 2 | Dmg/Sustain: 4 | Stat Boost: 0 | CC: 1 | Utility: 3 | Versatility: 2 | Synergy: 1 | Gear: 2

Helm – 16.5
Relic: 2 | Respect: 2 | Dmg/Sustain: 3 | Stat Boost: 1 | CC: 0.5 | Utility: 3 | Versatility: 2 | Synergy: 1 | Gear: 2

Dain – 16
Relic: 2 | Respect: 2 | Dmg/Sustain: 4 | Stat Boost: 0.25 | CC: 0.75 | Utility: 2 | Versatility: 2 | Synergy: 1 | Gear: 2

Gil-Galad – 16
Relic: 1 | Respect: 2 | Dmg/Sustain: 4 | Stat Boost: 1 | CC: 1 | Utility: 3 | Versatility: 1 | Synergy: 1 | Gear: 2

Shadow – 16
Relic: 2 | Respect: 1 | Dmg/Sustain: 4 | Stat Boost: 1 | CC: 0 | Utility: 3 | Versatility: 2 | Synergy: 1 | Gear: 2

Skalhelm – 16
Relic: 2 | Respect: 1 | Dmg/Sustain: 4 | Stat Boost: 0 | CC: 2 | Utility: 3 | Versatility: 2 | Synergy: 1 | Gear: 1

Isildur – 14.5
Relic: 1.5 | Respect: 1 | Dmg/Sustain: 3 | Stat Boost: 2 | CC: 0 | Utility: 2 | Versatility: 2 | Synergy: 1 | Gear: 2

Witch-king – 14.5
Relic: 1 | Respect: 2 | Dmg/Sustain: 2 | Stat Boost: 1.5 | CC: 2 | Utility: 2 | Versatility: 1 | Synergy: 1 | Gear: 2

Gwaihir – 14
Relic: 2 | Respect: 2 | Dmg/Sustain: 3 | Stat Boost: 1 | CC: 0 | Utility: 2 | Versatility: 1 | Synergy: 1 | Gear: 2

Azog – 13.5
Relic: 2 | Respect: 2 | Dmg/Sustain: 2 | Stat Boost: 0 | CC: 2 | Utility: 2 | Versatility: 1 | Synergy: 1 | Gear: 1.5

Aragorn King of Men – 13
Relic: 1 | Respect: 2 | Dmg/Sustain: 2 | Stat Boost: 0 | CC: 2 | Utility: 2 | Versatility: 1 | Synergy: 1 | Gear: 2

Cestaro – 13
Relic: 2 | Respect: 1 | Dmg/Sustain: 3 | Stat Boost: 0 | CC: 1 | Utility: 2 | Versatility: 2 | Synergy: 1 | Gear: 1

Elrond – 13
Relic: 1 | Respect: 2 | Dmg/Sustain: 3 | Stat Boost: 2 | CC: 0 | Utility: 2 | Versatility: 1 | Synergy: 1 | Gear: 1

Eomer – 13
Relic: 2 | Respect: 1 | Dmg/Sustain: 4 | Stat Boost: 0 | CC: 0 | Utility: 2 | Versatility: 1 | Synergy: 1 | Gear: 2

Gandalf the Grey – 13
Relic: 1.5 | Respect: 1.5 | Dmg/Sustain: 3 | Stat Boost: 0 | CC: 0 | Utility: 2 | Versatility: 2 | Synergy: 1 | Gear: 2

Kirun – 13
Relic: 1 | Respect: 1 | Dmg/Sustain: 2.5 | Stat Boost: 1 | CC: 2 | Utility: 1 | Versatility: 1.5 | Synergy: 1 | Gear: 2

Thorin – 13
Relic: 0 | Respect: 2 | Dmg/Sustain: 3 | Stat Boost: 0 | CC: 0.5 | Utility: 3 | Versatility: 1.5 | Synergy: 1 | Gear: 2

Black Serpent – 12
Relic: 1 | Respect: 2 | Dmg/Sustain: 2 | Stat Boost: 2 | CC: 0 | Utility: 1 | Versatility: 1 | Synergy: 1 | Gear: 2

Cirdan – 12
Relic: 1 | Respect: 1 | Dmg/Sustain: 2 | Stat Boost: 2 | CC: 1 | Utility: 2 | Versatility: 1 | Synergy: 1 | Gear: 1

Gimli – 13
Relic: 2 | Respect: 1 | Dmg/Sustain: 4 | Stat Boost: 1 | CC: 0 | Utility: 1 | Versatility: 2 | Synergy: 1 | Gear: 1

Lurtz – 12
Relic: 2 | Respect: 1 | Dmg/Sustain: 3 | Stat Boost: 1 | CC: 0 | Utility: 1 | Versatility: 2 | Synergy: 1 | Gear: 1

Legolas – 11.5
Relic: 2 | Respect: 1 | Dmg/Sustain: 3 | Stat Boost: 0 | CC: 0 | Utility: 1.5 | Versatility: 2 | Synergy: 1 | Gear: 1

Thranduil – 11.5
Relic: 1 | Respect: 2 | Dmg/Sustain: 2.5 | Stat Boost: 1.5 | CC: 0 | Utility: 1 | Versatility: 1.5 | Synergy: 1 | Gear: 1

Boromir – 11
Relic: 2 | Respect: 1 | Dmg/Sustain: 2.5 | Stat Boost: 1.5 | CC: 0 | Utility: 1 | Versatility: 1 | Synergy: 1 | Gear: 1

Frodo & Sam – 11
Relic: 0 | Respect: 1 | Dmg/Sustain: 2.5 | Stat Boost: 1 | CC: 0 | Utility: 1.5 | Versatility: 2 | Synergy: 1 | Gear: 2

Lathar – 11
Relic: 2 | Respect: 1 | Dmg/Sustain: 3 | Stat Boost: 1 | CC: 0 | Utility: 1 | Versatility: 1 | Synergy: 1 | Gear: 1

Oglurg – 11
Relic: 1 | Respect: 1 | Dmg/Sustain: 2.5 | Stat Boost: 1.5 | CC: 0 | Utility: 1.5 | Versatility: 1.5 | Synergy: 1 | Gear: 1

Radagast – 11
Relic: 1 | Respect: 2 | Dmg/Sustain: 2.5 | Stat Boost: 1 | CC: 0.5 | Utility: 0.5 | Versatility: 1.5 | Synergy: 1 | Gear: 1

Theoden – 11
Relic: 2 | Respect: 1 | Dmg/Sustain: 2 | Stat Boost: 1.5 | CC: 0.5 | Utility: 1 | Versatility: 1 | Synergy: 1 | Gear: 1

Agzok – 10
Relic: 1 | Respect: 1 | Dmg/Sustain: 3 | Stat Boost: 0 | CC: 0 | Utility: 1 | Versatility: 2 | Synergy: 1 | Gear: 1

Azru-Khor – 10
Relic: 1.5 | Respect: 1 | Dmg/Sustain: 3 | Stat Boost: 0 | CC: 0 | Utility: 1 | Versatility: 1 | Synergy: 1 | Gear: 1.5

Bard – 10
Relic: 0.5 | Respect: 1 | Dmg/Sustain: 3 | Stat Boost: 1 | CC: 0 | Utility: 1 | Versatility: 1.5 | Synergy: 1 | Gear: 1

Falgin – 10
Relic: 2 | Respect: 1 | Dmg/Sustain: 2 | Stat Boost: 1 | CC: 0 | Utility: 1 | Versatility: 1 | Synergy: 1 | Gear: 1

Grima – 10
Relic: 1 | Respect: 1 | Dmg/Sustain: 2 | Stat Boost: 1 | CC: 1 | Utility: 1 | Versatility: 1 | Synergy: 1 | Gear: 1

Sunind – 10
Relic: 1 | Respect: 2 | Dmg/Sustain: 2 | Stat Boost: 1 | CC: 0 | Utility: 1 | Versatility: 1 | Synergy: 1 | Gear: 1
 
Aragorn II – 9.5
Relic: 1 | Respect: 1 | Dmg/Sustain: 1.5 | Stat Boost: 1.5 | CC: 1 | Utility: 0.5 | Versatility: 1 | Synergy: 1 | Gear: 1

King of the Dead – 9.5
Relic: 1 | Respect: 1 | Dmg/Sustain: 2 | Stat Boost: 1 | CC: 0.5 | Utility: 1 | Versatility: 1 | Synergy: 1 | Gear: 1

Treebeard – 9.5
Relic: 1 | Respect: 2 | Dmg/Sustain: 1.5 | Stat Boost: 1 | CC: 1 | Utility: 0.5 | Versatility: 0.5 | Synergy: 1 | Gear: 1

Beruthiel – 9
Relic: 1 | Respect: 1 | Dmg/Sustain: 2 | Stat Boost: 1 | CC: 0 | Utility: 1 | Versatility: 1 | Synergy: 1 | Gear: 1

Gothmog – 9
Relic: 1 | Respect: 1 | Dmg/Sustain: 2 | Stat Boost: 1 | CC: 0 | Utility: 1 | Versatility: 1 | Synergy: 1 | Gear: 1

Arwen – 8.5
Relic: 1 | Respect: 1 | Dmg/Sustain: 1.5 | Stat Boost: 2 | CC: 0 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 1

Denethor – 8.5
Relic: 1 | Respect: 1 | Dmg/Sustain: 1.5 | Stat Boost: 1.5 | CC: 0.5 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 1

Dwalin – 8.5
Relic: 1 | Respect: 1 | Dmg/Sustain: 2.5 | Stat Boost: 1 | CC: 0 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 1

Eowyn – 8.5
Relic: 1 | Respect: 1 | Dmg/Sustain: 1.5 | Stat Boost: 1.5 | CC: 0.5 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 1

Faramir – 8.5
Relic: 1.5 | Respect: 1 | Dmg/Sustain: 1.5 | Stat Boost: 1.5 | CC: 0 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 1

Glasha – 8.5
Relic: 0 | Respect: 1 | Dmg/Sustain: 1.5 | Stat Boost: 1.5 | CC: 0.5 | Utility: 1 | Versatility: 1 | Synergy: 1 | Gear: 1

Khamul – 8.5
Relic: 0 | Respect: 1 | Dmg/Sustain: 2 | Stat Boost: 1 | CC: 1 | Utility: 0.5 | Versatility: 1 | Synergy: 1 | Gear: 1

Merry & Pippin – 8.5
Relic: 1 | Respect: 1 | Dmg/Sustain: 1 | Stat Boost: 2 | CC: 0.5 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 1

Elladan – 8
Relic: 0.5 | Respect: 1 | Dmg/Sustain: 2 | Stat Boost: 1.5 | CC: 0 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 1

Elrohir – 8
Relic: 1 | Respect: 1 | Dmg/Sustain: 1 | Stat Boost: 1.5 | CC: 0.5 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 1

Hirgon – 8
Relic: 1 | Respect: 1 | Dmg/Sustain: 2 | Stat Boost: 0 | CC: 0 | Utility: 0 | Versatility: 2 | Synergy: 1 | Gear: 1

Imrahil – 8
Relic: 1 | Respect: 1 | Dmg/Sustain: 1 | Stat Boost: 1.5 | CC: 0.5 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 1

Mouth of Sauron – 8
Relic: 1 | Respect: 1 | Dmg/Sustain: 1 | Stat Boost: 1 | CC: 0 | Utility: 1 | Versatility: 1 | Synergy: 1 | Gear: 1

Ori – 8
Relic: 1.5 | Respect: 1 | Dmg/Sustain: 1.5 | Stat Boost: 1 | CC: 0 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 1

Qurwan – 8
Relic: 1 | Respect: 1 | Dmg/Sustain: 1 | Stat Boost: 2 | CC: 0 | Utility: 1 | Versatility: 1 | Synergy: 1 | Gear: 0
Balin – 7.5
Relic: 0.5 | Respect: 1 | Dmg/Sustain: 2 | Stat Boost: 0.5 | CC: 0.5 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 1

Gorbag – 7.5
Relic: 1.5 | Respect: 1 | Dmg/Sustain: 1 | Stat Boost: 1.5 | CC: 0.5 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 0

Grishnakh – 7.5
Relic: 0.5 | Respect: 1 | Dmg/Sustain: 1 | Stat Boost: 1 | CC: 1 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 1

Adunae – 7
Relic: 1 | Respect: 1 | Dmg/Sustain: 2 | Stat Boost: 0 | CC: 0 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 1

Ugluk – 7
Relic: 0 | Respect: 1 | Dmg/Sustain: 1 | Stat Boost: 2 | CC: 0 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 1

Ugthak – 7
Relic: 1 | Respect: 1 | Dmg/Sustain: 1 | Stat Boost: 1 | CC: 0 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 1

Celeborn – 6
Relic: 1 | Respect: 0 | Dmg/Sustain: 1 | Stat Boost: 2 | CC: 0 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 0

Khaldoon – 6
Relic: 0 | Respect: 1 | Dmg/Sustain: 1 | Stat Boost: 1 | CC: 0 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 1

Maltok – 5
Relic: 0.5 | Respect: 0 | Dmg/Sustain: 1 | Stat Boost: 1 | CC: 0.5 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 0

Shagrat – 4.5
Relic: 0 | Respect: 0 | Dmg/Sustain: 0.5 | Stat Boost: 1.5 | CC: 0.5 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 0

Haldir – 4
Relic: 0 | Respect: 0 | Dmg/Sustain: 1 | Stat Boost: 1 | CC: 0 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 0

Yusraa – 4
Relic: 0 | Respect: 0 | Dmg/Sustain: 1 | Stat Boost: 0.5 | CC: 0.5 | Utility: 0 | Versatility: 1 | Synergy: 1 | Gear: 0

Zegrid – 3
Relic: 0 | Respect: 0 | Dmg/Sustain: 1 | Stat Boost: 1 | CC: 0 | Utility: 0 | Versatility: 1 | Synergy: 0 | Gear: 0

Sharku – 2.5
Relic: 0 | Respect: 0 | Dmg/Sustain: 1 | Stat Boost: 0.5 | CC: 0.5 | Utility: 0 | Versatility: 0 | Synergy: 0.5 | Gear: 0
"""

# Mapping LotR names to Historical/Fantasy remodeled figures
REMODEL_MAP = {
    "Galadriel": {"name": "Zenobia", "title": "The Eternal Empress", "faction": "nocturne_carth"},
    "Beorn": {"name": "Vercingetorix", "title": "The Wild-King", "faction": "verdant_covenant"},
    "Saruman": {"name": "Pythagoras", "title": "The Geometric-Mage", "faction": "iron_dominion"},
    "Sauron": {"name": "Caligula", "title": "The Arcane-Tyrant", "faction": "steppe_stormhorde"},
    "Gandalf the White": {"name": "Apollonius", "title": "Radiant-Oracle", "faction": "byzantine_luminants"},
    "Undying": {"name": "Akhenaten", "title": "The Everlasting", "faction": "nocturne_carth"},
    "Helm": {"name": "Leonidas", "title": "The Iron-Shield", "faction": "auric_legion"},
    "Dain": {"name": "Boudica", "title": "Iron-Hammer of Iceni", "faction": "iron_dominion"},
    "Gil-Galad": {"name": "Themistocles", "title": "Lance of the Sea", "faction": "byzantine_luminants"},
    "Shadow": {"name": "Assurbanipal", "title": "Lord of Nineveh", "faction": "nocturne_carth"},
    "Skalhelm": {"name": "Alaric", "title": "Scourge of Rome", "faction": "steppe_stormhorde"},
}

def parse():
    commanders = []
    # Split by double newline to get blocks
    blocks = re.split(r'\n\n', RAW_DATA.strip())
    
    for block in blocks:
        lines = block.strip().split('\n')
        if len(lines) < 2: continue
        
        # Parse Name and Score
        match_header = re.match(r'(.+?) – ([\d.]+)', lines[0])
        if not match_header: continue
        
        lotr_name = match_header.group(1).strip()
        total_score = float(match_header.group(2))
        
        # Parse attributes
        attr_line = lines[1]
        attrs = {}
        for part in attr_line.split('|'):
            key_val = part.split(':')
            if len(key_val) == 2:
                key = key_val[0].strip().lower().replace('/', '_').replace(' ', '_')
                attrs[key] = float(key_val[1].strip())
        
        # Default remodeling if not in map
        remodel = REMODEL_MAP.get(lotr_name, {
            "name": f"Ancient {lotr_name}",
            "title": "Historical Shadow",
            "faction": "neutral"
        })

        commander = {
            "id": lotr_name.lower().replace(" ", "_").replace("-", "_").replace("&", "and"),
            "original_name": lotr_name,
            "name": remodel["name"],
            "title": remodel["title"],
            "faction": remodel["faction"],
            "vesi_score": total_score,
            "vesi_stats": attrs,
            "baseLeadership": 100 + int(total_score * 2),
            "growth": {
                "attack": 1.0 + (attrs.get("dmg_sustain", 0) * 0.5),
                "defense": 1.0 + (attrs.get("stat_boost", 0) * 0.5),
                "initiative": 1.0 + (attrs.get("cc", 0) * 0.5)
            }
        }
        commanders.append(commander)

    out_path = Path("fangame/Server/data/commander-templates.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({"commanders": commanders}, indent=2), encoding="utf-8")
    print(f"Ingested {len(commanders)} commanders.")

if __name__ == "__main__":
    parse()
