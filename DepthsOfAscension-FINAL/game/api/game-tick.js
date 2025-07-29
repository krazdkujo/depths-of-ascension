/**
 * Game Tick - Serverless function to process game turns
 * Handles turn resolution and game state updates
 */

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { instance_id, force = false } = req.body;
        
        if (!instance_id) {
            return res.status(400).json({ error: 'Missing instance_id parameter' });
        }
        
        // Process the game tick
        const result = await processGameTick(instance_id, force);
        
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
        
    } catch (error) {
        console.error('Game tick error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

/**
 * Processes a game tick for the given instance
 * @param {number} instanceId - Game instance ID
 * @param {boolean} force - Force processing even if not all players submitted
 * @returns {Object} Processing result
 */
async function processGameTick(instanceId, force) {
    try {
        // Get game instance
        const gameInstance = await getGameInstance(instanceId);
        if (!gameInstance) {
            return { success: false, error: 'Game instance not found' };
        }
        
        // Check if game is active
        if (gameInstance.game_state !== 'active') {
            return { success: false, error: 'Game is not active' };
        }
        
        const currentTick = gameInstance.current_tick;
        
        // Get all commands for this tick
        const commands = await getTickCommands(instanceId, currentTick);
        
        // Check if we should process (all players submitted or force)
        const expectedPlayers = gameInstance.characters.length;
        if (commands.length < expectedPlayers && !force) {
            return { 
                success: false, 
                error: 'Waiting for more players',
                submitted: commands.length,
                expected: expectedPlayers
            };
        }
        
        // Process each command
        const results = [];
        for (const command of commands) {
            try {
                const result = await processCommand(command, gameInstance);
                if (result) {
                    results.push(result);
                    
                    // Update command with results
                    await updateCommand(command.command_id, result);
                }
            } catch (error) {
                console.error(`Error processing command ${command.command_id}:`, error);
                results.push({
                    character_id: command.character_id,
                    success: false,
                    narration: 'Something went wrong processing your action.',
                    error: error.message
                });
            }
        }
        
        // Update game instance for next tick
        const nextTick = currentTick + 1;
        await updateGameInstance(instanceId, {
            current_tick: nextTick,
            last_activity: new Date().toISOString()
        });
        
        // Check for room completion conditions
        const roomStatus = await checkRoomCompletion(gameInstance, results);
        
        return {
            success: true,
            instance_id: instanceId,
            tick: currentTick,
            results,
            next_tick: nextTick,
            room_status: roomStatus
        };
        
    } catch (error) {
        console.error('Game tick processing error:', error);
        return {
            success: false,
            error: 'Failed to process game tick',
            details: error.message
        };
    }
}

/**
 * Processes an individual command
 * @param {Object} command - Command to process
 * @param {Object} gameInstance - Game instance
 * @returns {Object} Command result
 */
async function processCommand(command, gameInstance) {
    // Get character data
    const character = await getCharacter(command.character_id);
    if (!character) {
        throw new Error('Character not found');
    }
    
    // Parse command using simple fallback (since we can't easily call LLM here)
    const parsedIntent = parseCommandFallback(command.raw_input);
    
    let result = null;
    
    // Process based on intent
    switch (parsedIntent.intent) {
        case 'attack':
            result = await processAttackCommand(character, parsedIntent, gameInstance);
            break;
        case 'move':
            result = await processMoveCommand(character, parsedIntent, gameInstance);
            break;
        case 'use_skill':
            result = await processSkillCommand(character, parsedIntent, gameInstance);
            break;
        case 'use_item':
            result = await processItemCommand(character, parsedIntent, gameInstance);
            break;
        case 'interact':
            result = await processInteractCommand(character, parsedIntent, gameInstance);
            break;
        default:
            result = {
                type: 'unknown',
                success: false,
                character: character.character_name,
                command: command.raw_input,
                message: 'I don\'t understand that command. Try "attack", "move", "use item", or "defend".'
            };
    }
    
    // Add character ID to result
    result.character_id = character.character_id;
    
    return result;
}

/**
 * Simple fallback command parser
 * @param {string} input - Command input
 * @returns {Object} Parsed intent
 */
function parseCommandFallback(input) {
    const lowercaseInput = input.toLowerCase().trim();
    const words = lowercaseInput.split(/\s+/);
    
    // Attack patterns
    if (words.some(w => ['attack', 'hit', 'strike', 'fight', 'kill'].includes(w))) {
        return {
            intent: 'attack',
            target: 'goblin', // Default target for MVP
            skill_suggested: 'swordsmanship',
            confidence: 0.8
        };
    }
    
    // Move patterns
    if (words.some(w => ['move', 'go', 'walk', 'run', 'step'].includes(w))) {
        return {
            intent: 'move',
            target: null,
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
        return {
            intent: 'use_item',
            target: 'health_potion',
            skill_suggested: null,
            confidence: 0.7
        };
    }
    
    // Default
    return {
        intent: 'unknown',
        target: null,
        skill_suggested: null,
        confidence: 0.1
    };
}

/**
 * Processes an attack command
 * @param {Object} character - Character object
 * @param {Object} parsedIntent - Parsed intent
 * @param {Object} gameInstance - Game instance
 * @returns {Object} Attack result
 */
async function processAttackCommand(character, parsedIntent, gameInstance) {
    // Create a simple goblin enemy for MVP
    const goblinEnemy = {
        enemy_id: 'goblin_1',
        enemy_name: 'Goblin',
        current_hp: 10,
        max_hp: 10,
        skills: { swordsmanship: 5, dodge: 3 }
    };
    
    const skillId = parsedIntent.skill_suggested || 'swordsmanship';
    const skillLevel = character.skills[skillId] || 0;
    
    // Simple attack resolution
    const attackRoll = rollD20() + skillLevel;
    const defenseRoll = rollD20() + (goblinEnemy.skills.dodge || 0);
    
    const hit = attackRoll >= defenseRoll;
    let damage = 0;
    
    if (hit) {
        damage = Math.max(1, Math.floor(skillLevel / 5) + 1); // Base damage calculation
        if (attackRoll - skillLevel === 20) {
            damage *= 2; // Critical hit
        }
    }
    
    // Process skill progression
    const progressChance = 100 / (skillLevel + 10);
    const leveledUp = Math.random() * 100 < progressChance;
    
    if (leveledUp) {
        character.skills[skillId] = Math.min(skillLevel + 1, 100);
        await updateCharacter(character.character_id, { skills: character.skills });
    }
    
    return {
        type: 'attack',
        success: hit,
        character: character.character_name,
        target: goblinEnemy.enemy_name,
        skillUsed: skillId,
        roll: attackRoll - skillLevel,
        total: attackRoll,
        defenseRoll,
        damage,
        critical: attackRoll - skillLevel === 20,
        skillProgress: {
            leveledUp,
            newLevel: character.skills[skillId],
            oldLevel: skillLevel
        },
        narration: hit ? 
            `${character.character_name} strikes the goblin for ${damage} damage!` :
            `${character.character_name} swings at the goblin but misses!`
    };
}

/**
 * Processes a move command
 * @param {Object} character - Character object
 * @param {Object} parsedIntent - Parsed intent
 * @param {Object} gameInstance - Game instance
 * @returns {Object} Move result
 */
async function processMoveCommand(character, parsedIntent, gameInstance) {
    // Simple movement
    const newX = Math.max(1, Math.min(18, character.x_position + (Math.random() > 0.5 ? 1 : -1)));
    const newY = Math.max(1, Math.min(8, character.y_position + (Math.random() > 0.5 ? 1 : -1)));
    
    await updateCharacter(character.character_id, {
        x_position: newX,
        y_position: newY
    });
    
    return {
        type: 'move',
        success: true,
        character: character.character_name,
        narration: `${character.character_name} moves to a new position.`
    };
}

/**
 * Processes a skill command
 * @param {Object} character - Character object
 * @param {Object} parsedIntent - Parsed intent
 * @param {Object} gameInstance - Game instance
 * @returns {Object} Skill result
 */
async function processSkillCommand(character, parsedIntent, gameInstance) {
    const skillId = parsedIntent.skill_suggested || 'perception';
    const skillLevel = character.skills[skillId] || 0;
    
    const roll = rollD20();
    const total = roll + skillLevel;
    const dc = 16;
    const success = total >= dc;
    
    // Process skill progression
    const progressChance = 100 / (skillLevel + 10);
    const leveledUp = Math.random() * 100 < progressChance;
    
    if (leveledUp) {
        character.skills[skillId] = Math.min(skillLevel + 1, 100);
        await updateCharacter(character.character_id, { skills: character.skills });
    }
    
    return {
        type: 'skill_check',
        success,
        character: character.character_name,
        skillId,
        roll,
        total,
        dc,
        skillProgress: {
            leveledUp,
            newLevel: character.skills[skillId],
            oldLevel: skillLevel
        },
        narration: success ?
            `${character.character_name} successfully uses ${formatSkillName(skillId)}!` :
            `${character.character_name} attempts to use ${formatSkillName(skillId)} but fails.`
    };
}

/**
 * Processes an item use command
 * @param {Object} character - Character object
 * @param {Object} parsedIntent - Parsed intent
 * @param {Object} gameInstance - Game instance
 * @returns {Object} Item use result
 */
async function processItemCommand(character, parsedIntent, gameInstance) {
    if (character.inventory.includes('health_potion')) {
        const healing = 15;
        const newHP = Math.min(character.max_hp, character.current_hp + healing);
        const actualHealing = newHP - character.current_hp;
        
        // Remove potion and update HP
        const newInventory = character.inventory.filter(item => item !== 'health_potion');
        
        await updateCharacter(character.character_id, {
            current_hp: newHP,
            inventory: newInventory
        });
        
        return {
            type: 'item_use',
            success: true,
            character: character.character_name,
            item: 'Health Potion',
            healing: actualHealing,
            narration: `${character.character_name} drinks a health potion and recovers ${actualHealing} HP.`
        };
    }
    
    return {
        type: 'item_use',
        success: false,
        character: character.character_name,
        narration: `${character.character_name} doesn't have any usable items.`
    };
}

/**
 * Processes an interact command
 * @param {Object} character - Character object
 * @param {Object} parsedIntent - Parsed intent
 * @param {Object} gameInstance - Game instance
 * @returns {Object} Interact result
 */
async function processInteractCommand(character, parsedIntent, gameInstance) {
    return {
        type: 'interact',
        success: true,
        character: character.character_name,
        narration: `${character.character_name} examines the surroundings carefully.`
    };
}

// Helper functions for database operations
// These would need to be implemented to call the airtable-proxy

async function getGameInstance(instanceId) {
    // Implementation would call airtable-proxy
    // For now, return mock data
    return {
        instance_id: instanceId,
        current_tick: 1,
        game_state: 'active',
        characters: [1] // Mock character IDs
    };
}

async function getTickCommands(instanceId, tickNumber) {
    // Implementation would call airtable-proxy
    return [];
}

async function getCharacter(characterId) {
    // Implementation would call airtable-proxy
    return {
        character_id: characterId,
        character_name: 'Hero',
        current_hp: 20,
        max_hp: 20,
        skills: { swordsmanship: 5, dodge: 3 },
        inventory: ['health_potion'],
        x_position: 10,
        y_position: 5
    };
}

async function updateCharacter(characterId, updates) {
    // Implementation would call airtable-proxy
    return true;
}

async function updateCommand(commandId, result) {
    // Implementation would call airtable-proxy
    return true;
}

async function updateGameInstance(instanceId, updates) {
    // Implementation would call airtable-proxy
    return true;
}

async function checkRoomCompletion(gameInstance, results) {
    // Check if room objectives are completed
    return {
        completed: false,
        advance: false,
        reason: 'Combat ongoing'
    };
}

// Utility functions

function rollD20() {
    return Math.floor(Math.random() * 20) + 1;
}

function formatSkillName(skillId) {
    return skillId
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}