# Depths of Ascension

A semi-roguelike cooperative web-based game with asynchronous multiplayer gameplay. Players create characters, form parties, and explore dungeons using a skill-based progression system powered by AI narration.

![Game Status](https://img.shields.io/badge/Status-MVP_Ready-green)
![Platform](https://img.shields.io/badge/Platform-Web-blue)
![Tech](https://img.shields.io/badge/Tech-HTML%2FJS%2FVercel-orange)

## 🎮 Game Features

- **Skill-based progression**: No stats, only skills that improve through use
- **Asynchronous multiplayer**: Players take turns on configurable timers (1 minute, 1 hour, 1 day)
- **LLM-powered narration**: AI interprets player commands and narrates outcomes
- **Data-driven design**: All content stored in Airtable for easy expansion
- **Permadeath mechanics**: Full party wipes result in character loss
- **ASCII art dungeons**: Classic roguelike visual experience
- **D20 combat system**: Familiar tabletop RPG mechanics

## 🏗️ Project Structure

```
/
├── index.html                 # Login/character select
├── character-create.html      # Character creation
├── game.html                  # Main game interface
├── js/
│   ├── airtable-client.js     # Database operations
│   ├── game-engine.js         # Core game logic
│   ├── combat-system.js       # D20 combat mechanics
│   ├── llm-integration.js     # AI parsing/narration
│   └── ui-renderer.js         # ASCII display
├── admin/
│   └── database-utility.html  # Admin panel
├── api/                       # Serverless functions
│   ├── airtable-proxy.js      # Database proxy
│   ├── llm-proxy.js           # OpenAI proxy
│   └── game-tick.js           # Turn processing
├── css/
│   └── style.css             # Game styling
└── vercel.json               # Deployment config
```

## 🚀 Quick Start

### Option 1: One-Click Setup (Recommended)
```bash
git clone https://github.com/krazdkujo/depths-of-ascension.git
cd depths-of-ascension
npm install

# Interactive setup wizard
npm run setup

# OR use the graphical launcher
npm run setup-gui          # Windows
npm run setup-gui-mac      # macOS  
npm run setup-gui-linux    # Linux

# OR use platform launchers
./launch.bat               # Windows
./launch.sh                # macOS/Linux
```

### Option 2: Manual Setup

#### 1. Clone Repository
```bash
git clone https://github.com/krazdkujo/depths-of-ascension.git
cd depths-of-ascension
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Environment Setup
```bash
cp .env.example .env.local
# Edit .env.local with your API keys (see Configuration section)
```

#### 4. Local Development
```bash
npm run dev
# Visit http://localhost:3000
```

#### 5. Deploy to Vercel
```bash
npm run deploy
```

## ⚙️ Configuration

### Required Environment Variables

#### Airtable Setup
1. Create an Airtable account at https://airtable.com
2. Create a new base (or use the provided Base ID)
3. Generate a Personal Access Token:
   - Go to https://airtable.com/create/tokens
   - Create token with `data.records:read` and `data.records:write` permissions
   - Add your base to the token

```env
AIRTABLE_PAT=your_personal_access_token
AIRTABLE_BASE_ID=appsdsxbD0IS9WAqe
```

#### OpenAI Setup
1. Get API key from https://platform.openai.com/api-keys
2. Add to environment:

```env
OPENAI_API_KEY=sk-your-openai-api-key
```

#### Admin Access
```env
ADMIN_PASSWORD=your_secure_admin_password
```

### Vercel Deployment

1. **Connect Repository**
   - Fork this repository
   - Import to Vercel from GitHub

2. **Set Environment Variables**
   - In Vercel dashboard, go to Project Settings → Environment Variables
   - Add all variables from `.env.example`

3. **Deploy**
   - Vercel will automatically deploy on push to main branch
   - Visit your deployment URL

## 🎯 First Run Setup

### 1. Initialize Database
1. Visit `/admin/database-utility.html` on your deployed site
2. Enter admin password
3. Click "Initialize Database" to create all tables
4. Click "Populate Content" to add initial game data

### 2. Create First Character
1. Go to main site URL
2. Create player account
3. Create your first character
4. Enter the Goblin Warren dungeon!

## 🎮 How to Play

### Basic Commands
- `attack goblin` - Attack an enemy
- `defend` - Reduce incoming damage
- `move north` - Move in a direction
- `use health potion` - Use an item
- `examine` - Look around

### Game Mechanics
- **Skills**: Improve through use (0-100 levels)
- **Combat**: D20 + skill vs target number
- **Energy**: Abilities cost energy (regenerates in rest rooms)
- **Health**: 0 HP = knocked out, party wipe = permadeath
- **Turns**: Submit actions, wait for tick timer

### Character Progression
- 30 different skills across 8 categories
- Multi-skill abilities unlock at higher levels
- Equipment provides bonuses
- No traditional XP - skills improve by doing

## 🛠️ Development

### Code Organization
- **Frontend**: Vanilla HTML/CSS/JavaScript (no framework)
- **Backend**: Vercel serverless functions
- **Database**: Airtable (NoSQL-style with relationships)
- **AI**: OpenAI GPT-3.5-turbo for command parsing and narration

### Key Components
- `AirtableClient`: All database operations
- `GameEngine`: Core game logic and turn processing
- `CombatSystem`: D20 mechanics and skill progression
- `LLMIntegration`: AI command parsing and narration
- `UIRenderer`: ASCII art display and responsive UI

### Adding Content
Use the admin panel to:
- Add new skills, abilities, and items
- Create dungeons and rooms
- Design events and encounters
- Export/import content as JSON

## 📊 Game Data Structure

### Core Tables
- **players**: User accounts
- **characters**: Player characters with skills/inventory
- **skills**: All available skills (30 total)
- **abilities**: Special multi-skill abilities
- **items**: Equipment and consumables
- **enemies**: Monsters with AI behavior
- **dungeons**: Adventure sequences
- **rooms**: Individual dungeon rooms
- **game_instances**: Active multiplayer sessions
- **commands**: Player actions and results

## 🎨 Customization

### Adding New Dungeons
1. Use admin panel to create new dungeon entry
2. Design rooms with ASCII art layouts
3. Configure enemy encounters and events
4. Set difficulty and rewards

### Creating Skills/Abilities
1. Add skill to skills table
2. Set category and description
3. Create abilities that use the skill
4. Define energy costs and cooldowns

### Modifying Narrative Style
Edit `LLMIntegration.js` to adjust:
- Command parsing prompts
- Narration styles (gritty/heroic/humorous/minimal)
- Fallback templates

## 🐛 Troubleshooting

### Common Issues

**Database Connection Failed**
- Check Airtable PAT and Base ID
- Verify token permissions include your base
- Try reinitializing database

**LLM Not Working**
- Verify OpenAI API key is valid
- Check API usage limits
- Fallback templates will be used automatically

**Game Stuck on Loading**
- Check browser console for errors
- Verify all API endpoints are working
- Clear localStorage and refresh

**Admin Panel Access Denied**
- Check ADMIN_PASSWORD environment variable
- Ensure you're using HTTPS in production

### Development Tips
- Use browser dev tools to monitor API calls
- Check Vercel function logs for server errors
- Use admin panel to view database state
- Test with multiple browser tabs for multiplayer

## 🚀 Deployment Checklist

- [ ] Environment variables set in Vercel
- [ ] Database initialized via admin panel
- [ ] Initial content populated
- [ ] Test player registration and character creation
- [ ] Verify game tick processing works
- [ ] Test on mobile devices
- [ ] Check all API endpoints respond correctly

## 📈 Future Enhancements

### Post-MVP Features
- [ ] Town system with reputation
- [ ] Trading between players  
- [ ] Guild system
- [ ] More dungeons and content
- [ ] PvP arena mode
- [ ] Crafting implementation
- [ ] Achievement system
- [ ] Sound effects and music
- [ ] Enhanced graphics and animations

### Technical Improvements
- [ ] Real-time WebSocket updates
- [ ] Better caching and performance
- [ ] Automated testing suite
- [ ] Database migrations system
- [ ] Admin analytics dashboard

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Make your changes
4. Test thoroughly
5. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
6. Push to the branch (`git push origin feature/AmazingFeature`)
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by classic roguelike games
- Built with modern web technologies
- Powered by OpenAI for dynamic storytelling
- Community-driven development

---

**Ready to descend into the depths? Create your hero and begin your ascension!**

🎮 [Play Now](https://depths-of-ascension.vercel.app) | 📖 [Documentation](https://github.com/krazdkujo/depths-of-ascension/wiki) | 🐛 [Report Issues](https://github.com/krazdkujo/depths-of-ascension/issues)