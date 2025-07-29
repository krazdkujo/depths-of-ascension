/**
 * Combat System - Handles D20 combat mechanics for Depths of Ascension
 * Implements skill-based combat with energy system
 */

class CombatSystem {
    /**
     * Rolls a D20 dice
     * @returns {number} Random number between 1-20
     */
    static rollD20() {
        return Math.floor(Math.random() * 20) + 1;
    }
    
    /**
     * Calculates attack roll result
     * @param {number} skillLevel - Attacker's relevant skill level
     * @param {Object} modifiers - Additional modifiers {item: 0, buffs: 0, debuffs: 0}
     * @returns {Object} {roll: number, total: number, critical: boolean, fumble: boolean}
     */
    static calculateAttackRoll(skillLevel, modifiers = {}) {
        const roll = this.rollD20();
        const itemBonus = modifiers.item || 0;
        const buffs = modifiers.buffs || 0;
        const debuffs = modifiers.debuffs || 0;
        
        // Apply -5 penalty if skill level is 0
        const skillPenalty = skillLevel === 0 ? -5 : 0;
        
        const total = roll + skillLevel + itemBonus + buffs - debuffs + skillPenalty;
        
        return {
            roll,
            total,
            critical: roll === 20,
            fumble: roll === 1,
            breakdown: {
                base: roll,
                skill: skillLevel + skillPenalty,
                item: itemBonus,
                buffs,
                debuffs: -debuffs
            }
        };
    }
    
    /**
     * Calculates defense roll result
     * @param {Object} character - Character object with skills
     * @param {Object} modifiers - Additional modifiers
     * @returns {Object} Attack roll result
     */
    static calculateDefenseRoll(character, modifiers = {}) {
        const skills = character.skills || {};
        
        // Find highest relevant defensive skill
        const defensiveSkills = [
            skills.dodge || 0,
            skills.shield_use || 0,
            skills.parry || 0
        ];
        
        const highestDefensiveSkill = Math.max(...defensiveSkills);
        
        return this.calculateAttackRoll(highestDefensiveSkill, modifiers);
    }
    
    /**
     * Calculates damage for an attack
     * @param {number} skillLevel - Attacker's skill level
     * @param {number} weaponDamage - Base weapon damage
     * @param {Object} modifiers - Additional modifiers {ability: 0, critical: false}
     * @returns {number} Total damage dealt
     */
    static calculateDamage(skillLevel, weaponDamage, modifiers = {}) {
        let baseDamage = Math.floor(skillLevel / 5) + weaponDamage;
        
        // Add ability modifiers
        if (modifiers.ability) {
            baseDamage += modifiers.ability;
        }
        
        // Apply critical hit
        if (modifiers.critical) {
            baseDamage *= 2;
        }
        
        // Minimum 1 damage
        return Math.max(1, baseDamage);
    }
    
    /**
     * Resolves a complete attack action
     * @param {Object} attacker - Attacking character
     * @param {Object} defender - Defending character/enemy
     * @param {string} skillId - Skill used for attack
     * @param {Object} attackModifiers - Attack modifiers
     * @param {Object} defenseModifiers - Defense modifiers
     * @returns {Object} Combat result
     */
    static resolveAttack(attacker, defender, skillId, attackModifiers = {}, defenseModifiers = {}) {
        const attackerSkill = attacker.skills[skillId] || 0;
        const weaponDamage = this.getWeaponDamage(attacker.equipment?.main_hand);
        
        // Roll attack and defense
        const attackRoll = this.calculateAttackRoll(attackerSkill, attackModifiers);
        const defenseRoll = this.calculateDefenseRoll(defender, defenseModifiers);
        
        const hit = attackRoll.total >= defenseRoll.total;
        let damage = 0;
        let actualDamage = 0;
        
        if (hit) {
            damage = this.calculateDamage(attackerSkill, weaponDamage, {
                critical: attackRoll.critical,
                ability: attackModifiers.ability || 0
            });
            
            // Apply damage to defender
            actualDamage = Math.min(damage, defender.current_hp);
        }
        
        return {
            hit,
            attackRoll,
            defenseRoll,
            damage,
            actualDamage,
            critical: attackRoll.critical,
            fumble: attackRoll.fumble,
            skillUsed: skillId,
            skillLevel: attackerSkill
        };
    }
    
    /**
     * Gets weapon damage for equipped weapon
     * @param {string} weaponId - Weapon item ID
     * @returns {number} Weapon damage value
     */
    static getWeaponDamage(weaponId) {
        const weaponStats = {
            'rusty_sword': 1,
            'iron_sword': 3,
            'steel_sword': 5,
            'simple_bow': 2,
            'flaming_sword': 5
        };
        
        return weaponStats[weaponId] || 0;
    }
    
    /**
     * Gets armor defense value
     * @param {string} armorId - Armor item ID
     * @returns {number} Defense value
     */
    static getArmorDefense(armorId) {
        const armorStats = {
            'cloth_armor': 1,
            'leather_armor': 3,
            'iron_shield': 3
        };
        
        return armorStats[armorId] || 0;
    }
    
    /**
     * Calculates initiative order for combat
     * @param {Array} participants - Array of characters/enemies
     * @returns {Array} Sorted array by initiative (highest first)
     */
    static calculateInitiative(participants) {
        return participants.map(participant => {
            const perception = participant.skills?.perception || 0;
            const roll = this.rollD20();
            const initiative = roll + Math.floor(perception / 10);
            
            return {
                ...participant,
                initiative,
                initiativeRoll: roll
            };
        }).sort((a, b) => b.initiative - a.initiative);
    }
    
    /**
     * Checks if a character can use a reaction
     * @param {Object} character - Character object
     * @param {string} skillId - Skill to check for reaction eligibility
     * @returns {boolean} Can use reaction
     */
    static canUseReaction(character, skillId) {
        const skillLevel = character.skills?.[skillId] || 0;
        return skillLevel >= 5; // Minimum skill level 5 for reactions
    }
    
    /**
     * Processes skill progression after use
     * @param {Object} character - Character object
     * @param {string} skillId - Skill that was used
     * @returns {Object} {leveledUp: boolean, newLevel: number}
     */
    static processSkillProgression(character, skillId) {
        const currentLevel = character.skills[skillId] || 0;
        
        // Progression formula: chance = 100 / (current_skill_level + 10)%
        const progressChance = 100 / (currentLevel + 10);
        const roll = Math.random() * 100;
        
        if (roll < progressChance) {
            const newLevel = Math.min(currentLevel + 1, 100); // Max level 100
            character.skills[skillId] = newLevel;
            
            return {
                leveledUp: true,
                newLevel,
                oldLevel: currentLevel
            };
        }
        
        return {
            leveledUp: false,
            newLevel: currentLevel,
            oldLevel: currentLevel
        };
    }
    
    /**
     * Calculates character's total level
     * @param {Object} skills - Skills object {skill_id: level}
     * @returns {number} Sum of all skill levels
     */
    static calculateTotalLevel(skills) {
        return Object.values(skills || {}).reduce((sum, level) => sum + level, 0);
    }
    
    /**
     * Calculates maximum HP based on total level
     * @param {number} totalLevel - Character's total level
     * @returns {number} Maximum HP
     */
    static calculateMaxHP(totalLevel) {
        return 20 + Math.floor(totalLevel / 10);
    }
    
    /**
     * Calculates maximum energy based on total level
     * @param {number} totalLevel - Character's total level
     * @returns {number} Maximum energy
     */
    static calculateMaxEnergy(totalLevel) {
        return 10 + Math.floor(totalLevel / 20);
    }
    
    /**
     * Checks if character meets ability requirements
     * @param {Object} character - Character object
     * @param {Object} requirements - Requirements object {skill_id: min_level}
     * @returns {Object} {meetsRequirements: boolean, missingSkills: Array}
     */
    static checkAbilityRequirements(character, requirements) {
        const missingSkills = [];
        
        for (const [skillId, minLevel] of Object.entries(requirements)) {
            const currentLevel = character.skills[skillId] || 0;
            if (currentLevel < minLevel) {
                missingSkills.push({
                    skill: skillId,
                    required: minLevel,
                    current: currentLevel
                });
            }
        }
        
        return {
            meetsRequirements: missingSkills.length === 0,
            missingSkills
        };
    }
    
    /**
     * Calculates ability effectiveness based on skill levels exceeding requirements
     * @param {Object} character - Character object
     * @param {Object} requirements - Requirements object {skill_id: min_level}
     * @param {number} bonusPerRequirement - Bonus per extra requirement level
     * @returns {number} Additional effectiveness bonus
     */
    static calculateAbilityBonus(character, requirements, bonusPerRequirement = 1) {
        let totalBonus = 0;
        
        for (const [skillId, minLevel] of Object.entries(requirements)) {
            const currentLevel = character.skills[skillId] || 0;
            const excess = Math.max(0, currentLevel - minLevel);
            totalBonus += excess * bonusPerRequirement;
        }
        
        return totalBonus;
    }
    
    /**
     * Applies damage to a character/enemy
     * @param {Object} target - Target to damage
     * @param {number} damage - Damage amount
     * @returns {Object} {newHP: number, wasKnockedOut: boolean, died: boolean}
     */
    static applyDamage(target, damage) {
        const newHP = Math.max(0, target.current_hp - damage);
        const wasKnockedOut = target.current_hp > 0 && newHP === 0;
        const died = newHP === 0;
        
        target.current_hp = newHP;
        
        if (died) {
            target.status = target.status === 'active' ? 'knocked_out' : 'dead';
        }
        
        return {
            newHP,
            wasKnockedOut,
            died
        };
    }
    
    /**
     * Applies healing to a character
     * @param {Object} target - Target to heal
     * @param {number} healing - Healing amount
     * @returns {Object} {newHP: number, actualHealing: number}
     */
    static applyHealing(target, healing) {
        const maxHP = this.calculateMaxHP(this.calculateTotalLevel(target.skills));
        const newHP = Math.min(maxHP, target.current_hp + healing);
        const actualHealing = newHP - target.current_hp;
        
        target.current_hp = newHP;
        
        return {
            newHP,
            actualHealing
        };
    }
    
    /**
     * Consumes energy for ability use
     * @param {Object} character - Character using ability
     * @param {number} energyCost - Energy cost of ability
     * @returns {boolean} Whether energy was successfully consumed
     */
    static consumeEnergy(character, energyCost) {
        if (character.current_energy >= energyCost) {
            character.current_energy -= energyCost;
            return true;
        }
        return false;
    }
    
    /**
     * Restores energy to a character
     * @param {Object} character - Character to restore energy to
     * @param {number} amount - Amount to restore
     * @returns {number} Actual amount restored
     */
    static restoreEnergy(character, amount) {
        const maxEnergy = this.calculateMaxEnergy(this.calculateTotalLevel(character.skills));
        const newEnergy = Math.min(maxEnergy, character.current_energy + amount);
        const actualRestore = newEnergy - character.current_energy;
        
        character.current_energy = newEnergy;
        
        return actualRestore;
    }
}