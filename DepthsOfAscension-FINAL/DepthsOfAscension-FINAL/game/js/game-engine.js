/**
 * Game Engine - Core game logic and turn processing for Depths of Ascension
 * Orchestrates combat, skill checks, and game state management
 */

class GameEngine {
    static currentGameData = {
        skills: null,
        abilities: null,
        dungeons: null
    };
    
    /**
     * Initializes the game engine by loading content data
     */
    static async initialize() {
        try {
            this.currentGameData.skills = await AirtableClient.getSkills();
            this.currentGameData.abilities = await AirtableClient.getAbilities();
            console.log('Game engine initialized');
        } catch (error) {
            console.error('Failed to initialize game engine:', error);
        }
    }
    
    /**
     * Finds an existing game instance for character or creates a new one
     * @param {number} characterId - Character ID
     * @returns {Promise<Object|null>} Game instance or null
     */
    static async findOrCreateGame(characterId) {
        try {
            // For MVP, always create a new solo game with Goblin Warren
            const gameInstance = await AirtableClient.createGameInstance(
                'goblin_warren',
                [characterId],
                '1min'
            );
            
            if (gameInstance) {
                // Load dungeon data
                const dungeon = await AirtableClient.getDungeon('goblin_warren');
                gameInstance.dungeon = dungeon;
                
                return gameInstance;
            }
            
            return null;
        } catch (error) {
            console.error('Failed to find/create game:', error);
            return null;
        }
    }
    
    /**
     * Submits a command for processing
     * @param {number} instanceId - Game instance ID
     * @param {number} characterId - Character ID
     * @param {string} command - Player command text
     * @returns {Promise<boolean>} Success status
     */
    static async submitCommand(instanceId, characterId, command) {
        try {
            const gameInstance = await AirtableClient.getGameInstance(instanceId);
            if (!gameInstance) {
                return false;
            }
            
            const currentTick = gameInstance.current_tick;
            
            return await AirtableClient.submitCommand(
                instanceId,
                characterId,
                currentTick,
                command
            );
        } catch (error) {
            console.error('Failed to submit command:', error);
            return false;
        }
    }
    
    /**
     * Processes a game tick (turn resolution)
     * @param {number} instanceId - Game instance ID
     * @param {boolean} force - Force process even if not all players submitted
     * @returns {Promise<Object|null>} Tick results or null
     */
    static async processTick(instanceId, force = false) {
        try {
            const gameInstance = await AirtableClient.getGameInstance(instanceId);
            if (!gameInstance) {
                return null;
            }
            
            const currentTick = gameInstance.current_tick;
            const commands = await AirtableClient.getTickCommands(instanceId, currentTick);
            
            // Check if all players have submitted commands (for MVP, just check if we have any)
            if (commands.length === 0 && !force) {
                return null; // Not ready to process
            }
            
            // Process each command
            const results = [];
            for (const command of commands) {
                const result = await this.processCommand(command, gameInstance);
                if (result) {
                    results.push(result);
                }
            }
            
            // Update game state for next tick
            gameInstance.current_tick += 1;
            
            return {
                gameState: gameInstance,
                results
            };
        } catch (error) {
            console.error('Failed to process tick:', error);
            return null;
        }
    }
    
    /**
     * Processes an individual command
     * @param {Object} command - Command object
     * @param {Object} gameInstance - Game instance
     * @returns {Promise<Object|null>} Command result
     */
    static async processCommand(command, gameInstance) {
        try {
            // Get character data
            const character = await AirtableClient.getCharacter(command.character_id);
            if (!character) {
                return null;
            }
            
            // Parse command intent using LLM
            const parsedIntent = await LLMIntegration.parseCommand(
                command.raw_input,
                this.currentGameData.skills,
                [] // Current enemies - TODO: get from room state
            );
            
            let result = null;
            
            // Process based on intent
            switch (parsedIntent.intent) {
                case 'attack':
                    result = await this.processAttackCommand(character, parsedIntent, gameInstance);
                    break;
                case 'move':
                    result = await this.processMoveCommand(character, parsedIntent, gameInstance);
                    break;
                case 'use_skill':
                    result = await this.processSkillCommand(character, parsedIntent, gameInstance);
                    break;
                case 'use_item':
                    result = await this.processItemCommand(character, parsedIntent, gameInstance);
                    break;
                case 'interact':
                    result = await this.processInteractCommand(character, parsedIntent, gameInstance);
                    break;
                default:
                    result = await this.processDefaultCommand(character, command.raw_input);
            }
            
            // Generate narration
            if (result) {
                result.narration = await LLMIntegration.generateNarration(
                    result,
                    'heroic', // Default style for MVP
                    character
                );
            }
            
            return result;
        } catch (error) {
            console.error('Failed to process command:', error);
            return {
                success: false,
                narration: 'Something went wrong processing your action.',
                error: error.message
            };
        }
    }
    
    /**
     * Processes an attack command
     * @param {Object} character - Character object
     * @param {Object} parsedIntent - Parsed command intent
     * @param {Object} gameInstance - Game instance
     * @returns {Promise<Object>} Attack result
     */
    static async processAttackCommand(character, parsedIntent, gameInstance) {
        // For MVP, create a simple goblin enemy
        const goblinEnemy = {
            enemy_id: 'goblin_1',
            enemy_name: 'Goblin',
            current_hp: 10,
            max_hp: 10,
            skills: { swordsmanship: 5, dodge: 3 }
        };
        
        const skillId = parsedIntent.skill_suggested || 'swordsmanship';
        
        // Resolve attack
        const attackResult = CombatSystem.resolveAttack(
            character,
            goblinEnemy,
            skillId
        );
        
        // Process skill progression
        const skillProgress = CombatSystem.processSkillProgression(character, skillId);
        
        // Update character
        if (skillProgress.leveledUp) {
            await AirtableClient.updateCharacter(character.character_id, {
                skills: character.skills
            });
        }
        
        return {
            type: 'attack',
            success: attackResult.hit,
            attackResult,
            skillProgress,
            character: character.character_name,
            target: goblinEnemy.enemy_name,
            skillUsed: skillId
        };
    }
    
    /**
     * Processes a move command
     * @param {Object} character - Character object
     * @param {Object} parsedIntent - Parsed command intent
     * @param {Object} gameInstance - Game instance
     * @returns {Promise<Object>} Move result
     */
    static async processMoveCommand(character, parsedIntent, gameInstance) {
        // Simple movement - just update position
        const newX = Math.max(1, Math.min(18, character.x_position + (Math.random() > 0.5 ? 1 : -1)));
        const newY = Math.max(1, Math.min(8, character.y_position + (Math.random() > 0.5 ? 1 : -1)));
        
        await AirtableClient.updateCharacter(character.character_id, {
            x_position: newX,
            y_position: newY
        });
        
        return {
            type: 'move',
            success: true,
            character: character.character_name,
            oldPosition: { x: character.x_position, y: character.y_position },
            newPosition: { x: newX, y: newY }
        };
    }
    
    /**
     * Processes a skill use command
     * @param {Object} character - Character object
     * @param {Object} parsedIntent - Parsed command intent
     * @param {Object} gameInstance - Game instance
     * @returns {Promise<Object>} Skill result
     */
    static async processSkillCommand(character, parsedIntent, gameInstance) {
        const skillId = parsedIntent.skill_suggested;
        const skillLevel = character.skills[skillId] || 0;
        
        // Standard skill check
        const roll = CombatSystem.rollD20();
        const total = roll + skillLevel;
        const dc = 16; // Standard DC
        const success = total >= dc;
        
        // Process skill progression
        const skillProgress = CombatSystem.processSkillProgression(character, skillId);
        
        // Update character
        if (skillProgress.leveledUp) {
            await AirtableClient.updateCharacter(character.character_id, {
                skills: character.skills
            });
        }
        
        return {
            type: 'skill_check',
            success,
            skillId,
            roll,
            total,
            dc,
            skillProgress,
            character: character.character_name
        };
    }
    
    /**
     * Processes an item use command
     * @param {Object} character - Character object
     * @param {Object} parsedIntent - Parsed command intent
     * @param {Object} gameInstance - Game instance
     * @returns {Promise<Object>} Item use result
     */
    static async processItemCommand(character, parsedIntent, gameInstance) {
        // For MVP, handle health potion
        if (character.inventory.includes('health_potion')) {
            const healingResult = CombatSystem.applyHealing(character, 15);
            
            // Remove potion from inventory
            const newInventory = character.inventory.filter(item => item !== 'health_potion');
            
            await AirtableClient.updateCharacter(character.character_id, {
                current_hp: character.current_hp,
                inventory: newInventory
            });
            
            return {
                type: 'item_use',
                success: true,
                item: 'Health Potion',
                healingResult,
                character: character.character_name
            };
        }
        
        return {
            type: 'item_use',
            success: false,
            error: 'Item not found or cannot be used',
            character: character.character_name
        };
    }
    
    /**
     * Processes an interact command
     * @param {Object} character - Character object
     * @param {Object} parsedIntent - Parsed command intent
     * @param {Object} gameInstance - Game instance
     * @returns {Promise<Object>} Interaction result
     */
    static async processInteractCommand(character, parsedIntent, gameInstance) {
        // Basic interaction - could be with environment or NPCs
        return {
            type: 'interact',
            success: true,
            character: character.character_name,
            description: 'You examine your surroundings carefully.'
        };
    }
    
    /**
     * Processes a default/unknown command
     * @param {Object} character - Character object
     * @param {string} rawInput - Raw command text
     * @returns {Promise<Object>} Default result
     */
    static async processDefaultCommand(character, rawInput) {
        return {
            type: 'unknown',
            success: false,
            character: character.character_name,
            command: rawInput,
            message: 'I don\'t understand that command. Try "attack", "move", "use item", or "defend".'
        };
    }
    
    /**
     * Gets the current room for a game instance
     * @param {number} instanceId - Game instance ID
     * @returns {Promise<Object|null>} Room data or null
     */
    static async getCurrentRoom(instanceId) {
        try {
            const gameInstance = await AirtableClient.getGameInstance(instanceId);
            if (!gameInstance) {
                return null;
            }
            
            const dungeon = await AirtableClient.getDungeon(gameInstance.dungeon_id);
            if (!dungeon || !dungeon.room_sequence) {
                return null;
            }
            
            const currentRoomIndex = gameInstance.current_room_index || 0;
            const roomId = dungeon.room_sequence[currentRoomIndex];
            
            if (!roomId) {
                return null;
            }
            
            return await AirtableClient.getRoom(roomId);
        } catch (error) {
            console.error('Failed to get current room:', error);
            return null;
        }
    }
    
    /**
     * Checks if a character meets ability requirements
     * @param {Object} character - Character object
     * @param {string} abilityId - Ability ID to check
     * @returns {boolean} Whether character can use ability
     */
    static checkAbilityRequirements(character, abilityId) {
        const ability = this.currentGameData.abilities?.find(a => a.ability_id === abilityId);
        if (!ability) {
            return false;
        }
        
        const check = CombatSystem.checkAbilityRequirements(character, ability.requirements);
        return check.meetsRequirements && character.current_energy >= ability.energy_cost;
    }
    
    /**
     * Gets available abilities for a character
     * @param {Object} character - Character object
     * @returns {Array} Array of available abilities
     */
    static getAvailableAbilities(character) {
        if (!this.currentGameData.abilities) {
            return [];
        }
        
        return this.currentGameData.abilities.filter(ability => {
            return this.checkAbilityRequirements(character, ability.ability_id);
        });
    }
    
    /**
     * Advances to the next room in the dungeon
     * @param {number} instanceId - Game instance ID
     * @returns {Promise<boolean>} Success status
     */
    static async advanceToNextRoom(instanceId) {
        try {
            const gameInstance = await AirtableClient.getGameInstance(instanceId);
            if (!gameInstance) {
                return false;
            }
            
            const dungeon = await AirtableClient.getDungeon(gameInstance.dungeon_id);
            if (!dungeon) {
                return false;
            }
            
            const nextRoomIndex = gameInstance.current_room_index + 1;
            
            if (nextRoomIndex >= dungeon.room_sequence.length) {
                // Dungeon completed
                gameInstance.game_state = 'completed';
            } else {
                gameInstance.current_room_index = nextRoomIndex;
            }
            
            // Update game instance in database
            // Note: This would need the record ID, which we'd need to track
            
            return true;
        } catch (error) {
            console.error('Failed to advance room:', error);
            return false;
        }
    }
    
    /**
     * Checks if all enemies in current room are defeated
     * @param {Object} roomState - Current room state
     * @returns {boolean} All enemies defeated
     */
    static areAllEnemiesDefeated(roomState) {
        if (!roomState.enemies) {
            return true;
        }
        
        return roomState.enemies.every(enemy => enemy.current_hp <= 0);
    }
    
    /**
     * Processes end of combat rewards
     * @param {Array} characters - Characters that participated
     * @param {Array} defeatedEnemies - Enemies that were defeated
     * @returns {Object} Rewards data
     */
    static processRewards(characters, defeatedEnemies) {
        let totalXP = 0;
        const loot = [];
        
        defeatedEnemies.forEach(enemy => {
            totalXP += enemy.xp_value || 0;
            // Process loot drops based on enemy loot table
        });
        
        return {
            xp: totalXP,
            loot
        };
    }
}