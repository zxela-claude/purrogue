import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from '../constants.js';
import { DeckCode } from '../DeckCode.js';
import { PersonalitySystem } from '../PersonalitySystem.js';
import { RELICS } from '../data/relics.js';

function buildShareText(gs, won) {
  const relicDb = {};
  RELICS.forEach(r => { relicDb[r.id] = r; });

  const hero = gs.hero ? gs.hero.charAt(0) + gs.hero.slice(1).toLowerCase() : 'Unknown';
  const mood = gs.getDominantPersonality();
  const moodInfo = mood ? PersonalitySystem.getMoodDescription(mood) : null;
  const moodName = moodInfo ? moodInfo.name : (mood || 'Unknown');
  const result = won ? 'Victory' : 'Defeat';
  const enemiesKilled = gs.runStats ? gs.runStats.enemies_killed : 0;
  const relicNames = gs.relics && gs.relics.length > 0
    ? gs.relics.map(rid => (relicDb[rid] ? relicDb[rid].name : rid)).join(', ')
    : 'None';
  const score = gs.computeScore ? gs.computeScore(won)
    : (gs.act - 1) * 1000 + gs.floor * 100 + (enemiesKilled || 0) * 25 + (won ? 500 : 0);

  return [
    `🐱 Purrogue — ${hero} ${moodName} ${result}!`,
    `Act ${gs.act} · Score: ${score} · ${enemiesKilled || 0} enemies defeated`,
    `Relics: ${relicNames}`,
    `Play at: purrogue.cat`,
  ].join('\n');
}

const MOOD_BG_COLORS = {
  feisty:  0x3a0a0a,
  cozy:    0x0a1a0a,
  cunning: 0x0a0a2a,
  feral:   0x2a0a2a,
};

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  init(data) { this.won = data.won; }

  create() {
    const gs = this.registry.get('gameState');
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;
    const mood = gs ? gs.getDominantPersonality() : null;
    const moodInfo = mood ? PersonalitySystem.getMoodDescription(mood) : null;

    // Mood-tinted background
    const bgColor = (mood && MOOD_BG_COLORS[mood]) ? MOOD_BG_COLORS[mood] : COLORS.BG;
    this.add.rectangle(W/2, H/2, W, H, COLORS.BG);
    this.add.rectangle(W/2, H/2, W, H, bgColor, 0.55);

    // Subtle particle burst
    const pfx = this.add.graphics().setDepth(-1);
    const particles = Array.from({ length: 30 }, () => ({
      x: W/2 + (Math.random() - 0.5) * W * 0.6,
      y: H/2 + (Math.random() - 0.5) * H * 0.5,
      r: Math.random() * 3 + 1,
      a: Math.random() * 0.4 + 0.05,
      col: this.won ? 0xffd700 : 0xe94560
    }));
    particles.forEach(p => { pfx.fillStyle(p.col, p.a); pfx.fillCircle(p.x, p.y, p.r); });

    // ── Title ────────────────────────────────────────────────────────────────
    const titleStr = this.won ? '🎉  YOU WIN!  🎉' : '😿  GAME OVER';
    const titleColor = this.won ? '#ffd700' : '#e94560';
    const titleStroke = this.won ? '#7a6000' : '#7a0020';
    const title = this.add.text(W/2, 90, titleStr, {
      fontFamily: '"Press Start 2P"', fontSize: '34px', color: titleColor,
      stroke: titleStroke, strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: 84, duration: 500, ease: 'Back.easeOut' });

    // ── Mood chip ────────────────────────────────────────────────────────────
    if (moodInfo) {
      const chipBg = this.add.rectangle(W/2, 145, 220, 28, 0x111111);
      this.add.graphics().lineStyle(1, Phaser.Display.Color.HexStringToColor(moodInfo.color).color)
        .strokeRect(W/2 - 110, 131, 220, 28);
      this.add.text(W/2, 145, `Personality: ${moodInfo.name}`, {
        fontFamily: '"Press Start 2P"', fontSize: '12px', color: moodInfo.color
      }).setOrigin(0.5);
    }

    if (!gs) {
      this._addPlayAgain(W, H);
      return;
    }

    // ── Stats panel ──────────────────────────────────────────────────────────
    const panelX = W/2 - 220, panelW = 440, panelY = 175, panelH = 320;
    this.add.rectangle(W/2, panelY + panelH/2, panelW, panelH, 0x0d0d1a, 0.85);
    this.add.graphics().lineStyle(1, 0x334466).strokeRect(panelX, panelY, panelW, panelH);

    const statRows = [
      { label: 'Hero',           value: gs.hero },
      { label: 'Reached',        value: `Act ${gs.act}  Floor ${gs.floor}` },
      { label: 'Cards Played',   value: gs.runStats.cards_played },
      { label: 'Damage Dealt',   value: gs.runStats.damage_dealt },
      { label: 'Damage Taken',   value: gs.runStats.damage_taken },
      { label: 'Enemies Killed', value: gs.runStats.enemies_killed },
      { label: 'Turns Played',   value: gs.runStats.turns },
      { label: 'Deck Size',      value: gs.deck.length },
    ];

    statRows.forEach((row, i) => {
      const rowY = panelY + 24 + i * 36;
      // Alternating row shading
      if (i % 2 === 1) this.add.rectangle(W/2, rowY, panelW - 4, 34, 0xffffff, 0.03);
      this.add.text(panelX + 18, rowY, row.label, {
        fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#888888'
      }).setOrigin(0, 0.5);
      // Animate stat value ticking up (numbers only)
      if (typeof row.value === 'number' && row.value > 0) {
        const valText = this.add.text(panelX + panelW - 18, rowY, '0', {
          fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#f0ead6'
        }).setOrigin(1, 0.5);
        this.tweens.addCounter({
          from: 0, to: row.value, duration: 900, delay: 200 + i * 80,
          onUpdate: (tween) => valText.setText(Math.round(tween.getValue()))
        });
      } else {
        this.add.text(panelX + panelW - 18, rowY, String(row.value), {
          fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#f0ead6'
        }).setOrigin(1, 0.5);
      }
    });

    // ── Deck code button ──────────────────────────────────────────────────────
    const code = DeckCode.encode(gs);
    if (code) {
      const deckBtn = this.add.rectangle(W/2 - 120, 538, 220, 36, 0x0a1a2a)
        .setInteractive({ useHandCursor: true });
      this.add.graphics().lineStyle(1, 0x4fc3f7, 0.7).strokeRect(W/2 - 230, 520, 220, 36);
      this.add.text(W/2 - 120, 538, 'COPY DECK CODE', {
        fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#4fc3f7'
      }).setOrigin(0.5);
      deckBtn.on('pointerover', () => deckBtn.setFillStyle(0x0a2a3a));
      deckBtn.on('pointerout',  () => deckBtn.setFillStyle(0x0a1a2a));
      deckBtn.on('pointerdown', () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(code).then(() => alert('Deck code copied!'));
        } else {
          alert('Deck code: ' + code);
        }
      });
    }

    if (gs) this._addShareButton(W, H, gs);
    this._addPlayAgain(W, H);
  }

  _addPlayAgain(W, H) {
    const btn = this.add.rectangle(W/2 + (W > 800 ? 120 : 0), 538, 220, 36, 0x0a2a0a)
      .setInteractive({ useHandCursor: true });
    this.add.graphics().lineStyle(1, 0x4caf50, 0.8).strokeRect(W/2 + (W > 800 ? 10 : -110), 520, 220, 36);
    this.add.text(W/2 + (W > 800 ? 120 : 0), 538, 'PLAY AGAIN', {
      fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#4caf50'
    }).setOrigin(0.5);
    btn.on('pointerover', () => btn.setFillStyle(0x0a3a0a));
    btn.on('pointerout',  () => btn.setFillStyle(0x0a2a0a));
    btn.on('pointerdown', () => {
      this.registry.set('gameState', null);
      this.scene.start('MenuScene');
    });
  }

  _addShareButton(W, H, gs) {
    // Share button sits to the left of the deck code button area, at the same Y
    const btnX = W/2 - 120;
    // Check if a deck code button would be rendered; if so shift share button further left
    const code = DeckCode.encode(gs);
    const shareX = code ? W/2 - 340 : btnX;
    const shareY = 538;
    const btnW = 200, btnH = 36;

    const btn = this.add.rectangle(shareX, shareY, btnW, btnH, 0x1a0a2a)
      .setInteractive({ useHandCursor: true });
    this.add.graphics().lineStyle(1, 0xce93d8, 0.8)
      .strokeRect(shareX - btnW/2, shareY - btnH/2, btnW, btnH);
    const label = this.add.text(shareX, shareY, 'SHARE RUN', {
      fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#ce93d8'
    }).setOrigin(0.5);

    btn.on('pointerover', () => { btn.setFillStyle(0x2a0a3a); label.setColor('#e0b0f0'); });
    btn.on('pointerout',  () => { btn.setFillStyle(0x1a0a2a); label.setColor('#ce93d8'); });
    btn.on('pointerdown', () => {
      const text = buildShareText(gs, this.won);
      const doShare = () => {
        const original = 'SHARE RUN';
        label.setText('Copied! ✓');
        this.time.delayedCall(2000, () => { label.setText(original); });
      };

      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(doShare).catch(() => {
          this._showShareFallback(text);
        });
      } else {
        this._showShareFallback(text);
      }
    });
  }

  _showShareFallback(text) {
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;
    const overlay = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.75)
      .setInteractive({ useHandCursor: false }).setDepth(100);

    const boxW = 480, boxH = 180;
    this.add.rectangle(W/2, H/2, boxW, boxH, 0x0d0d1a, 1).setDepth(101);
    this.add.graphics().setDepth(101).lineStyle(1, 0xce93d8).strokeRect(W/2 - boxW/2, H/2 - boxH/2, boxW, boxH);

    this.add.text(W/2, H/2 - boxH/2 + 18, 'Copy this text:', {
      fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ce93d8'
    }).setOrigin(0.5).setDepth(102);

    const ta = this.add.dom(W/2, H/2 + 16, 'textarea', {
      width: (boxW - 32) + 'px',
      height: '80px',
      background: '#0d1a2a',
      color: '#f0ead6',
      border: '1px solid #ce93d8',
      fontFamily: 'monospace',
      fontSize: '11px',
      resize: 'none',
      padding: '6px',
    }, text).setDepth(102);
    if (ta.node) { ta.node.select(); }

    const closeBtn = this.add.text(W/2, H/2 + boxH/2 - 16, '[ CLOSE ]', {
      fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#aaaaaa'
    }).setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { overlay.destroy(); closeBtn.destroy(); if (ta) ta.destroy(); });
    overlay.on('pointerdown', () => { overlay.destroy(); closeBtn.destroy(); if (ta) ta.destroy(); });
  }
}
