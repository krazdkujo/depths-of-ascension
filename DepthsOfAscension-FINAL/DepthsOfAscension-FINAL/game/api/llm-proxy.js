/**
 * LLM Proxy - Serverless function to handle OpenAI API calls
 * Provides command parsing and narration generation
 */

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Get environment variables
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
        console.error('Missing OpenAI API key');
        return res.status(500).json({ error: 'Server configuration error' });
    }
    
    try {
        const { type, input, context, actionResult, style, character } = req.body;
        
        if (!type) {
            return res.status(400).json({ error: 'Missing type parameter' });
        }
        
        let response;
        
        switch (type) {
            case 'parse':
                response = await parseCommand(input, context, OPENAI_API_KEY);
                break;
                
            case 'narrate':
                response = await generateNarration(actionResult, style, character, OPENAI_API_KEY);
                break;
                
            default:
                return res.status(400).json({ error: 'Invalid type parameter' });
        }
        
        res.status(200).json(response);
        
    } catch (error) {
        console.error('LLM proxy error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

/**
 * Parses a player command using OpenAI
 * @param {string} input - Player input
 * @param {Object} context - Game context
 * @param {string} apiKey - OpenAI API key
 * @returns {Object} Parsed command data
 */
async function parseCommand(input, context, apiKey) {
    const systemPrompt = `You are a game command parser for a fantasy RPG. Given player input, return JSON:
{
  "intent": "attack/move/use_skill/use_item/interact",
  "target": "enemy_id or position or item_name",
  "skill_suggested": "skill_id",
  "confidence": 0.0-1.0
}

Available skills: ${context.availableSkills ? context.availableSkills.join(', ') : 'none'}
Current enemies: ${context.currentEnemies ? context.currentEnemies.join(', ') : 'none'}

Intent types:
- attack: Player wants to attack an enemy
- move: Player wants to move/reposition
- use_skill: Player wants to use a specific skill or ability
- use_item: Player wants to use an item from inventory
- interact: Player wants to examine, search, or interact with environment

Always suggest the most appropriate skill for the action. Return only valid JSON.`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: input }
                ],
                max_tokens: 150,
                temperature: 0.3
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }
        
        const data = await response.json();
        const content = data.choices[0]?.message?.content;
        
        if (!content) {
            throw new Error('No response from OpenAI');
        }
        
        // Try to parse JSON response
        try {
            const parsed = JSON.parse(content);
            return { parsed };
        } catch (parseError) {
            console.error('Failed to parse OpenAI JSON response:', content);
            throw new Error('Invalid JSON response from OpenAI');
        }
        
    } catch (error) {
        console.error('OpenAI parsing error:', error);
        throw error;
    }
}

/**
 * Generates narration using OpenAI
 * @param {Object} actionResult - Result of game action
 * @param {string} style - Narration style
 * @param {string} character - Character name
 * @param {string} apiKey - OpenAI API key
 * @returns {Object} Narration data
 */
async function generateNarration(actionResult, style, character, apiKey) {
    const styleDescriptions = {
        gritty: "Use dark, gritty language. Focus on blood, pain, and harsh realities of combat.",
        heroic: "Use epic, inspiring language. Make actions feel heroic and triumphant.",
        humorous: "Use light-hearted, comedic language. Make actions amusing and fun.",
        minimal: "Use simple, mechanical language. Focus on facts and results."
    };
    
    const systemPrompt = `You are a game narrator for a fantasy RPG. Generate engaging narration for player actions.

Style: ${style} - ${styleDescriptions[style] || styleDescriptions.heroic}

Keep narration to 1-2 sentences. Be descriptive but concise. Focus on the action and its immediate result.
Make the player feel engaged and immersed in the game world.

Return only the narration text, no extra formatting or quotes.`;

    const actionDescription = createActionDescription(actionResult, character);

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: actionDescription }
                ],
                max_tokens: 150,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }
        
        const data = await response.json();
        const narration = data.choices[0]?.message?.content;
        
        if (!narration) {
            throw new Error('No response from OpenAI');
        }
        
        return { narration: narration.trim() };
        
    } catch (error) {
        console.error('OpenAI narration error:', error);
        throw error;
    }
}

/**
 * Creates a description of the action for the LLM
 * @param {Object} actionResult - Action result data
 * @param {string} character - Character name
 * @returns {string} Action description
 */
function createActionDescription(actionResult, character) {
    const characterName = character || 'Hero';
    
    switch (actionResult.type) {
        case 'attack':
            const hit = actionResult.success ? 'hit' : 'missed';
            const damage = actionResult.attackResult?.damage || 0;
            const critical = actionResult.attackResult?.critical ? ' (critical hit)' : '';
            return `${characterName} attacked ${actionResult.target} and ${hit}${critical}. Damage: ${damage}. Skill used: ${actionResult.skillUsed}.`;
            
        case 'skill_check':
            const result = actionResult.success ? 'succeeded' : 'failed';
            const levelUp = actionResult.skillProgress?.leveledUp ? ` The skill improved to level ${actionResult.skillProgress.newLevel}!` : '';
            return `${characterName} used ${actionResult.skillId} and ${result}. Roll: ${actionResult.roll}, Total: ${actionResult.total} vs DC ${actionResult.dc}.${levelUp}`;
            
        case 'item_use':
            if (actionResult.success) {
                const healing = actionResult.healingResult ? ` Healed ${actionResult.healingResult.actualHealing} HP.` : '';
                return `${characterName} used ${actionResult.item}.${healing}`;
            } else {
                return `${characterName} tried to use ${actionResult.item} but failed.`;
            }
            
        case 'move':
            return `${characterName} moved to a new position in the room.`;
            
        case 'interact':
            return `${characterName} ${actionResult.description || 'interacted with their surroundings'}.`;
            
        case 'unknown':
            return `${characterName} tried to do something but it didn't work. Command: "${actionResult.command}".`;
            
        default:
            return `${characterName} performed an action.`;
    }
}