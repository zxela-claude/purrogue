import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from '../constants.js';
import { PersonalitySystem } from '../PersonalitySystem.js';
import { RELICS } from '../data/relics.js';

const MOOD_BG_COLORS = {
  feisty:  0x3a0a0a,
  cozy:    0x0a1a0a,
  cunning: 0x0a0a2a,
  feral:   0x2a0a2a,
};

export class RunSummaryScene extends Phaser.Scene {
  constructor() { super('RunSummaryScene'); }

  init(data) {
    this.won = data.won;
    // Capture a snapshot of gs data before it is cleared
    const gs = this.registry.get('gameState');
    if (gs) {
      this.snapshot = {
        hero:          gs.hero,
        act:           gs.act,
        floor:         gs.floor,
        mood:          gs.getDominantPersonality(),
        relics:        [...(gs.relics || [])],
        deckSize:      gs.deck.length,
        damageDealt:   gs.runStats.damage_dealt,
        damageTaken:   gs.runStats.damage_taken,
        cardsPlayed:   gs.runStats.cards_played,
        enemiesKilled: gs.runStats.enemies_killed,
        turns:         gs.runStats.turns,
      };
    } else {
      this.snapshot = null;
    }
  }

  create() {
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;
    const snap = this.snapshot;
    const mood = snap ? snap.mood : null;
    const moodInfo = mood ? PersonalitySystem.getMoodDescription(mood) : null;

    // ── Background ────────────────────────────────────────────────────────────
    const bgColor = (mood && MOOD_BG_COLORS[mood]) ? MOOD_BG_COLORS[mood] : COLORS.BG;
    this.add.rectangle(W/2, H/2, W, H, COLORS.BG);
    this.add.rectangle(W/2, H/2, W, H, bgColor, 0.5);

    // Particle decoration
    const pfx = this.add.graphics().setDepth(-1);
    const pCol = this.won ? 0xffd700 : 0xe94560;
    Array.from({ length: 40 }, () => ({
      x: W/2 + (Math.random() - 0.5) * W * 0.8,
      y: H/2 + (Math.random() - 0.5) * H * 0.7,
      r: Math.random() * 3 + 1,
      a: Math.random() * 0.35 + 0.05,
    })).forEach(p => { pfx.fillStyle(pCol, p.a); pfx.fillCircle(p.x, p.y, p.r); });

    // ── Title ─────────────────────────────────────────────────────────────────
    const resultStr  = this.won ? '🎉  VICTORY!  🎉' : '😿  DEFEATED';
    const resultColor = this.won ? '#ffd700' : '#e94560';
    const title = this.add.text(W/2, 44, resultStr, {
      fontFamily: '"Press Start 2P"', fontSize: '28px', color: resultColor,
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: 38, duration: 500, ease: 'Back.easeOut' });

    const subTitle = this.add.text(W/2, 78, 'RUN SUMMARY', {
      fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#555577'
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: subTitle, alpha: 1, duration: 400, delay: 200 });

    if (!snap) {
      this._addReturnButton(W, H);
      return;
    }

    // ── Two-column layout ─────────────────────────────────────────────────────
    const colGap    = 16;
    const leftW     = 390;
    const rightW    = 390;
    const totalW    = leftW + colGap + rightW;
    const leftX     = W/2 - totalW/2;
    const rightX    = leftX + leftW + colGap;
    const panelTop  = 100;

    // ── Left panel: run stats ─────────────────────────────────────────────────
    const leftPanelH = 370;
    this.add.rectangle(leftX + leftW/2, panelTop + leftPanelH/2, leftW, leftPanelH, 0x0d0d1a, 0.88);
    this.add.graphics().lineStyle(1, 0x334466).strokeRect(leftX, panelTop, leftW, leftPanelH);

    // Panel header
    this.add.rectangle(leftX + leftW/2, panelTop + 18, leftW, 34, 0x1a1a3e);
    this.add.text(leftX + leftW/2, panelTop + 18, 'STATS', {
      fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#4fc3f7'
    }).setOrigin(0.5);

    const statRows = [
      { label: 'Result',         value: this.won ? 'VICTORY' : 'DEFEAT', color: this.won ? '#ffd700' : '#e94560' },
      { label: 'Hero',           value: snap.hero },
      { label: 'Floor Reached',  value: `Act ${snap.act}  –  Floor ${snap.floor}` },
      { label: 'Personality',    value: moodInfo ? moodInfo.name : '—', color: moodInfo ? moodInfo.color : '#888888' },
      { label: 'Deck Size',      value: snap.deckSize },
      { label: 'Damage Dealt',   value: snap.damageDealt },
      { label: 'Damage Taken',   value: snap.damageTaken },
      { label: 'Cards Played',   value: snap.cardsPlayed },
      { label: 'Enemies Killed', value: snap.enemiesKilled },
      { label: 'Turns',          value: snap.turns },
    ];

    statRows.forEach((row, i) => {
      const rowY = panelTop + 44 + i * 32;
      if (i % 2 === 1) this.add.rectangle(leftX + leftW/2, rowY, leftW - 4, 30, 0xffffff, 0.03);
      this.add.text(leftX + 14, rowY, row.label, {
        fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#777799'
      }).setOrigin(0, 0.5);
      const valueColor = row.color || '#f0ead6';
      if (typeof row.value === 'number' && row.value > 0) {
        const vt = this.add.text(leftX + leftW - 14, rowY, '0', {
          fontFamily: '"Press Start 2P"', fontSize: '10px', color: valueColor
        }).setOrigin(1, 0.5);
        this.tweens.addCounter({
          from: 0, to: row.value, duration: 800, delay: 300 + i * 70,
          onUpdate: tw => vt.setText(Math.round(tw.getValue()))
        });
      } else {
        this.add.text(leftX + leftW - 14, rowY, String(row.value), {
          fontFamily: '"Press Start 2P"', fontSize: '10px', color: valueColor
        }).setOrigin(1, 0.5);
      }
    });

    // ── Right panel: relics ────────────────────────────────────────────────────
    const rightPanelH = leftPanelH;
    this.add.rectangle(rightX + rightW/2, panelTop + rightPanelH/2, rightW, rightPanelH, 0x0d0d1a, 0.88);
    this.add.graphics().lineStyle(1, 0x334466).strokeRect(rightX, panelTop, rightW, rightPanelH);

    // Panel header
    this.add.rectangle(rightX + rightW/2, panelTop + 18, rightW, 34, 0x1a1a3e);
    const relicCount = snap.relics.length;
    this.add.text(rightX + rightW/2, panelTop + 18, `RELICS  (${relicCount})`, {
      fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#ffd700'
    }).setOrigin(0.5);

    // Build relic lookup
    const relicDb = {};
    RELICS.forEach(r => { relicDb[r.id] = r; });

    if (relicCount === 0) {
      this.add.text(rightX + rightW/2, panelTop + rightPanelH/2, 'No relics collected', {
        fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#444466'
      }).setOrigin(0.5);
    } else {
      snap.relics.forEach((rid, i) => {
        const relic = relicDb[rid];
        const rowY = panelTop + 48 + i * 46;
        if (i % 2 === 1) this.add.rectangle(rightX + rightW/2, rowY + 8, rightW - 4, 44, 0xffffff, 0.03);
        const rName = relic ? relic.name : rid;
        const rDesc = relic ? relic.desc : '';
        this.add.text(rightX + 14, rowY, rName, {
          fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ffd700'
        }).setOrigin(0, 0);
        if (rDesc) {
          this.add.text(rightX + 14, rowY + 18, rDesc, {
            fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#888899',
            wordWrap: { width: rightW - 28 }
          }).setOrigin(0, 0);
        }
      });
    }

    // ── Buttons ───────────────────────────────────────────────────────────────
    this._addReturnButton(W, H);
  }

  _addReturnButton(W, H) {
    const btnY  = H - 44;
    const btnW  = 260;
    const btnH  = 40;

    const btn = this.add.rectangle(W/2, btnY, btnW, btnH, 0x0a2a0a)
      .setInteractive({ useHandCursor: true });
    const border = this.add.graphics();
    border.lineStyle(2, 0x4caf50, 0.9);
    border.strokeRect(W/2 - btnW/2, btnY - btnH/2, btnW, btnH);
    const label = this.add.text(W/2, btnY, 'RETURN TO MENU', {
      fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#4caf50'
    }).setOrigin(0.5);

    btn.on('pointerover', () => { btn.setFillStyle(0x0a3a0a); label.setColor('#6cd66c'); });
    btn.on('pointerout',  () => { btn.setFillStyle(0x0a2a0a); label.setColor('#4caf50'); });
    btn.on('pointerdown', () => {
      this.registry.set('gameState', null);
      this.scene.start('MenuScene');
    });

    // Hint text: also transitions automatically after 30s if player doesn't click
    this.add.text(W/2, H - 16, 'or wait — auto-returning in 30s', {
      fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#333355'
    }).setOrigin(0.5);
    this.time.delayedCall(30000, () => {
      this.registry.set('gameState', null);
      this.scene.start('MenuScene');
    });
  }
}
