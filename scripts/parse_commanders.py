import re
import json

text = """
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
""" # Truncated for script logic, will expand to full list in actual run

# Regex to match Commander Name – Total Score and stats
# [TODO] Implement full parser for the user's provided block
