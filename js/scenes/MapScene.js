import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS, NODE_TYPES } from '../constants.js';
import { MapGenerator } from '../MapGenerator.js';
import { PersonalitySystem } from '../PersonalitySystem.js';

const NODE_SPRITE_KEYS = {
  [NODE_TYPES.COMBAT]: 'node_combat',
  [NODE_TYPES.ELITE]: 'node_elite',
  [NODE_TYPES.SHOP]: 'node_shop',
  [NODE_TYPES.EVENT]: 'node_event',
  [NODE_TYPES.REST]: 'node_rest',
  [NODE_TYPES.BOSS]: 'node_boss'
};
const NODE_COLORS = {
  [NODE_TYPES.COMBAT]: 0xe94560,
  [NODE_TYPES.ELITE]: 0x9b59b6,
  [NODE_TYPES.SHOP]: 0xffd700,
  [NODE_TYPES.EVENT]: 0x4fc3f7,
  [NODE_TYPES.REST]: 0x4caf50,
  [NODE_TYPES.BOSS]: 0xff4400
};

export class MapScene extends Phaser.Scene {
  constructor() { super('MapScene'); }

  create() {
    const gs = this.registry.get('gameState');
    if (!gs.map) gs.map = MapGenerator.generate(gs.act);

    this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, COLORS.BG);

    // Header
    this.add.text(20, 20, `ACT ${gs.act} — FLOOR ${gs.floor + 1}/7`, { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#f0ead6' });
    this.add.text(SCREEN_WIDTH - 20, 20, `❤️ ${gs.hp}/${gs.maxHp}  💰 ${gs.gold}`, { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#f0ead6' }).setOrigin(1, 0);

    const available = MapGenerator.getAvailableNodes(gs.map);
    const availableIds = new Set(available.map(n => n.id));

    // Draw nodes and connections
    const { floors } = gs.map;
    const floorH = (SCREEN_HEIGHT - 120) / floors.length;

    floors.forEach((floor, fi) => {
      const y = SCREEN_HEIGHT - 60 - fi * floorH;
      floor.forEach((node, ni) => {
        const x = SCREEN_WIDTH * (ni + 1) / (floor.length + 1);

        // Draw connections to next floor
        if (fi < floors.length - 1) {
          node.connections.forEach(targetId => {
            const nextFloor = floors[fi + 1];
            const target = nextFloor.find(n => n.id === targetId);
            if (target) {
              const tx = SCREEN_WIDTH * (nextFloor.indexOf(target) + 1) / (nextFloor.length + 1);
              const ty = SCREEN_HEIGHT - 60 - (fi + 1) * floorH;
              this.add.line(0, 0, x, y, tx, ty, 0x444444).setOrigin(0, 0);
            }
          });
        }

        // Draw node
        const isAvail = availableIds.has(node.id);
        const color = node.completed ? 0x444444 : NODE_COLORS[node.type];
        const circle = this.add.circle(x, y, 28, color, node.completed ? 0.3 : 0.85);
        const nodeSprite = this.add.image(x, y, NODE_SPRITE_KEYS[node.type]).setDisplaySize(40, 40);
        if (node.completed) nodeSprite.setAlpha(0.35);

        if (isAvail && !node.completed) {
          circle.setInteractive({ useHandCursor: true });
          // Pulsing outline
          const outline = this.add.circle(x, y, 28, 0xffd700, 0).setStrokeStyle(2, 0xffd700);
          this.tweens.add({ targets: outline, alpha: { from: 0.3, to: 1 }, duration: 800, yoyo: true, repeat: -1 });

          circle.on('pointerdown', () => {
            node.completed = true;
            gs.map.currentNode = node.id;
            gs.map.currentFloor = fi;
            gs.floor = fi;
            gs.save();
            this._enterNode(node, gs);
          });
        }
      });
    });

    // Deck viewer button
    this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT - 20, '[ VIEW DECK ]', {
      fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#aaaaaa'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this._showDeck(gs);
    });
  }

  _enterNode(node, gs) {
    switch(node.type) {
      case NODE_TYPES.COMBAT: this.scene.start('CombatScene', { elite: false }); break;
      case NODE_TYPES.ELITE: this.scene.start('CombatScene', { elite: true }); break;
      case NODE_TYPES.SHOP: this.scene.start('ShopScene'); break;
      case NODE_TYPES.EVENT: this.scene.start('EventScene'); break;
      case NODE_TYPES.BOSS: this.scene.start('CombatScene', { boss: true }); break;
      case NODE_TYPES.REST: this._showRestMenu(gs); break;
    }
  }

  _showRestMenu(gs) {
    const overlay = this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, 400, 300, COLORS.PANEL).setDepth(10);
    this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT/2 - 100, '🛏 REST SITE', { fontFamily: '"Press Start 2P"', fontSize: '16px', color: '#f0ead6' }).setOrigin(0.5).setDepth(11);

    const healAmt = 8 + (gs.relics.includes('cat_nap') ? 8 : 0);
    this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT/2 - 20, `REST — Heal ${healAmt} HP`, { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#4caf50' }).setOrigin(0.5).setDepth(11)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (PersonalitySystem.canHeal(gs.getDominantPersonality())) {
          gs.heal(healAmt);
        }
        this.scene.start('MapScene');
      });

    this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT/2 + 40, `SMITH — Upgrade a card`, { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#ffd700' }).setOrigin(0.5).setDepth(11)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.scene.start('MapScene'); // Upgrade UI TODO
      });
  }

  _showDeck(gs) {
    // Simple deck overlay
    const overlay = this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH - 100, SCREEN_HEIGHT - 100, COLORS.PANEL).setDepth(20);
    this.add.text(SCREEN_WIDTH/2, 80, `DECK (${gs.deck.length} cards)`, { fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#f0ead6' }).setOrigin(0.5).setDepth(21);
    this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT - 60, '[ CLOSE ]', { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#e94560' }).setOrigin(0.5).setDepth(21)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => { overlay.destroy(); this.scene.restart(); });
  }
}
