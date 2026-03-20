# 🐱 Purrogue

> *A cat roguelike deck builder. Build your deck. Trust your instincts. Defeat The Dog.*

**[▶ Play Now](https://purrogue.vercel.app)** · **[Visual Design Doc](https://purrogue-explainer.vercel.app)**

---

## What is this?

Purrogue is a browser-based roguelike deck builder in the vein of Slay the Spire — but with cats. Navigate a procedurally generated dungeon map, collect cards, fight enemies, and develop your cat's personality as you play. Survive all three acts and defeat the final boss to win.

No install. No account. Runs entirely in the browser. Progress is saved to localStorage so a refresh won't kill your run.

---

## Features

### 3 Hero Classes
| Hero | HP | Playstyle |
|------|-----|-----------|
| ⚔️ Warrior Cat | 80 | Heavy hits, high block, low draw |
| 🔮 Mage Cat | 60 | Spells, status effects, burn & freeze |
| 🗡️ Rogue Cat | 70 | Combo chains, poison, card cycling |

### Cat Personality System
Your cat develops a **personality** based on which cards you play most:

- 😾 **Feisty** — Attack cards cost 1 less energy
- 😸 **Cozy** — Block cards restore 1 HP
- 😼 **Cunning** — Status effects last 1 extra turn
- 🔥 **FERAL** — Double damage. No healing. No going back.

Personality locks in at a threshold and determines which upgrade path your cards take when smithed.

### The Map
3 acts × 7 floors. Each floor has branching paths with 5 node types:

```
⚔️  Combat    — Fight a regular enemy, earn gold + card reward
💀  Elite     — Tougher enemy, better rewards
🛒  Shop      — Buy cards and relics with gold
❓  Event     — Random story event with choices
🛏  Rest      — Heal 8 HP or upgrade a card
👑  Boss      — Defeat to advance to the next act
```

### 60 Cards
20 cards per class, each with a base form and personality-keyed upgrade paths. A Feisty Warrior upgrades their Strike differently than a Cozy one.

### 20 Relics
Passive bonuses that stack over your run — from **Catnip** (bonus energy each combat) to **Nine Lives** (survive one killing blow) to **Cursed Collar** (double damage, but you start each fight Vulnerable).

### 15 Enemies + 3 Bosses
Enemies scale across acts with predictable move patterns you can learn and play around.

| Act | Regular | Elite | Boss |
|-----|---------|-------|------|
| 1 | Yarn Golem, Laser Sprite, Moth Swarm | Curtain Phantom | The Dog |
| 2 | Guard Dog, Vacuum Cleaner, Squirrel | Golden Retriever | The Vacuum |
| 3 | Alley Cat, Robot Cat, Feral Pigeon | Doberman | The Vet |

### Deck Code Sharing
At the end of a run, export a base64 deck code and share it with friends. Import codes on the main menu to see how your deck would have played out.

---

## How to Play

1. **Pick your cat** on the main menu
2. **Navigate the map** — click available nodes (gold outline = reachable)
3. **In combat:**
   - You start each turn with 3 energy ⚡ and draw 5 cards
   - Click cards to play them (greyed out = can't afford)
   - Click **END TURN** when done — the enemy acts
   - Block resets each turn. HP doesn't.
4. **After combat:** pick 1 of 3 cards to add to your deck
5. **Repeat** until you beat The Vet or die trying

---

## Stack

- **[Phaser 3](https://phaser.io/)** — game framework (loaded via CDN)
- **Vanilla ES modules** — no build step, no bundler
- **localStorage** — all persistence, no backend
- **Vercel** — static deploy

```
purrogue/
├── index.html
├── vercel.json
├── js/
│   ├── main.js               # Phaser game init + scene registry
│   ├── constants.js          # screen, colors, hero stats, node types
│   ├── GameState.js          # run state + localStorage persist
│   ├── CardEngine.js         # effect resolution + enemy AI
│   ├── PersonalitySystem.js  # mood modifiers + upgrade paths
│   ├── MapGenerator.js       # procedural branching map
│   ├── DeckCode.js           # base64 encode/decode
│   └── data/
│       ├── cards.js          # 60 cards
│       ├── enemies.js        # 15 enemies + 3 bosses
│       └── relics.js         # 20 relics
│   └── scenes/
│       ├── BootScene.js
│       ├── MenuScene.js
│       ├── MapScene.js
│       ├── CombatScene.js
│       ├── ShopScene.js
│       ├── EventScene.js
│       ├── RewardScene.js
│       └── GameOverScene.js
```

---

## Running Locally

```bash
git clone https://github.com/zxela-claude/purrogue
cd purrogue
npx serve .
# open http://localhost:3000
```

No `npm install` required.

---

## Roadmap

- [ ] Pixel art sprites for heroes and enemies
- [ ] Card upgrade UI in rest nodes
- [ ] Sound effects (meows, hisses, purrs)
- [ ] Supabase leaderboard + async ghost deck PvP
- [ ] More relics, events, and card variants
- [ ] Mobile touch support

---

*Made with 🐾 and way too much catnip.*
