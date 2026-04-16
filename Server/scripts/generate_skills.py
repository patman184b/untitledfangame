import json
import os

COMMANDER_DATA_PATH = r"c:\Users\patma\Desktop\lotrrtw\fangame\Server\data\commander-templates.json"
SKILLS_OUTPUT_PATH = r"c:\Users\patma\Desktop\lotrrtw\fangame\Server\data\commander-skills.json"

with open(COMMANDER_DATA_PATH, "r") as f:
    data = json.load(f)

commanders = data["commanders"]
skills_db = {}

# Special skills from the Wiki/Image
special_mappings = {
    "king_of_the_dead": {
        "T1": {"id": "incorporeal", "name": "Incorporeal", "effect": "damage_reduction", "scaling": 0.5, "branches": [{"id": "ethereal", "name": "Ethereal", "max": 2}, {"id": "ghost_march", "name": "Ghost March", "max": 2}]},
        "T2": {"id": "men_of_the_mountains", "name": "Men of the Mountains", "effect": "troop_damage_boost", "scaling": 1.2, "branches": [{"id": "loyalist", "name": "Loyalist", "max": 2}, {"id": "mountain_spirit", "name": "Mountain Spirit", "max": 2}]},
        "T3": {"id": "army_of_the_dead", "name": "Army of the Dead", "effect": "stun_chance", "scaling": 0.1, "branches": [{"id": "spectral_touch", "name": "Spectral Touch", "max": 2}, {"id": "vengance", "name": "Vengeance", "max": 2}]}
    },
    "sauron": {
        "T1": {"id": "deceiver", "name": "The Deceiver", "effect": "focus_damage_boost", "scaling": 2.0, "branches": [{"id": "illusion", "name": "Illusion", "max": 2}, {"id": "dread", "name": "Dread", "max": 2}]},
        "T2": {"id": "the_enemy", "name": "The Enemy", "effect": "stat_boost_all", "scaling": 1.0, "branches": [{"id": "command", "name": "Command", "max": 2}, {"id": "authority", "name": "Authority", "max": 2}]},
        "T3": {"id": "the_renewed", "name": "The Renewed", "effect": "heal_on_damage", "scaling": 0.05, "branches": [{"id": "rebirth", "name": "Rebirth", "max": 2}, {"id": "eternal_eye", "name": "Eternal Eye", "max": 2}]}
    }
}

for cmd in commanders:
    cid = cmd["id"]
    if cid in special_mappings:
        skills_db[cid] = special_mappings[cid]
    else:
        # Generate generic balanced placeholders
        skills_db[cid] = {
            "T1": {
                "id": f"{cid}_t1", "name": f"Master of {cmd['title']}", "effect": "stat_boost_atk", "scaling": 1.0, "max": 10,
                "branches": [{"id": f"{cid}_t1a", "name": "Precision", "max": 2}, {"id": f"{cid}_t1b", "name": "Force", "max": 2}]
            },
            "T2": {
                "id": f"{cid}_t2", "name": f"Tactics of {cmd['faction'].replace('_', ' ').title()}", "effect": "stat_boost_def", "scaling": 1.0, "max": 10,
                "branches": [{"id": f"{cid}_t2a", "name": "Positioning", "max": 2}, {"id": f"{cid}_t2b", "name": "Warden", "max": 2}]
            },
            "T3": {
                "id": f"{cid}_t3", "name": f"Legacy of {cid.title().replace('_', ' ')}", "effect": "utility_boost", "scaling": 0.5, "max": 10,
                "branches": [{"id": f"{cid}_t3a", "name": "Leadership", "max": 2}, {"id": f"{cid}_t3b", "name": "Inspiration", "max": 2}]
            }
        }

with open(SKILLS_OUTPUT_PATH, "w") as f:
    json.dump({"commanders": skills_db}, f, indent=2)

print(f"Successfully generated skills for {len(skills_db)} commanders.")
