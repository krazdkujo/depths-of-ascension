# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Depths of Ascension** is a semi-roguelike cooperative web-based game with asynchronous multiplayer gameplay. The project consists of two main components:

1. **Web Game** (`DepthsOfAscension-FINAL/game/`) - Browser-based roguelike RPG with AI-powered narration
2. **Electron Launcher** (`DepthsOfAscension-FINAL/launcher-app/`) - Secure desktop launcher for credential management and deployment

## Architecture

### Web Game Architecture
- **Frontend**: Vanilla HTML/CSS/JavaScript (no framework dependencies)
- **Backend**: Vercel serverless functions (`/api/` directory)
- **Database**: Airtable with proxy layer for security
- **AI Integration**: OpenAI GPT-3.5-turbo for command parsing and narrative generation

### Core Components
- `AirtableClient` - All database operations through serverless proxy
- `GameEngine` - Core game logic, turn processing, and state management
- `CombatSystem` - D20-based mechanics and skill progression
- `LLMIntegration` - AI command parsing and dynamic narration
- `UIRenderer` - ASCII art display and responsive UI

### Key Files
- `game-engine.js:31` - Game instance creation and management
- `airtable-client.js:17` - Database proxy communication
- `combat-system.js` - D20 skill-based combat mechanics
- `llm-integration.js` - AI command interpretation and narration
- `ui-renderer.js` - ASCII dungeon visualization

## Development Commands

### Web Game (in `DepthsOfAscension-FINAL/game/`)
```bash
npm run dev          # Start Vercel development server
npm run build        # Build for production (static files)
npm start            # Start Vercel development server
npm run deploy       # Deploy to Vercel production
npm run setup        # Interactive setup wizard
npm run setup-gui    # Graphical launcher (Windows)
```

### Electron Launcher (in `DepthsOfAscension-FINAL/launcher-app/`)
```bash
npm start            # Run Electron launcher
npm run build        # Build for all platforms
npm run build-win    # Build Windows executable
npm run pack         # Package without distribution
npm run dist         # Build distributables
```

### Startup
```bash
start-launcher.bat   # Windows startup script (installs deps and launches)
```

## Environment Setup

### Required Environment Variables
- `AIRTABLE_PAT` - Airtable Personal Access Token
- `AIRTABLE_BASE_ID` - Database base ID (default: appsdsxbD0IS9WAqe)
- `OPENAI_API_KEY` - OpenAI API key for LLM integration
- `ADMIN_PASSWORD` - Admin panel access password

### Database Initialization
1. Deploy to Vercel or run locally
2. Visit `/admin/database-utility.html`
3. Enter admin password
4. Click "Initialize Database" then "Populate Content"

## Game Data Structure

### Core Database Tables
- `players` - User accounts and authentication
- `characters` - Player characters with skills/inventory
- `skills` - 30 different skills across 8 categories
- `abilities` - Multi-skill special abilities
- `items` - Equipment and consumables
- `enemies` - Monsters with AI behavior patterns
- `dungeons` - Adventure sequences and layouts
- `rooms` - Individual dungeon rooms with ASCII maps
- `game_instances` - Active multiplayer sessions
- `commands` - Player actions and AI-generated results

## Key Game Mechanics

### Skill System
- 30 skills across categories (Combat, Magic, Stealth, etc.)
- Skills improve through use (0-100 levels)
- No traditional XP - progression through action

### Combat System
- D20 + skill level vs target numbers
- Health, energy, and permadeath mechanics
- ASCII tactical combat visualization

### Turn Processing
- Asynchronous multiplayer with configurable timers (1min/1hr/1day)
- Commands processed in batches via `api/game-tick.js`
- AI narration for all player actions

## Security Features

### Electron Launcher Security
- Encrypted credential storage via OS keychain (keytar)
- Context isolation enabled, node integration disabled
- Secure IPC communication through preload script
- No plain text storage of API keys

### API Security
- Serverless proxy layer for database access
- CORS headers configured in `vercel.json`
- Environment variable injection for credentials

## Development Tips

### Testing Multiplayer
- Use multiple browser tabs to simulate different players
- Admin panel provides database state visualization
- Check Vercel function logs for server-side debugging

### Content Management
- All game content managed through admin panel
- Export/import functionality for bulk content changes
- ASCII room layouts stored as text in database

### AI Integration
- Fallback templates used when OpenAI API unavailable
- Command parsing prompts in `LLMIntegration.js`
- Configurable narration styles (gritty/heroic/minimal)

## Deployment Architecture

### Vercel Configuration
- Serverless functions with custom timeout limits
- Static file serving for game assets
- Environment variable management through Vercel dashboard

### Function Timeouts (vercel.json)
- `airtable-proxy.js`: 30 seconds
- `llm-proxy.js`: 60 seconds
- `game-tick.js`: 45 seconds