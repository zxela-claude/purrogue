import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS, HERO_CLASSES } from '../constants.js';
import { GameState } from '../GameState.js';
import { DeckCode } from '../DeckCode.js';

const HERO_FLAVOUR = {
  WARRIOR: 'Tank & smash',
  MAGE:    'Spells & burn',
  ROGUE:   'Poison & speed',
};

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const gs = this.registry.get('gameState') || new GameState();
    this.registry.set('gameState', gs);

    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;

    // ── Background ──────────────────────────────────────────────────────────
    this.add.rectangle(W/2, H/2, W, H, COLORS.BG);
    this._createStars();

    // Decorative lines
    const lines = this.add.graphics();
    lines.lineStyle(1, 0xe94560, 0.4);
    lines.lineBetween(60, 64, W - 60, 64);
    lines.lineBetween(60, H - 64, W - 60, H - 64);

    // ── Title ───────────────────────────────────────────────────────────────
    const titleText = this.add.text(W/2, 110, 'PURROGUE', {
      fontFamily: '"Press Start 2P"', fontSize: '52px', color: '#e94560',
      stroke: '#7a0020', strokeThickness: 4
    }).setOrigin(0.5);

    this.tweens.add({
      targets: titleText, scaleX: 1.04, scaleY: 1.04,
      duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    this.add.text(W/2, 178, 'A  Cat  Roguelike', {
      fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#f0ead6'
    }).setOrigin(0.5).setAlpha(0.7);

    // ── Continue run ─────────────────────────────────────────────────────────
    const saved = GameState.load();
    if (saved) {
      const contBg = this.add.rectangle(W/2, 232, 300, 36, 0x1a1a00).setInteractive({ useHandCursor: true });
      this.add.graphics().lineStyle(2, 0xffd700, 0.8).strokeRect(W/2 - 150, 214, 300, 36);
      this.add.text(W/2, 232, '► CONTINUE RUN', {
        fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#ffd700'
      }).setOrigin(0.5).setDepth(1);
      contBg.on('pointerover', () => contBg.setFillStyle(0x333300));
      contBg.on('pointerout', () => contBg.setFillStyle(0x1a1a00));
      contBg.on('pointerdown', () => {
        this.registry.set('gameState', saved);
        this.scene.start('MapScene');
      });
    }

    // ── Hero select label ─────────────────────────────────────────────────────
    this.add.text(W/2, 285, '— CHOOSE YOUR CAT —', {
      fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#888888'
    }).setOrigin(0.5);

    // ── Hero cards ────────────────────────────────────────────────────────────
    const heroes = Object.entries(HERO_CLASSES);
    const heroSpriteKeys = { WARRIOR: 'warrior_idle', MAGE: 'mage_idle', ROGUE: 'rogue_idle' };

    heroes.forEach(([key, hero], i) => {
      const x = W/2 + (i - 1) * 296;
      const cardY = 435;

      // Shadow
      this.add.rectangle(x + 4, cardY + 5, 250, 220, 0x000000, 0.4);

      // Body
      const card = this.add.rectangle(x, cardY, 250, 220, COLORS.PANEL)
        .setInteractive({ useHandCursor: true });

      // Colored border
      const borderGfx = this.add.graphics();
      const drawBorder = (alpha = 0.7) => {
        borderGfx.clear();
        borderGfx.lineStyle(3, hero.color, alpha);
        borderGfx.strokeRect(x - 125, cardY - 110, 250, 220);
      };
      drawBorder();

      // Hero sprite or emoji fallback
      const spriteKey = heroSpriteKeys[key];
      if (this.textures.exists(spriteKey)) {
        this.add.image(x, cardY - 50, spriteKey).setDisplaySize(100, 100);
      } else {
        this.add.circle(x, cardY - 50, 44, hero.color, 0.4);
        this.add.text(x, cardY - 50, hero.emoji, { fontSize: '40px' }).setOrigin(0.5);
      }

      this.add.text(x, cardY + 28, hero.name, {
        fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#f0ead6'
      }).setOrigin(0.5);

      this.add.text(x, cardY + 52, HERO_FLAVOUR[key], {
        fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#888888'
      }).setOrigin(0.5);

      this.add.text(x, cardY + 76, `HP: ${hero.hp}`, {
        fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#4caf50'
      }).setOrigin(0.5);

      card.on('pointerover', () => { card.setFillStyle(0x2a2a5e); drawBorder(1); });
      card.on('pointerout',  () => { card.setFillStyle(COLORS.PANEL); drawBorder(0.7); });
      card.on('pointerdown', () => {
        const newGs = new GameState();
        newGs.startRun(key);
        newGs.deck = this._getStartingDeck(key);
        this.registry.set('gameState', newGs);
        this.scene.start('MapScene');
      });
    });

    // ── Import deck code ──────────────────────────────────────────────────────
    this.add.text(W/2, H - 52, '[ IMPORT DECK CODE ]', {
      fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#444444'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', function() { this.setColor('#888888'); })
      .on('pointerout',  function() { this.setColor('#444444'); })
      .on('pointerdown', () => {
        const code = prompt('Enter deck code:');
        if (code) {
          const result = DeckCode.decode(code);
          if (result.error) { alert(result.error); return; }
          alert(`Imported: ${result.hero} deck with ${result.deck.length} cards`);
        }
      });

    // ── High scores ───────────────────────────────────────────────────────────
    const scores = GameState.getScores();
    if (scores.length > 0) {
      const panelX = W - 160;
      this.add.rectangle(panelX, 120, 270, 190, 0x0d0d1a, 0.9);
      this.add.graphics().lineStyle(1, 0xffd700, 0.3).strokeRect(panelX - 135, 25, 270, 190);
      this.add.text(panelX, 38, 'BEST RUNS', {
        fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#ffd700'
      }).setOrigin(0.5);
      scores.slice(0, 6).forEach((s, i) => {
        const col = s.won ? '#4caf50' : '#e94560';
        this.add.text(panelX - 128, 58 + i * 24,
          `${s.won ? '✓' : '✗'} ${s.hero.slice(0,7).padEnd(7)} A${s.act}F${s.floor}`,
          { fontFamily: '"Press Start 2P"', fontSize: '8px', color: col }
        );
      });
    }
  }

  _createStars() {
    const starGfx = this.add.graphics().setDepth(-1);
    const stars = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: Math.random() * SCREEN_WIDTH,
        y: Math.random() * SCREEN_HEIGHT,
        r: Math.random() * 1.8 + 0.4,
        phase: Math.random() * Math.PI * 2
      });
    }
    starGfx.fillStyle(0xffffff, 0.4);
    stars.forEach(s => starGfx.fillCircle(s.x, s.y, s.r));

    this.time.addEvent({
      delay: 80, repeat: -1,
      callback: () => {
        starGfx.clear();
        const t = this.time.now * 0.001;
        stars.forEach(s => {
          const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 1.5 + s.phase));
          starGfx.fillStyle(0xffffff, a);
          starGfx.fillCircle(s.x, s.y, s.r);
        });
      }
    });
  }

  _getStartingDeck(heroClass) {
    const starts = {
      WARRIOR: ['w_strike','w_strike','w_strike','w_defend','w_defend','w_bash'],
      MAGE:    ['m_zap','m_zap','m_zap','m_frost','m_frost','m_arcane'],
      ROGUE:   ['r_shiv','r_shiv','r_shiv','r_dodge','r_dodge','r_sprint']
    };
    return starts[heroClass] || [];
  }
}
