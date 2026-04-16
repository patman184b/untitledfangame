# 📖 Shard Design Document: Technical Reference

This document serves as the **Single Source of Truth** for the Shard's mechanics, compiled from all provided spreadsheets, formulas, and expert guides.

---

## ⚔️ Combat Mechanics

### 1. Physical Damage Formula
Calculates attack damage from physical-based commander skills.
> **Formula:**
> `(Command_Damage * Level / 2.03) * (Skill_Dmg / 100) * (1 + (Cmd_Attack - Enemy_Defense) / 200) * (1 + Modifiers) * (1 - Reductions)`

### 2. Focus Damage Formula
Calculates attack damage from focus-based commander skills.
> **Formula:**
> `(Command_Damage * Level / 2.95) * (Skill_Dmg / 100) * (1 + (Cmd_Focus / 200)) * (1 + Modifiers) * (1 - Reductions)`

### 3. Siege Damage Formula
Calculates structural damage per formation.
> **Formula:**
> `Siege = Floor[a * Supply / (Supply + b)]`

| Tier | a | b |
| :--- | :--- | :--- |
| **SS / S** | 500 | 733.33 |
| **A** | 325 | 750 |
| **B** | 325 | 1500 |
| **C** | 325 | 7500 |
| **D** | 325 | 30000 |

### 4. Command Scaling (Diminishing Returns)
- **Damage Increase/Decrease:** `(100 * Command) / (Command + 1000)`
- **Heal Bonus:** `(Command * 5) / (Command + 2500)`

---

## 🩹 Healing Reference

### Base Formula
> `Heal = 9.6 * Level * (Heal_Skill_Coeff + Scaling_Stat * Scaling_Value / 100) * Healing_Modifiers`

### Commander Scaling Values
| Commander | Skill | Scaling Stat | Scaling Value |
| :--- | :--- | :--- | :--- |
| **Balin** | Lord of Moria | Focus | 2.4 |
| **The Undying** | Second Wind | Focus | 2.0 |
| **Cestaro** | The Evocator | Focus | 1.0 |
| **Azru-khor** | Warship Captain | Focus | 0.8 |
| **Galadriel** | Nenyas Guard | Focus | 0.7 |
| **Gandalf the Grey** | The Grey | Focus | 0.3 |
| **Denethor** | Ally | Focus | 0.1 |

---

## 🎖️ Progression: Respect & Leveling

### Respect Stat Boosts
| Level | Bonus |
| :--- | :--- |
| **R1** | +8 Skill Points |
| **R5** | Ascension (Commander Specific), +5% Unit Damage |
| **R6** | +10 Attack / Focus / Defense |
| **R10** | Ascension (Commander Specific), +10 All Stats, Unlock Relic |
| **Z1** | +30 Command, +3 Damage, +300 HP |

### Commander Experience Requirements
- **Level 10:** 3,700 XP
- **Level 20:** 32,000 XP
- **Level 30:** 130,000 XP
- **Level 50:** 2,600,000 XP

---

## 🗺️ World & Economy

### Tile Affluence (Points per Hour)
- **Lv 1:** 1
- **Lv 5:** 35
- **Lv 10:** 260
- **Lv 13:** 390

### Mob Rewards (Lv 6-40)
| Lv | Defenders | Base XP | Unique Reward |
| :--- | :--- | :--- | :--- |
| **10** | 2 | 1,520 | Juicy Meat |
| **20** | 3 | 7,920 | Ancient Twigs |
| **30** | 4 | 15,840 | Bag of Riches |
| **40** | 4 | 39,840 | Peculiar Artifact |

---

## 🛡️ High-Tier Unit Reference (Tier 4)

| Unit | HP | Defense | Special Trait |
| :--- | :--- | :--- | :--- |
| **War Chariot** | 52 | 64 | -10% Physical Dmg |
| **Swan Knight** | 46.5 | 60 | Protect (2), +20 Def, -2% Dmg Received |
| **Mumakil** | 56 | 70 | -10% Physical Dmg, Colossal |
| **Fell Beast** | 52 | 40 | -20% Melee Dmg Rec, +20% Ranged Dmg Rec |
