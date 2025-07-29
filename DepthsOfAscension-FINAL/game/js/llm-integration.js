/**
 * LLM Integration - Handles OpenAI API calls for command parsing and narration
 * Provides fallback mechanisms for when LLM is unavailable
 */

class LLMIntegration {
    static API_URL = '/api/llm-proxy';
    static fallbackTemplates = {
        attack: {
            hit: "{character} attacks {target} with {skill}. Hit for {damage} damage!",
            miss: "{character} swings at {target} but misses!",
            critical: "{character} lands a critical hit on {target} for {damage} damage!"
        },
        skill: {
            success: "{character} successfully uses {skill}!",
            failure: "{character} attempts to use {skill} but fails.",
            levelUp: "{character}'s {skill} improves to level {newLevel}!"
        },
        item: {
            success: "{character} uses {item}.",
            failure: "{character} cannot use {item}."
        },
        move: {
            success: "{character} moves to a new position."
        },
        default: "{character} performs an action."
    };
    
    /**
     * Parses a player command into structured intent
     * @param {string} input - Raw player input
     * @param {Array} availableSkills - List of available skills
     * @param {Array} currentEnemies - Current enemies in room
     * @returns {Promise<Object>} Parsed intent object
     */
    static async parseCommand(input, availableSkills = [], currentEnemies = []) {
        try {
            const context = {
                availableSkills: availableSkills.map(s => s.skill_id),
                currentEnemies: currentEnemies.map(e => e.enemy_id),
                input: input.toLowerCase().trim()
            };
            
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'parse',
                    input,
                    context
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                return result.parsed || this.fallbackParser(input, availableSkills, currentEnemies);
            } else {
                return this.fallbackParser(input, availableSkills, currentEnemies);
            }
        } catch (error) {
            console.error('LLM parsing failed, using fallback:', error);
            return this.fallbackParser(input, availableSkills, currentEnemies);
        }
    }
    
    /**
     * Fallback parser for when LLM is unavailable
     * @param {string} input - Raw player input
     * @param {Array} availableSkills - List of available skills
     * @param {Array} currentEnemies - Current enemies in room
     * @returns {Object} Parsed intent object
     */
    static fallbackParser(input, availableSkills = [], currentEnemies = []) {
        const lowercaseInput = input.toLowerCase().trim();
        const words = lowercaseInput.split(/\s+/);
        
        // Attack patterns
        if (words.some(w => ['attack', 'hit', 'strike', 'fight', 'kill'].includes(w))) {
            let target = null;
            let skillSuggested = 'swordsmanship'; // Default
            
            // Look for target
            if (currentEnemies.length > 0) {
                target = currentEnemies[0].enemy_id; // Default to first enemy
                
                // Try to find specific target
                for (const enemy of currentEnemies) {
                    if (lowercaseInput.includes(enemy.enemy_name.toLowerCase())) {
                        target = enemy.enemy_id;
                        break;
                    }
                }
            }
            
            // Try to determine skill
            if (words.some(w => ['sword', 'blade', 'slash'].includes(w))) {
                skillSuggested = 'swordsmanship';
            } else if (words.some(w => ['bow', 'arrow', 'shoot'].includes(w))) {
                skillSuggested = 'archery';
            } else if (words.some(w => ['axe', 'chop'].includes(w))) {
                skillSuggested = 'axe_fighting';
            } else if (words.some(w => ['punch', 'kick', 'fist'].includes(w))) {
                skillSuggested = 'unarmed_combat';
            }
            
            return {
                intent: 'attack',
                target,
                skill_suggested: skillSuggested,
                confidence: 0.8
            };
        }
        
        // Move patterns
        if (words.some(w => ['move', 'go', 'walk', 'run', 'step'].includes(w))) {
            let target = null;
            
            // Try to parse direction/position
            if (words.some(w => ['north', 'up', 'forward'].includes(w))) target = 'north';
            else if (words.some(w => ['south', 'down', 'back'].includes(w))) target = 'south';
            else if (words.some(w => ['east', 'right'].includes(w))) target = 'east';
            else if (words.some(w => ['west', 'left'].includes(w))) target = 'west';
            
            return {
                intent: 'move',
                target,
                skill_suggested: 'navigation',
                confidence: 0.7
            };
        }
        
        // Defend patterns
        if (words.some(w => ['defend', 'block', 'guard', 'shield', 'protect'].includes(w))) {
            return {
                intent: 'use_skill',
                target: null,
                skill_suggested: 'shield_use',
                confidence: 0.8
            };
        }
        
        // Item use patterns
        if (words.some(w => ['use', 'drink', 'consume', 'apply'].includes(w))) {
            let item = null;
            
            if (words.some(w => ['potion', 'health', 'healing'].includes(w))) {
                item = 'health_potion';
            } else if (words.some(w => ['energy', 'mana'].includes(w))) {
                item = 'energy_potion';
            }
            
            return {
                intent: 'use_item',
                target: item,
                skill_suggested: null,
                confidence: 0.7
            };
        }
        
        // Skill use patterns
        if (words.some(w => ['cast', 'spell', 'magic'].includes(w))) {
            let skillSuggested = 'arcane_magic';
            
            if (words.some(w => ['fire', 'flame', 'burn'].includes(w))) {
                skillSuggested = 'fire_magic';
            } else if (words.some(w => ['ice', 'frost', 'freeze'].includes(w))) {
                skillSuggested = 'ice_magic';
            } else if (words.some(w => ['lightning', 'thunder', 'shock'].includes(w))) {
                skillSuggested = 'lightning_magic';
            } else if (words.some(w => ['heal', 'cure', 'restore'].includes(w))) {
                skillSuggested = 'healing_magic';
            }
            
            return {
                intent: 'use_skill',
                target: null,
                skill_suggested: skillSuggested,
                confidence: 0.6
            };
        }
        
        // Interact patterns
        if (words.some(w => ['examine', 'look', 'search', 'inspect', 'check'].includes(w))) {
            return {
                intent: 'interact',
                target: null,
                skill_suggested: 'perception',
                confidence: 0.6
            };
        }
        
        // Default fallback
        return {
            intent: 'unknown',
            target: null,
            skill_suggested: null,
            confidence: 0.1
        };
    }
    
    /**
     * Generates narrative text for game actions
     * @param {Object} actionResult - Result of a game action
     * @param {string} style - Narration style (gritty/heroic/humorous/minimal)
     * @param {Object} character - Character who performed the action
     * @returns {Promise<string>} Narrative text
     */
    static async generateNarration(actionResult, style = 'heroic', character = null) {
        try {
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'narrate',
                    actionResult,
                    style,
                    character: character?.character_name || 'Hero'
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                return result.narration || this.fallbackNarration(actionResult, character);
            } else {
                return this.fallbackNarration(actionResult, character);
            }
        } catch (error) {
            console.error('LLM narration failed, using fallback:', error);
            return this.fallbackNarration(actionResult, character);
        }
    }
    
    /**
     * Fallback narration generator
     * @param {Object} actionResult - Result of a game action
     * @param {Object} character - Character who performed the action
     * @returns {string} Narrative text
     */
    static fallbackNarration(actionResult, character = null) {
        const characterName = character?.character_name || 'Hero';
        
        try {
            switch (actionResult.type) {
                case 'attack':
                    if (actionResult.attackResult.critical) {
                        return this.replaceTokens(this.fallbackTemplates.attack.critical, {
                            character: characterName,
                            target: actionResult.target,
                            skill: this.formatSkillName(actionResult.skillUsed),
                            damage: actionResult.attackResult.damage
                        });
                    } else if (actionResult.success) {
                        return this.replaceTokens(this.fallbackTemplates.attack.hit, {
                            character: characterName,
                            target: actionResult.target,
                            skill: this.formatSkillName(actionResult.skillUsed),
                            damage: actionResult.attackResult.damage
                        });
                    } else {
                        return this.replaceTokens(this.fallbackTemplates.attack.miss, {
                            character: characterName,
                            target: actionResult.target,
                            skill: this.formatSkillName(actionResult.skillUsed)
                        });
                    }
                
                case 'skill_check':
                    let narration = actionResult.success ? 
                        this.replaceTokens(this.fallbackTemplates.skill.success, {
                            character: characterName,
                            skill: this.formatSkillName(actionResult.skillId)
                        }) :
                        this.replaceTokens(this.fallbackTemplates.skill.failure, {
                            character: characterName,
                            skill: this.formatSkillName(actionResult.skillId)
                        });
                    
                    if (actionResult.skillProgress?.leveledUp) {
                        narration += ' ' + this.replaceTokens(this.fallbackTemplates.skill.levelUp, {
                            character: characterName,
                            skill: this.formatSkillName(actionResult.skillId),
                            newLevel: actionResult.skillProgress.newLevel
                        });
                    }
                    
                    return narration;
                
                case 'item_use':
                    if (actionResult.success) {
                        let narration = this.replaceTokens(this.fallbackTemplates.item.success, {
                            character: characterName,
                            item: actionResult.item || 'item'
                        });
                        
                        if (actionResult.healingResult) {
                            narration += ` Restored ${actionResult.healingResult.actualHealing} HP.`;
                        }
                        
                        return narration;
                    } else {
                        return this.replaceTokens(this.fallbackTemplates.item.failure, {
                            character: characterName,
                            item: actionResult.item || 'item'
                        });
                    }
                
                case 'move':
                    return this.replaceTokens(this.fallbackTemplates.move.success, {
                        character: characterName
                    });
                
                case 'interact':
                    return actionResult.description || `${characterName} interacts with their surroundings.`;
                
                case 'unknown':
                    return actionResult.message || `${characterName} tries to do something, but it doesn't work.`;
                
                default:
                    return this.replaceTokens(this.fallbackTemplates.default, {
                        character: characterName
                    });
            }
        } catch (error) {
            console.error('Fallback narration failed:', error);
            return `${characterName} does something.`;
        }
    }
    
    /**
     * Replaces tokens in template strings
     * @param {string} template - Template string with {token} placeholders
     * @param {Object} tokens - Object with token values
     * @returns {string} String with tokens replaced
     */
    static replaceTokens(template, tokens) {
        let result = template;
        
        for (const [key, value] of Object.entries(tokens)) {
            const regex = new RegExp(`{${key}}`, 'g');
            result = result.replace(regex, value);
        }
        
        return result;
    }
    
    /**
     * Formats skill IDs into readable names
     * @param {string} skillId - Skill ID (snake_case)
     * @returns {string} Formatted skill name
     */
    static formatSkillName(skillId) {
        if (!skillId) return 'Unknown Skill';
        
        return skillId
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    /**
     * Gets system prompt for command parsing
     * @param {Array} availableSkills - Available skills
     * @param {Array} currentEnemies - Current enemies
     * @returns {string} System prompt
     */
    static getParseSystemPrompt(availableSkills, currentEnemies) {
        return `You are a game command parser for a fantasy RPG. Given player input, return JSON:
{
  "intent": "attack/move/use_skill/use_item/interact",
  "target": "enemy_id or position or item_name",
  "skill_suggested": "skill_id",
  "confidence": 0.0-1.0
}

Available skills: ${availableSkills.join(', ')}
Current enemies: ${currentEnemies.join(', ')}

Intent types:
- attack: Player wants to attack an enemy
- move: Player wants to move/reposition
- use_skill: Player wants to use a specific skill or ability
- use_item: Player wants to use an item from inventory
- interact: Player wants to examine, search, or interact with environment

Always suggest the most appropriate skill for the action. Return only valid JSON.`;
    }
    
    /**
     * Gets system prompt for narration generation
     * @param {string} style - Narration style
     * @returns {string} System prompt
     */
    static getNarrationSystemPrompt(style) {
        const styleDescriptions = {
            gritty: "Use dark, gritty language. Focus on blood, pain, and harsh realities of combat.",
            heroic: "Use epic, inspiring language. Make actions feel heroic and triumphant.",
            humorous: "Use light-hearted, comedic language. Make actions amusing and fun.",
            minimal: "Use simple, mechanical language. Focus on facts and results."
        };
        
        return `You are a game narrator for a fantasy RPG. Generate engaging narration for player actions.

Style: ${style} - ${styleDescriptions[style] || styleDescriptions.heroic}

Keep narration to 1-2 sentences. Be descriptive but concise. Focus on the action and its immediate result.
Make the player feel engaged and immersed in the game world.`;
    }
}