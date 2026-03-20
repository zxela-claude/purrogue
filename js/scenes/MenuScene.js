import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS, HERO_CLASSES } from '../constants.js';
import { GameState } from '../GameState.js';
import { DeckCode } from '../DeckCode.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const gs = this.registry.get('gameState') || new GameState();
    this.registry.set('gameState', gs);

    this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, COLORS.BG);

    // Title
    this.add.text(SCREEN_WIDTH/2, 120, 'PURROGUE', {
      fontFamily: '"Press Start 2P"', fontSize: '48px', color: '#e94560'
    }).setOrigin(0.5);
    this.add.text(SCREEN_WIDTH/2, 180, 'A Cat Roguelike', {
      fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#f0ead6'
    }).setOrigin(0.5);

    // Check for saved run
    const saved = GameState.load();
    if (saved) {
      this.add.text(SCREEN_WIDTH/2, 240, '► CONTINUE RUN', {
        fontFamily: '"Press Start 2P"', fontSize: '16px', color: '#ffd700'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.registry.set('gameState', saved);
          this.scene.start('MapScene');
        });
    }

    // Hero select
    this.add.text(SCREEN_WIDTH/2, 300, 'NEW RUN — CHOOSE YOUR CAT', {
      fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#aaaaaa'
    }).setOrigin(0.5);

    const heroes = Object.entries(HERO_CLASSES);
    const heroSpriteKeys = { WARRIOR: 'warrior_idle', MAGE: 'mage_idle', ROGUE: 'rogue_idle' };
    heroes.forEach(([key, hero], i) => {
      const x = SCREEN_WIDTH/2 + (i - 1) * 280;
      const card = this.add.rectangle(x, 430, 240, 210, COLORS.PANEL).setInteractive({ useHandCursor: true });
      // Hero sprite — scale to fit 100x100 within the card
      const spriteKey = heroSpriteKeys[key];
      const sprite = this.add.image(x, 365, spriteKey).setDisplaySize(100, 100);
      this.add.text(x, 425, hero.name, { fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#f0ead6' }).setOrigin(0.5);
      this.add.text(x, 450, `HP: ${hero.hp}`, { fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#4caf50' }).setOrigin(0.5);
      card.on('pointerdown', () => {
        const newGs = new GameState();
        newGs.startRun(key);
        newGs.deck = this._getStartingDeck(key);
        this.registry.set('gameState', newGs);
        this.scene.start('MapScene');
      });
      card.on('pointerover', () => card.setFillStyle(0x2a2a5e));
      card.on('pointerout', () => card.setFillStyle(COLORS.PANEL));
    });

    // Deck code import
    this.add.text(SCREEN_WIDTH/2, 620, '[ IMPORT DECK CODE ]', {
      fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#aaaaaa'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      const code = prompt('Enter deck code:');
      if (code) {
        const result = DeckCode.decode(code);
        if (result.error) { alert(result.error); return; }
        alert(`Imported: ${result.hero} deck with ${result.deck.length} cards`);
      }
    });

    // Scores
    const scores = GameState.getScores();
    if (scores.length > 0) {
      this.add.text(SCREEN_WIDTH - 20, 20, 'HIGH SCORES', { fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ffd700' }).setOrigin(1, 0);
      scores.slice(0, 5).forEach((s, i) => {
        this.add.text(SCREEN_WIDTH - 20, 45 + i * 20,
          `${s.won ? '✓' : '✗'} ${s.hero} Act${s.act}F${s.floor}`,
          { fontFamily: '"Press Start 2P"', fontSize: '8px', color: s.won ? '#4caf50' : '#e94560' }
        ).setOrigin(1, 0);
      });
    }
  }

  _getStartingDeck(heroClass) {
    const starts = {
      WARRIOR: ['w_strike','w_strike','w_strike','w_defend','w_defend','w_bash'],
      MAGE: ['m_zap','m_zap','m_zap','m_frost','m_frost','m_arcane'],
      ROGUE: ['r_shiv','r_shiv','r_shiv','r_dodge','r_dodge','r_sprint']
    };
    return starts[heroClass] || [];
  }
}
