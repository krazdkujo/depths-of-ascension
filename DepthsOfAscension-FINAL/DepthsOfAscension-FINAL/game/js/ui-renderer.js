/**
 * UI Renderer - Handles ASCII display and UI updates for Depths of Ascension
 * Renders rooms, character stats, and manages responsive display
 */

class UIRenderer {
    static DEFAULT_ROOM_WIDTH = 20;
    static DEFAULT_ROOM_HEIGHT = 10;
    
    /**
     * Displays a room with ASCII art
     * @param {Object} room - Room data object
     * @param {Object} gameState - Current game state
     */
    static displayRoom(room, gameState) {
        try {
            const asciiElement = document.getElementById('roomAscii');
            if (!asciiElement) {
                console.error('Room ASCII element not found');
                return;
            }
            
            let roomDisplay = '';
            
            // Room header
            roomDisplay += `╔════════════════════════════════════╗\n`;
            roomDisplay += `║ ${room.room_name.padEnd(34)} ║\n`;
            roomDisplay += `╠════════════════════════════════════╣\n`;
            
            // Generate room layout
            const layout = this.generateRoomLayout(room, gameState);
            layout.forEach(line => {
                roomDisplay += `║ ${line.padEnd(34)} ║\n`;
            });
            
            roomDisplay += `╚════════════════════════════════════╝`;
            
            asciiElement.textContent = roomDisplay;
            
            // Update room description
            this.updateRoomDescription(room);
        } catch (error) {
            console.error('Failed to display room:', error);
            document.getElementById('roomAscii').textContent = 'Error loading room display';
        }
    }
    
    /**
     * Generates the ASCII layout for a room
     * @param {Object} room - Room data
     * @param {Object} gameState - Game state
     * @returns {Array} Array of strings representing room lines
     */
    static generateRoomLayout(room, gameState) {
        const width = room.width || this.DEFAULT_ROOM_WIDTH;
        const height = room.height || this.DEFAULT_ROOM_HEIGHT;
        
        // Initialize empty room
        const layout = [];
        for (let y = 0; y < height; y++) {
            const line = new Array(width).fill('.');
            layout.push(line);
        }
        
        // Add walls
        for (let x = 0; x < width; x++) {
            layout[0][x] = '#';
            layout[height - 1][x] = '#';
        }
        for (let y = 0; y < height; y++) {
            layout[y][0] = '#';
            layout[y][width - 1] = '#';
        }
        
        // Add door (always at bottom center for MVP)
        const doorX = Math.floor(width / 2);
        layout[height - 1][doorX] = 'D';
        
        // Add characters
        if (gameState && gameState.characters) {
            // For MVP, place player character at a default position
            const playerX = Math.floor(width / 2);
            const playerY = Math.floor(height / 2);
            layout[playerY][playerX] = '@';
        }
        
        // Add enemies based on room type
        if (room.room_type === 'combat' || room.room_type === 'boss') {
            this.addEnemiesToLayout(layout, room, width, height);
        }
        
        // Add treasure
        if (room.room_type === 'treasure' || room.treasure) {
            const treasureX = Math.floor(width * 0.75);
            const treasureY = Math.floor(height * 0.3);
            if (layout[treasureY][treasureX] === '.') {
                layout[treasureY][treasureX] = '$';
            }
        }
        
        // Add events/NPCs
        if (room.room_type === 'event' && room.event_pool && room.event_pool.length > 0) {
            const eventX = Math.floor(width * 0.25);
            const eventY = Math.floor(height * 0.7);
            if (layout[eventY][eventX] === '.') {
                layout[eventY][eventX] = '?';
            }
        }
        
        // Add traps (if detected)
        if (room.room_type === 'trap') {
            const trapX = Math.floor(width * 0.6);
            const trapY = Math.floor(height * 0.4);
            if (layout[trapY][trapX] === '.') {
                layout[trapY][trapX] = '!';
            }
        }
        
        // Convert to strings
        return layout.map(line => line.join(''));
    }
    
    /**
     * Adds enemies to the room layout
     * @param {Array} layout - 2D array representing the room
     * @param {Object} room - Room data
     * @param {number} width - Room width
     * @param {number} height - Room height
     */
    static addEnemiesToLayout(layout, room, width, height) {
        const enemyPositions = [
            { x: Math.floor(width * 0.3), y: Math.floor(height * 0.3) },
            { x: Math.floor(width * 0.7), y: Math.floor(height * 0.6) },
            { x: Math.floor(width * 0.5), y: Math.floor(height * 0.2) }
        ];
        
        const enemySymbols = ['g', 's', 'w']; // Goblin, Skeleton, Wolf
        
        enemyPositions.forEach((pos, index) => {
            if (pos.y < height && pos.x < width && layout[pos.y][pos.x] === '.') {
                layout[pos.y][pos.x] = enemySymbols[index] || 'e';
            }
        });
    }
    
    /**
     * Updates the room description text
     * @param {Object} room - Room data
     */
    static updateRoomDescription(room) {
        const narrationElement = document.getElementById('currentNarration');
        if (narrationElement && room.description) {
            narrationElement.textContent = room.description;
        }
    }
    
    /**
     * Updates character display with current stats
     * @param {Object} character - Character data
     */
    static updateCharacterDisplay(character) {
        try {
            // Update character name
            const nameElement = document.getElementById('characterName');
            if (nameElement) {
                nameElement.textContent = character.character_name;
            }
            
            // Update HP bar
            this.updateStatBar('hp', character.current_hp, character.max_hp);
            
            // Update Energy bar
            this.updateStatBar('energy', character.current_energy, character.max_energy);
            
            // Update total level
            const levelElement = document.getElementById('totalLevel');
            if (levelElement) {
                const totalLevel = this.calculateTotalLevel(character.skills);
                levelElement.textContent = totalLevel.toString();
            }
            
            // Update skills display
            this.updateSkillsDisplay(character.skills);
            
            // Update abilities
            this.updateAbilitiesDisplay(character);
            
            // Update inventory
            this.updateInventoryDisplay(character.inventory);
        } catch (error) {
            console.error('Failed to update character display:', error);
        }
    }
    
    /**
     * Updates a stat bar (HP or Energy)
     * @param {string} statType - 'hp' or 'energy'
     * @param {number} current - Current value
     * @param {number} max - Maximum value
     */
    static updateStatBar(statType, current, max) {
        const barElement = document.getElementById(`${statType}Bar`);
        const textElement = document.getElementById(`${statType}Text`);
        
        if (barElement && textElement) {
            const percentage = Math.max(0, Math.min(100, (current / max) * 100));
            barElement.style.width = `${percentage}%`;
            textElement.textContent = `${current}/${max}`;
            
            // Update color based on percentage
            if (percentage > 75) {
                barElement.className = `bar-fill ${statType}-high`;
            } else if (percentage > 25) {
                barElement.className = `bar-fill ${statType}-medium`;
            } else {
                barElement.className = `bar-fill ${statType}-low`;
            }
        }
    }
    
    /**
     * Updates the skills display showing top skills
     * @param {Object} skills - Skills object {skill_id: level}
     */
    static updateSkillsDisplay(skills) {
        const skillsElement = document.getElementById('skillsList');
        if (!skillsElement || !skills) {
            return;
        }
        
        // Get top 5 skills by level
        const sortedSkills = Object.entries(skills)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
        
        if (sortedSkills.length === 0) {
            skillsElement.innerHTML = '<div class="skill-item">No skills yet</div>';
            return;
        }
        
        const skillsHTML = sortedSkills.map(([skillId, level]) => {
            const skillName = this.formatSkillName(skillId);
            return `<div class="skill-item">
                <span class="skill-name">${skillName}</span>
                <span class="skill-level">${level}</span>
            </div>`;
        }).join('');
        
        skillsElement.innerHTML = skillsHTML;
    }
    
    /**
     * Updates the abilities display
     * @param {Object} character - Character data
     */
    static updateAbilitiesDisplay(character) {
        const abilitiesElement = document.getElementById('abilitiesList');
        if (!abilitiesElement) {
            return;
        }
        
        // For MVP, show basic abilities
        const basicAbilities = [
            { id: 'basic_attack', name: '⚔️ Basic Attack', cost: 0 },
            { id: 'defend', name: '🛡️ Defend', cost: 0 },
            { id: 'move', name: '🦶 Move', cost: 0 }
        ];
        
        const abilitiesHTML = basicAbilities.map(ability => {
            const canUse = character.current_energy >= ability.cost;
            const cssClass = canUse ? 'ability' : 'ability disabled';
            
            return `<div class="${cssClass}" data-ability="${ability.id}">
                <span class="ability-name">${ability.name}</span>
                <span class="ability-cost">(${ability.cost})</span>
            </div>`;
        }).join('');
        
        abilitiesElement.innerHTML = abilitiesHTML;
    }
    
    /**
     * Updates the inventory display
     * @param {Array} inventory - Array of item IDs
     */
    static updateInventoryDisplay(inventory) {
        const inventoryElement = document.getElementById('inventoryList');
        if (!inventoryElement) {
            return;
        }
        
        if (!inventory || inventory.length === 0) {
            inventoryElement.innerHTML = '<div class="inventory-item">Empty</div>';
            return;
        }
        
        const inventoryHTML = inventory.map(itemId => {
            const itemName = this.formatItemName(itemId);
            return `<div class="inventory-item" data-item="${itemId}">
                ${itemName}
            </div>`;
        }).join('');
        
        inventoryElement.innerHTML = inventoryHTML;
    }
    
    /**
     * Updates party display
     * @param {Array} partyMembers - Array of party member data
     */
    static updatePartyDisplay(partyMembers) {
        const partyElement = document.getElementById('partyList');
        if (!partyElement) {
            return;
        }
        
        if (!partyMembers || partyMembers.length <= 1) {
            partyElement.innerHTML = '<div class="party-member solo">Solo Adventure</div>';
            return;
        }
        
        const partyHTML = partyMembers.map(member => {
            const hpPercentage = (member.current_hp / member.max_hp) * 100;
            let statusClass = 'healthy';
            if (hpPercentage < 25) statusClass = 'critical';
            else if (hpPercentage < 50) statusClass = 'wounded';
            
            return `<div class="party-member ${statusClass}">
                <div class="member-name">${member.character_name}</div>
                <div class="member-hp">${member.current_hp}/${member.max_hp}</div>
            </div>`;
        }).join('');
        
        partyElement.innerHTML = partyHTML;
    }
    
    /**
     * Adds an entry to the combat log
     * @param {string} message - Message to add
     * @param {string} type - Message type (info, error, player-command, game-narration)
     */
    static addLogEntry(message, type = 'info') {
        const logContent = document.getElementById('combatLogContent');
        if (!logContent) {
            return;
        }
        
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = message;
        
        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;
        
        // Keep only last 20 entries
        while (logContent.children.length > 20) {
            logContent.removeChild(logContent.firstChild);
        }
    }
    
    /**
     * Shows/hides loading state
     * @param {boolean} loading - Whether to show loading
     * @param {string} message - Loading message
     */
    static setLoadingState(loading, message = 'Loading...') {
        const commandInput = document.getElementById('commandInput');
        const submitBtn = document.getElementById('submitBtn');
        
        if (commandInput) {
            commandInput.disabled = loading;
        }
        
        if (submitBtn) {
            submitBtn.disabled = loading;
            submitBtn.textContent = loading ? message : 'Submit';
        }
    }
    
    /**
     * Updates dungeon progress display
     * @param {number} currentRoom - Current room index (0-based)
     * @param {number} totalRooms - Total rooms in dungeon
     */
    static updateDungeonProgress(currentRoom, totalRooms) {
        const progressElement = document.getElementById('roomProgress');
        if (progressElement) {
            progressElement.textContent = `Room ${currentRoom + 1} of ${totalRooms}`;
        }
    }
    
    /**
     * Updates the tick timer display
     * @param {number} secondsRemaining - Seconds until next tick
     */
    static updateTickTimer(secondsRemaining) {
        const timerElement = document.getElementById('tickTimer');
        if (!timerElement) {
            return;
        }
        
        const minutes = Math.floor(secondsRemaining / 60);
        const seconds = secondsRemaining % 60;
        const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        timerElement.textContent = `Next tick in: ${timeDisplay}`;
        
        // Add urgency styling
        if (secondsRemaining <= 10) {
            timerElement.className = 'tick-timer urgent';
        } else if (secondsRemaining <= 30) {
            timerElement.className = 'tick-timer warning';
        } else {
            timerElement.className = 'tick-timer';
        }
    }
    
    /**
     * Shows an error message
     * @param {string} message - Error message
     * @param {number} duration - Duration in milliseconds
     */
    static showError(message, duration = 5000) {
        // Create error element if it doesn't exist
        let errorElement = document.getElementById('errorDisplay');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = 'errorDisplay';
            errorElement.className = 'error-display';
            document.body.appendChild(errorElement);
        }
        
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, duration);
    }
    
    /**
     * Shows a success message
     * @param {string} message - Success message
     * @param {number} duration - Duration in milliseconds
     */
    static showSuccess(message, duration = 3000) {
        // Create success element if it doesn't exist
        let successElement = document.getElementById('successDisplay');
        if (!successElement) {
            successElement = document.createElement('div');
            successElement.id = 'successDisplay';
            successElement.className = 'success-display';
            document.body.appendChild(successElement);
        }
        
        successElement.textContent = message;
        successElement.style.display = 'block';
        
        setTimeout(() => {
            successElement.style.display = 'none';
        }, duration);
    }
    
    // Helper Methods
    
    /**
     * Calculates total level from skills object
     * @param {Object} skills - Skills object
     * @returns {number} Total level
     */
    static calculateTotalLevel(skills) {
        if (!skills) return 0;
        return Object.values(skills).reduce((sum, level) => sum + level, 0);
    }
    
    /**
     * Formats skill ID into readable name
     * @param {string} skillId - Skill ID (snake_case)
     * @returns {string} Formatted name
     */
    static formatSkillName(skillId) {
        return skillId
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    /**
     * Formats item ID into readable name
     * @param {string} itemId - Item ID (snake_case)
     * @returns {string} Formatted name
     */
    static formatItemName(itemId) {
        const itemNames = {
            'health_potion': 'Health Potion',
            'energy_potion': 'Energy Potion',
            'rusty_sword': 'Rusty Sword',
            'iron_sword': 'Iron Sword',
            'cloth_armor': 'Cloth Armor',
            'leather_armor': 'Leather Armor'
        };
        
        return itemNames[itemId] || itemId
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    /**
     * Makes the UI responsive for mobile devices
     */
    static setupResponsiveUI() {
        const gameLayout = document.querySelector('.game-layout');
        const characterPanel = document.querySelector('.character-panel');
        
        if (!gameLayout || !characterPanel) {
            return;
        }
        
        // Add mobile toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'mobileToggle';
        toggleBtn.className = 'mobile-toggle';
        toggleBtn.textContent = '📊';
        toggleBtn.title = 'Toggle Character Panel';
        
        toggleBtn.addEventListener('click', () => {
            characterPanel.classList.toggle('mobile-hidden');
        });
        
        document.querySelector('.game-header').appendChild(toggleBtn);
        
        // Add swipe gestures for mobile
        let startX = 0;
        let startY = 0;
        
        gameLayout.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });
        
        gameLayout.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            
            // Swipe left to show panel, right to hide
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                if (deltaX < 0) {
                    characterPanel.classList.remove('mobile-hidden');
                } else {
                    characterPanel.classList.add('mobile-hidden');
                }
            }
        });
    }
}