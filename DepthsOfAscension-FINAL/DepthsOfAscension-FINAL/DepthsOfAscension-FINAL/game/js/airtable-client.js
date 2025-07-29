/**
 * Airtable Client - Handles all database operations for Depths of Ascension
 * Provides abstraction layer over Airtable API through serverless proxy
 */

class AirtableClient {
    static BASE_URL = '/api/airtable-proxy';
    static BASE_ID = 'appsdsxbD0IS9WAqe';
    
    /**
     * Makes a request to the Airtable proxy
     * @param {string} action - create|read|update|delete
     * @param {string} table - Table name
     * @param {Object} data - Request data
     * @returns {Promise<Object>} Response data
     */
    static async makeRequest(action, table, data = {}) {
        try {
            const response = await fetch(this.BASE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action,
                    table,
                    data,
                    baseId: this.BASE_ID
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Airtable request failed:', error);
            throw error;
        }
    }
    
    // Player Management
    
    /**
     * Authenticates a player with username and password
     * @param {string} username - Player username
     * @param {string} password - Player password
     * @returns {Promise<Object|null>} Player data or null if invalid
     */
    static async authenticatePlayer(username, password) {
        try {
            const result = await this.makeRequest('read', 'players', {
                filterByFormula: `{username} = '${username}'`
            });
            
            if (result.records && result.records.length > 0) {
                const player = result.records[0];
                // In a real implementation, you'd verify the password hash
                // For MVP, we'll do simple comparison (NOT SECURE)
                if (player.fields.password_hash === password) {
                    // Update last login
                    await this.makeRequest('update', 'players', {
                        id: player.id,
                        fields: {
                            last_login: new Date().toISOString()
                        }
                    });
                    
                    return {
                        player_id: player.fields.player_id,
                        username: player.fields.username,
                        total_reputation: player.fields.total_reputation || 0
                    };
                }
            }
            
            return null;
        } catch (error) {
            console.error('Authentication failed:', error);
            return null;
        }
    }
    
    /**
     * Creates a new player account
     * @param {string} username - Desired username
     * @param {string} password - Player password
     * @returns {Promise<Object|null>} Player data or null if username exists
     */
    static async createPlayer(username, password) {
        try {
            // Check if username exists
            const existing = await this.makeRequest('read', 'players', {
                filterByFormula: `{username} = '${username}'`
            });
            
            if (existing.records && existing.records.length > 0) {
                return null; // Username already exists
            }
            
            // Create new player
            const result = await this.makeRequest('create', 'players', {
                fields: {
                    username,
                    password_hash: password, // In production, hash this!
                    total_reputation: 0
                }
            });
            
            if (result.records && result.records.length > 0) {
                const player = result.records[0];
                return {
                    player_id: player.fields.player_id,
                    username: player.fields.username,
                    total_reputation: 0
                };
            }
            
            return null;
        } catch (error) {
            console.error('Player creation failed:', error);
            return null;
        }
    }
    
    // Character Management
    
    /**
     * Gets all characters for a player
     * @param {number} playerId - Player ID
     * @returns {Promise<Array>} Array of character objects
     */
    static async getPlayerCharacters(playerId) {
        try {
            const result = await this.makeRequest('read', 'characters', {
                filterByFormula: `{player_id} = ${playerId}`
            });
            
            return result.records ? result.records.map(record => ({
                character_id: record.fields.character_id,
                character_name: record.fields.character_name,
                total_level: record.fields.total_level || 0,
                current_hp: record.fields.current_hp,
                max_hp: record.fields.max_hp,
                current_energy: record.fields.current_energy,
                max_energy: record.fields.max_energy,
                status: record.fields.status || 'active',
                skills: JSON.parse(record.fields.skills || '{}'),
                abilities: JSON.parse(record.fields.abilities || '[]'),
                equipment: JSON.parse(record.fields.equipment || '{}'),
                inventory: JSON.parse(record.fields.inventory || '[]')
            })) : [];
        } catch (error) {
            console.error('Failed to get player characters:', error);
            return [];
        }
    }
    
    /**
     * Creates a new character
     * @param {number} playerId - Player ID
     * @param {string} characterName - Character name
     * @returns {Promise<Object|null>} Character data or null if failed
     */
    static async createCharacter(playerId, characterName) {
        try {
            // Initialize starting skills (all at level 0)
            const startingSkills = {
                // Combat
                'swordsmanship': 0,
                'archery': 0,
                'axe_fighting': 0,
                'unarmed_combat': 0,
                'dual_wielding': 0,
                // Magic
                'fire_magic': 0,
                'ice_magic': 0,
                'lightning_magic': 0,
                'healing_magic': 0,
                'arcane_magic': 0,
                // Defensive
                'shield_use': 0,
                'dodge': 0,
                'armor_training': 0,
                'parry': 0,
                // Utility
                'lockpicking': 0,
                'first_aid': 0,
                'trap_disarm': 0,
                'stealth': 0,
                // Exploration
                'perception': 0,
                'trap_detection': 0,
                'navigation': 0,
                'climbing': 0,
                // Crafting
                'weaponsmithing': 0,
                'alchemy': 0,
                'armorsmithing': 0,
                'enchanting': 0,
                // Harvesting
                'mining': 0,
                'herbalism': 0,
                'skinning': 0,
                // Refining
                'smelting': 0,
                'herb_processing': 0,
                'gem_cutting': 0
            };
            
            // Starting equipment
            const startingEquipment = {
                'main_hand': 'rusty_sword',
                'chest': 'cloth_armor'
            };
            
            // Starting inventory
            const startingInventory = ['health_potion'];
            
            // Starting abilities
            const startingAbilities = ['basic_attack', 'defend', 'move'];
            
            const result = await this.makeRequest('create', 'characters', {
                fields: {
                    player_id: [playerId], // Airtable link field
                    character_name: characterName,
                    current_hp: 20,
                    max_hp: 20,
                    current_energy: 10,
                    max_energy: 10,
                    skills: JSON.stringify(startingSkills),
                    abilities: JSON.stringify(startingAbilities),
                    equipment: JSON.stringify(startingEquipment),
                    inventory: JSON.stringify(startingInventory),
                    x_position: 10,
                    y_position: 5,
                    status: 'active'
                }
            });
            
            if (result.records && result.records.length > 0) {
                const character = result.records[0];
                return {
                    character_id: character.fields.character_id,
                    character_name: character.fields.character_name,
                    total_level: 0,
                    current_hp: 20,
                    max_hp: 20,
                    current_energy: 10,
                    max_energy: 10,
                    status: 'active',
                    skills: startingSkills,
                    abilities: startingAbilities,
                    equipment: startingEquipment,
                    inventory: startingInventory
                };
            }
            
            return null;
        } catch (error) {
            console.error('Character creation failed:', error);
            return null;
        }
    }
    
    /**
     * Gets a single character by ID
     * @param {number} characterId - Character ID
     * @returns {Promise<Object|null>} Character data or null
     */
    static async getCharacter(characterId) {
        try {
            const result = await this.makeRequest('read', 'characters', {
                filterByFormula: `{character_id} = ${characterId}`
            });
            
            if (result.records && result.records.length > 0) {
                const record = result.records[0];
                return {
                    character_id: record.fields.character_id,
                    character_name: record.fields.character_name,
                    total_level: record.fields.total_level || 0,
                    current_hp: record.fields.current_hp,
                    max_hp: record.fields.max_hp,
                    current_energy: record.fields.current_energy,
                    max_energy: record.fields.max_energy,
                    status: record.fields.status || 'active',
                    skills: JSON.parse(record.fields.skills || '{}'),
                    abilities: JSON.parse(record.fields.abilities || '[]'),
                    equipment: JSON.parse(record.fields.equipment || '{}'),
                    inventory: JSON.parse(record.fields.inventory || '[]'),
                    x_position: record.fields.x_position,
                    y_position: record.fields.y_position
                };
            }
            
            return null;
        } catch (error) {
            console.error('Failed to get character:', error);
            return null;
        }
    }
    
    /**
     * Updates a character's data
     * @param {number} characterId - Character ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<boolean>} Success status
     */
    static async updateCharacter(characterId, updates) {
        try {
            // Get the record ID first
            const existing = await this.makeRequest('read', 'characters', {
                filterByFormula: `{character_id} = ${characterId}`
            });
            
            if (!existing.records || existing.records.length === 0) {
                return false;
            }
            
            const recordId = existing.records[0].id;
            
            // Convert complex fields to JSON strings
            const processedUpdates = { ...updates };
            if (processedUpdates.skills) {
                processedUpdates.skills = JSON.stringify(processedUpdates.skills);
            }
            if (processedUpdates.abilities) {
                processedUpdates.abilities = JSON.stringify(processedUpdates.abilities);
            }
            if (processedUpdates.equipment) {
                processedUpdates.equipment = JSON.stringify(processedUpdates.equipment);
            }
            if (processedUpdates.inventory) {
                processedUpdates.inventory = JSON.stringify(processedUpdates.inventory);
            }
            
            await this.makeRequest('update', 'characters', {
                id: recordId,
                fields: processedUpdates
            });
            
            return true;
        } catch (error) {
            console.error('Character update failed:', error);
            return false;
        }
    }
    
    // Game Instance Management
    
    /**
     * Creates a new game instance
     * @param {string} dungeonId - Dungeon ID
     * @param {Array} characterIds - Array of character IDs
     * @param {string} tickInterval - Tick interval (1min/1hour/1day)
     * @returns {Promise<Object|null>} Game instance or null
     */
    static async createGameInstance(dungeonId, characterIds, tickInterval = '1min') {
        try {
            const result = await this.makeRequest('create', 'game_instances', {
                fields: {
                    dungeon_id: [dungeonId], // Link field
                    characters: characterIds, // Multiple links
                    tick_interval: tickInterval,
                    current_room_index: 0,
                    game_state: 'active',
                    current_tick: 1,
                    room_states: JSON.stringify([])
                }
            });
            
            if (result.records && result.records.length > 0) {
                const instance = result.records[0];
                return {
                    instance_id: instance.fields.instance_id,
                    dungeon_id: dungeonId,
                    characters: characterIds,
                    tick_interval: tickInterval,
                    current_room_index: 0,
                    game_state: 'active',
                    current_tick: 1
                };
            }
            
            return null;
        } catch (error) {
            console.error('Game instance creation failed:', error);
            return null;
        }
    }
    
    /**
     * Gets a game instance by ID
     * @param {number} instanceId - Instance ID
     * @returns {Promise<Object|null>} Game instance or null
     */
    static async getGameInstance(instanceId) {
        try {
            const result = await this.makeRequest('read', 'game_instances', {
                filterByFormula: `{instance_id} = ${instanceId}`
            });
            
            if (result.records && result.records.length > 0) {
                const record = result.records[0];
                return {
                    instance_id: record.fields.instance_id,
                    dungeon_id: record.fields.dungeon_id,
                    characters: record.fields.characters || [],
                    tick_interval: record.fields.tick_interval,
                    current_room_index: record.fields.current_room_index || 0,
                    game_state: record.fields.game_state,
                    current_tick: record.fields.current_tick || 1,
                    room_states: JSON.parse(record.fields.room_states || '[]')
                };
            }
            
            return null;
        } catch (error) {
            console.error('Failed to get game instance:', error);
            return null;
        }
    }
    
    // Command Management
    
    /**
     * Submits a command for a character
     * @param {number} instanceId - Game instance ID
     * @param {number} characterId - Character ID
     * @param {number} tickNumber - Current tick number
     * @param {string} rawInput - Player's command text
     * @returns {Promise<boolean>} Success status
     */
    static async submitCommand(instanceId, characterId, tickNumber, rawInput) {
        try {
            const result = await this.makeRequest('create', 'commands', {
                fields: {
                    instance_id: [instanceId],
                    character_id: [characterId],
                    tick_number: tickNumber,
                    raw_input: rawInput,
                    parsed_intent: '',
                    roll_result: 0,
                    modifiers: JSON.stringify({}),
                    success: false,
                    damage_dealt: 0,
                    narration: ''
                }
            });
            
            return result.records && result.records.length > 0;
        } catch (error) {
            console.error('Command submission failed:', error);
            return false;
        }
    }
    
    /**
     * Gets all commands for a specific tick
     * @param {number} instanceId - Game instance ID
     * @param {number} tickNumber - Tick number
     * @returns {Promise<Array>} Array of command objects
     */
    static async getTickCommands(instanceId, tickNumber) {
        try {
            const result = await this.makeRequest('read', 'commands', {
                filterByFormula: `AND({instance_id} = ${instanceId}, {tick_number} = ${tickNumber})`
            });
            
            return result.records ? result.records.map(record => ({
                command_id: record.fields.command_id,
                character_id: record.fields.character_id,
                raw_input: record.fields.raw_input,
                parsed_intent: record.fields.parsed_intent,
                matched_skill: record.fields.matched_skill,
                roll_result: record.fields.roll_result,
                modifiers: JSON.parse(record.fields.modifiers || '{}'),
                success: record.fields.success,
                damage_dealt: record.fields.damage_dealt,
                narration: record.fields.narration
            })) : [];
        } catch (error) {
            console.error('Failed to get tick commands:', error);
            return [];
        }
    }
    
    // Content Data
    
    /**
     * Gets all skills
     * @returns {Promise<Array>} Array of skill objects
     */
    static async getSkills() {
        try {
            const result = await this.makeRequest('read', 'skills');
            
            return result.records ? result.records.map(record => ({
                skill_id: record.fields.skill_id,
                skill_name: record.fields.skill_name,
                category: record.fields.category,
                description: record.fields.description,
                reaction_eligible: record.fields.reaction_eligible
            })) : [];
        } catch (error) {
            console.error('Failed to get skills:', error);
            return [];
        }
    }
    
    /**
     * Gets all abilities
     * @returns {Promise<Array>} Array of ability objects
     */
    static async getAbilities() {
        try {
            const result = await this.makeRequest('read', 'abilities');
            
            return result.records ? result.records.map(record => ({
                ability_id: record.fields.ability_id,
                ability_name: record.fields.ability_name,
                description: record.fields.description,
                requirements: JSON.parse(record.fields.requirements || '{}'),
                energy_cost: record.fields.energy_cost || 0,
                effect_formula: record.fields.effect_formula,
                cooldown_turns: record.fields.cooldown_turns || 0,
                is_reaction: record.fields.is_reaction,
                bonus_per_requirement: record.fields.bonus_per_requirement || 0
            })) : [];
        } catch (error) {
            console.error('Failed to get abilities:', error);
            return [];
        }
    }
    
    /**
     * Gets dungeon by ID
     * @param {string} dungeonId - Dungeon ID
     * @returns {Promise<Object|null>} Dungeon data or null
     */
    static async getDungeon(dungeonId) {
        try {
            const result = await this.makeRequest('read', 'dungeons', {
                filterByFormula: `{dungeon_id} = '${dungeonId}'`
            });
            
            if (result.records && result.records.length > 0) {
                const record = result.records[0];
                return {
                    dungeon_id: record.fields.dungeon_id,
                    dungeon_name: record.fields.dungeon_name,
                    description: record.fields.description,
                    difficulty_tier: record.fields.difficulty_tier,
                    room_sequence: JSON.parse(record.fields.room_sequence || '[]'),
                    narration_style: record.fields.narration_style
                };
            }
            
            return null;
        } catch (error) {
            console.error('Failed to get dungeon:', error);
            return null;
        }
    }
    
    /**
     * Gets room by ID
     * @param {string} roomId - Room ID
     * @returns {Promise<Object|null>} Room data or null
     */
    static async getRoom(roomId) {
        try {
            const result = await this.makeRequest('read', 'rooms', {
                filterByFormula: `{room_id} = '${roomId}'`
            });
            
            if (result.records && result.records.length > 0) {
                const record = result.records[0];
                return {
                    room_id: record.fields.room_id,
                    room_name: record.fields.room_name,
                    description: record.fields.description,
                    room_type: record.fields.room_type,
                    width: record.fields.width || 20,
                    height: record.fields.height || 10,
                    ascii_layout: record.fields.ascii_layout,
                    enemies: record.fields.enemies || [],
                    treasure: record.fields.treasure,
                    event_pool: record.fields.event_pool || []
                };
            }
            
            return null;
        } catch (error) {
            console.error('Failed to get room:', error);
            return null;
        }
    }
}