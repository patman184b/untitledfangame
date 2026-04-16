import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UNIT_DATA_PATH = path.join(__dirname, "../../data/unit-data.json");
const COMMANDER_DATA_PATH = path.join(__dirname, "../../data/commander-templates.json");
const FORMULAS_PATH = path.join(__dirname, "../../data/formulas-config.json");
const PROGRESSION_PATH = path.join(__dirname, "../../data/progression-metadata.json");

const unitData = JSON.parse(fs.readFileSync(UNIT_DATA_PATH, "utf-8")).units;
const commanderTemplates = JSON.parse(fs.readFileSync(COMMANDER_DATA_PATH, "utf-8")).commanders;
const formulas = JSON.parse(fs.readFileSync(FORMULAS_PATH, "utf-8"));
const progression = JSON.parse(fs.readFileSync(PROGRESSION_PATH, "utf-8"));

export class CombatResolver {
  // Nonlinear Effective Command Scaling (User Table 1-80)
  static getEffectiveCommand(cmd) {
    if (cmd <= 1) return 0.22;
    if (cmd >= 80) return 8.60;
    const curve = [
        0.22, 0.43, 0.64, 0.84, 1.04, 1.23, 1.42, 1.61, 1.79, 1.96, // 1-10
        2.13, 2.30, 2.46, 2.62, 2.78, 2.93, 3.08, 3.23, 3.37, 3.51, // 11-20
        3.65, 3.78, 3.91, 4.04, 4.17, 4.29, 4.41, 4.53, 4.65, 4.76, // 21-30
        4.87, 4.98, 5.09, 5.20, 5.30, 5.41, 5.51, 5.60, 5.70, 5.80, // 31-40
        5.89, 5.98, 6.07, 6.16, 6.25, 6.34, 6.42, 6.50, 6.59, 6.67, // 41-50
        6.75, 6.82, 6.90, 6.98, 7.05, 7.12, 7.20, 7.27, 7.34, 7.41, // 51-60
        7.48, 7.54, 7.61, 7.67, 7.74, 7.80, 7.86, 7.93, 7.99, 8.05, // 61-70
        8.11, 8.16, 8.22, 8.28, 8.33, 8.39, 8.44, 8.50, 8.55, 8.60  // 71-80
    ];
    return curve[Math.floor(cmd) - 1] || 0.22;
  }

  static resolve(attacker, defender) {
    const log = [];
    const sideA = this.initSide(attacker, 'attacker');
    const sideB = this.initSide(defender, 'defender');
    const casualties = { attacker: {}, defender: {} };

    log.push({ round: 0, actions: ["Preparation Phase: Scaling stats."] });

    for (let r = 1; r <= 10; r++) {
      const roundLog = { round: r, actions: [] };
      const all = [...sideA, ...sideB].filter(f => f.currentCount > 0);
      all.sort((a, b) => b.initiative - a.initiative);

      for (const actor of all) {
        if (actor.stuns > 0) { actor.stuns--; continue; }

        const targets = actor.side === 'attacker' ? sideB : sideA;
        const target = targets.find(t => t.currentCount > 0);
        if (!target) break;

        // 1. Process Commander Skills
        this.processCommanderSkills(actor, target, r, roundLog);
        
        // 2. Process Formation Damage
        const result = this.calculatePhysicalDamage(actor, target);
        target.currentCount -= result.losses;
        
        // Track casualties
        const sideKey = target.side;
        casualties[sideKey][target.id] = (casualties[sideKey][target.id] || 0) + result.losses;

        roundLog.actions.push({ actor: actor.name, action: "ATTACK", target: target.name, losses: result.losses });
      }
      log.push(roundLog);
      if (sideA.every(f => f.currentCount <= 0) || sideB.every(f => f.currentCount <= 0)) break;
    }
    
    // Determine outcome
    const aAlive = sideA.some(f => f.currentCount > 0);
    const bAlive = sideB.some(f => f.currentCount > 0);
    let result;
    if (aAlive && bAlive) {
      result = 'draw';  // Both sides survived 10 rounds — attacker stays on tile
    } else if (aAlive) {
      result = 'attacker';
    } else {
      result = 'defender';
    }

    return { 
      winner: result === 'draw' ? null : result,
      result,
      log,
      casualties 
    };
  }

  /**
   * Probability-based equipment proc (e.g. Dwarven Slingshot: 90% max damage chance)
   */
  static rollEquipmentProc(proc) {
    if (!proc) return false;
    return Math.random() < (proc.chance || 0);
  }

  /**
   * Validate that a player can use a specific gear item 
   * (Either no restriction, or the restriction matches the commander)
   */
  static validateGearEquip(gear, commanderId) {
    if (!gear.restrictedTo) return true;
    return gear.restrictedTo === commanderId;
  }

  /**
   * Validate T4 unit access: requires base level 10 OR a captured den tile
   */
  static validateT4Access(playerBase, playerTiles) {
    if (playerBase && playerBase.level >= 10) return true;
    const hasDen = playerTiles && playerTiles.some(
      t => t.terrain === 'den' && t.owner_id === playerBase.player_id
    );
    return hasDen;
  }

  static resolveSiege(army, currentHP) {
    let totalSiegeDamage = 0;

    army.formations.forEach(f => {
      const u = unitData.find(ut => ut.id === f.unitId);
      const tier = u.tier || 'T1';
      // MarioVX Formula Constants (Mocked for now)
      const a = 100 * (u.attack / 10);
      const b = 500;
      
      const siegeDmg = Math.floor(a * f.count / (f.count + b));
      totalSiegeDamage += siegeDmg;
    });

    return { 
      siegeDamage: totalSiegeDamage,
      remainingHP: Math.max(0, currentHP - totalSiegeDamage)
    };
  }

  static calculatePhysicalDamage(actor, target) {
    const avgDmg = (actor.dmgMin + actor.dmgMax) / 2;
    
    // Exact Formula: mightBonus = 0.05% * Might
    const mightBonus = 1 + (actor.commander.might * 0.0005);
    const effCmd = this.getEffectiveCommand(actor.commander.command || 1);
    
    const raw = actor.currentCount * avgDmg * mightBonus * effCmd;
    const mitigation = actor.attack / (actor.attack + target.defense);
    const losses = Math.floor((raw * mitigation) / target.hp);
    return { losses };
  }

  static applySkillEffect(actor, target, skill, round, log) {
    const focus = actor.commander.focus || 0;
    const speed = actor.commander.speed || 0;

    switch (skill.effect) {
      case 'damage_reduction':
        // Focus-based reduction: -% Received = 0.05% * Focus (based on Focus Bonus sheet)
        actor.mitigationStack = (actor.mitigationStack || 1) * (1 - (focus * 0.0005));
        break;
      case 'troop_damage_boost':
        // Might-based boost (Might Bonus sheet)
        actor.damageMult = (actor.damageMult || 1) * (1 + (actor.commander.might * 0.0005));
        break;
      case 'healing':
        // Heal% = 20% + 0.1% * Focus (Resupply sheet)
        const healPerc = 0.20 + (focus * 0.001);
        const healAmount = Math.floor(actor.hp * actor.currentCount * healPerc);
        actor.currentCount += Math.floor(healAmount / actor.hp);
        log.actions.push({ actor: actor.commander.name, action: "HEAL", amount: healAmount });
        break;
    }
  }

  static initSide(army, sideName) {
    // Check if it's an NPC garrison (JSON string)
    let formations = army.formations;
    if (typeof army.formations === 'string') {
        formations = JSON.parse(army.formations);
    }

    return formations.map(f => {
      const u = unitData.find(ut => ut.id === f.unitId);
      const unitProxy = { ...u, id: f.unitId, currentCount: f.count, side: sideName, stuns: 0 };
      unitProxy.commander = army.commander || { name: "Garrison", might: 0, focus: 0, speed: 0, command: 1 };
      return unitProxy;
    });
  }

  /**
   * Generates a garrison based on tile level (1-13)
   */
  static generateNPCGarrison(level) {
    const tier = level > 10 ? 4 : (level > 6 ? 3 : (level > 3 ? 2 : 1));
    const baseCount = 100 * level;
    
    // Pick a random unit of appropriate tier
    const eligible = unitData.filter(u => u.tier === `T${tier}`);
    const unit = eligible[Math.floor(Math.random() * eligible.length)];

    return [
        { unitId: unit.id, count: baseCount },
        { unitId: unit.id, count: Math.floor(baseCount * 0.5) } // Secondary stack
    ];
  }

  /**
   * Siege HP purely determined by Tier
   */
  static getBaseSiegeHP(type, tier) {
    if (type === 'city') return 5000 + (tier * 2000);
    if (type === 'base') return 2000 + (tier * 500);
    return 100 + (tier * 100); // Standard tile/fortress
  }
}
