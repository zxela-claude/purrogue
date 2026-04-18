import { COLORS, FONT_HERO, FONT_MD, FONT_MD2, FONT_SM, FONT_SM2, FONT_XXS, SCREEN_HEIGHT, SCREEN_WIDTH } from '../constants.js';
import { PersonalitySystem } from '../PersonalitySystem.js';
import { RELICS } from '../data/relics.js';
import { ALL_CARDS } from '../data/cards.js';
import { PurrSettings } from '../PurrSettings.js';
import { GameState } from '../GameState.js';

function buildShareText(snap, won) {
  const relicDb = {};
  RELICS.forEach(r => { relicDb[r.id] = r; });

  const hero = snap.hero ? snap.hero.charAt(0) + snap.hero.slice(1).toLowerCase() : 'Unknown';
  const moodInfo = snap.mood ? PersonalitySystem.getMoodDescription(snap.mood) : null;
  const moodName = moodInfo ? moodInfo.name : (snap.mood || 'Unknown');
  const result = won ? 'Victory' : 'Defeat';
  const relicNames = snap.relics && snap.relics.length > 0
    ? snap.relics.map(rid => (relicDb[rid] ? relicDb[rid].name : rid)).join(', ')
    : 'None';
  const score = snap.score != null ? snap.score
    : (snap.act - 1) * 1000 + snap.floor * 100 + (snap.enemiesKilled || 0) * 25 + (won ? 500 : 0);

  return [
    `🐱 Purrogue — ${hero} ${moodName} ${result}!`,
    `Act ${snap.act} · Score: ${score} · ${snap.enemiesKilled || 0} enemies defeated`,
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

export class RunSummaryScene extends Phaser.Scene {
  constructor() { super('RunSummaryScene'); }

  init(data) {
    this.won = data.won;
    // Cat profile delta: compare before vs after this run was recorded
    this.prevCatProfile = GameState.getCatProfile(1);
    this.newCatProfile  = GameState.getCatProfile(0);
    // Capture a snapshot of gs data before it is cleared
    const gs = this.registry.get('gameState');
    if (gs) {
      const now = Date.now();
      const elapsedMs = gs.runStats.run_start_ms ? now - gs.runStats.run_start_ms : 0;

      // Build card name lookup
      const cardNameDb = {};
      ALL_CARDS.forEach(c => { cardNameDb[c.id] = c.name; });

      // Top 3 cards by damage dealt
      const cardDamage = gs.runStats.card_damage || {};
      const topDamageCards = Object.entries(cardDamage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, dmg]) => ({ name: cardNameDb[id] || id, dmg }));

      // Most played card
      const cardPlays = gs.runStats.card_play_counts || {};
      const mostPlayedEntry = Object.entries(cardPlays)
        .sort((a, b) => b[1] - a[1])[0] || null;
      const mostPlayedCard = mostPlayedEntry
        ? { name: cardNameDb[mostPlayedEntry[0]] || mostPlayedEntry[0], count: mostPlayedEntry[1] }
        : null;

      this.snapshot = {
        hero:           gs.hero,
        act:            gs.act,
        floor:          gs.floor,
        mood:           gs.getDominantPersonality(),
        relics:         [...(gs.relics || [])],
        deckSize:       gs.deck.length,
        damageDealt:    gs.runStats.damage_dealt,
        damageTaken:    gs.runStats.damage_taken,
        cardsPlayed:    gs.runStats.cards_played,
        enemiesKilled:  gs.runStats.enemies_killed,
        turns:          gs.runStats.turns,
        goldEarned:     gs.runStats.gold_earned || 0,
        goldSpent:      gs.runStats.gold_spent || 0,
        elapsedMs,
        topDamageCards,
        mostPlayedCard,
        isDaily:        gs.isDaily || false,
        dailySeed:      gs.dailySeed || null,
        dailyModifier:  gs.dailyModifier || null,
        ascension:      gs.ascension || 0,
        score:          gs.computeScore(this.won),
      };
      // Save daily score before run is ended
      if (gs.isDaily) {
        gs.saveDailyScore(this.won);
      }
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
      fontFamily: '"Press Start 2P"', fontSize: FONT_HERO, color: resultColor,
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: 38, duration: 500, ease: 'Back.easeOut' });

    const ascLabel = (snap && snap.ascension > 0) ? `A${snap.ascension}` : 'Normal';
    const subTitleText = (snap && snap.isDaily && snap.dailySeed)
      ? `DAILY RUN — ${snap.dailySeed}`
      : `RUN SUMMARY — ${ascLabel}`;
    const subTitleColor = (snap && snap.isDaily) ? '#00e5ff' : (snap && snap.ascension > 0) ? '#ffd700' : '#555577';
    const subTitle = this.add.text(W/2, 78, subTitleText, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD2, color: subTitleColor
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: subTitle, alpha: 1, duration: 400, delay: 200 });

    if (!snap) {
      this._addReturnButton(W, H);
      return;
    }

    // ── NAN-126: Act completion badges ────────────────────────────────────────
    this._addActBadges(W, snap, this.won);

    // ── Two-column layout ─────────────────────────────────────────────────────
    const colGap    = 16;
    const leftW     = 390;
    const rightW    = 390;
    const totalW    = leftW + colGap + rightW;
    const leftX     = W/2 - totalW/2;
    const rightX    = leftX + leftW + colGap;
    const panelTop  = 112;

    // ── Left panel: run stats ─────────────────────────────────────────────────

    // Format elapsed time as m:ss
    const elapsedSec = snap.elapsedMs ? Math.floor(snap.elapsedMs / 1000) : 0;
    const elapsedStr = elapsedSec > 0
      ? `${Math.floor(elapsedSec / 60)}m ${String(elapsedSec % 60).padStart(2, '0')}s`
      : '—';

    const statRows = [
      { label: 'Result',         value: this.won ? 'VICTORY' : 'DEFEAT', color: this.won ? '#ffd700' : '#e94560' },
      { label: 'Hero',           value: snap.hero },
      { label: 'Ascension',      value: snap.ascension > 0 ? `A${snap.ascension}` : 'Normal', color: snap.ascension > 0 ? '#ffd700' : '#888888' },
      { label: 'Floor Reached',  value: `Act ${snap.act}  –  Floor ${snap.floor}` },
      { label: 'Personality',    value: moodInfo ? moodInfo.name : '—', color: moodInfo ? moodInfo.color : '#888888' },
      ...(snap.isDaily && snap.dailyModifier ? [{ label: 'Daily Modifier', value: snap.dailyModifier.name, color: '#00e5ff' }] : []),
      { label: 'Deck Size',      value: snap.deckSize },
      { label: 'Damage Dealt',   value: snap.damageDealt },
      { label: 'Damage Taken',   value: snap.damageTaken },
      { label: 'Cards Played',   value: snap.cardsPlayed },
      { label: 'Enemies Killed', value: snap.enemiesKilled },
      { label: 'Turns',          value: snap.turns },
      { label: 'Gold Earned',    value: snap.goldEarned, color: '#ffd700' },
      { label: 'Gold Spent',     value: snap.goldSpent,  color: '#ff9966' },
      { label: 'Time',           value: elapsedStr },
      { label: 'Score',          value: snap.score, color: '#ffd700' },
    ];

    // Use 26px row spacing so all 16 rows (including optional daily modifier) fit inside the panel.
    // Dynamic panel height ensures rows never overflow into the action buttons below.
    const rowSpacing = 26;
    const leftPanelH = Math.max(240, 44 + statRows.length * rowSpacing + 12);

    this.add.rectangle(leftX + leftW/2, panelTop + leftPanelH/2, leftW, leftPanelH, 0x0d0d1a, 0.88);
    this.add.graphics().lineStyle(1, 0x334466).strokeRect(leftX, panelTop, leftW, leftPanelH);

    // Panel header
    this.add.rectangle(leftX + leftW/2, panelTop + 18, leftW, 34, 0x1a1a3e);
    this.add.text(leftX + leftW/2, panelTop + 18, 'STATS', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD, color: '#4fc3f7'
    }).setOrigin(0.5);

    statRows.forEach((row, i) => {
      const rowY = panelTop + 44 + i * rowSpacing;
      if (i % 2 === 1) this.add.rectangle(leftX + leftW/2, rowY, leftW - 4, 24, 0xffffff, 0.03);
      this.add.text(leftX + 14, rowY, row.label, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#777799'
      }).setOrigin(0, 0.5);
      const valueColor = row.color || '#f0ead6';
      if (typeof row.value === 'number' && row.value > 0) {
        const vt = this.add.text(leftX + leftW - 14, rowY, '0', {
          fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: valueColor
        }).setOrigin(1, 0.5);
        this.tweens.addCounter({
          from: 0, to: row.value, duration: 800, delay: 300 + i * 70,
          onUpdate: tw => vt.setText(Math.round(tw.getValue()))
        });
      } else {
        this.add.text(leftX + leftW - 14, rowY, String(row.value), {
          fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: valueColor
        }).setOrigin(1, 0.5);
      }
    });

    // ── Right panel: relics + card highlights ─────────────────────────────────
    const rightPanelH = leftPanelH;
    this.add.rectangle(rightX + rightW/2, panelTop + rightPanelH/2, rightW, rightPanelH, 0x0d0d1a, 0.88);
    this.add.graphics().lineStyle(1, 0x334466).strokeRect(rightX, panelTop, rightW, rightPanelH);

    // Panel header
    this.add.rectangle(rightX + rightW/2, panelTop + 18, rightW, 34, 0x1a1a3e);
    const relicCount = snap.relics.length;
    this.add.text(rightX + rightW/2, panelTop + 18, `RELICS  (${relicCount})`, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD, color: '#ffd700'
    }).setOrigin(0.5);

    // Build relic lookup
    const relicDb = {};
    RELICS.forEach(r => { relicDb[r.id] = r; });

    const relicRowH = 38;
    const maxRelicRows = 5;
    const relicAreaH = maxRelicRows * relicRowH;

    if (relicCount === 0) {
      this.add.text(rightX + rightW/2, panelTop + 38 + relicAreaH/2, 'No relics collected', {
        fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#444466'
      }).setOrigin(0.5);
    } else {
      const displayRelics = snap.relics.slice(0, maxRelicRows);
      displayRelics.forEach((rid, i) => {
        const relic = relicDb[rid];
        const rowY = panelTop + 42 + i * relicRowH;
        if (i % 2 === 1) this.add.rectangle(rightX + rightW/2, rowY + 8, rightW - 4, relicRowH - 2, 0xffffff, 0.03);
        const rName = relic ? relic.name : rid;
        const rDesc = relic ? relic.desc : '';
        this.add.text(rightX + 14, rowY, rName, {
          fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#ffd700'
        }).setOrigin(0, 0);
        if (rDesc) {
          this.add.text(rightX + 14, rowY + 18, rDesc, {
            fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color: '#888899',
            wordWrap: { width: rightW - 28 }
          }).setOrigin(0, 0);
        }
      });
      if (snap.relics.length > maxRelicRows) {
        this.add.text(rightX + rightW/2, panelTop + 42 + maxRelicRows * relicRowH - 10, `+${snap.relics.length - maxRelicRows} more`, {
          fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#555577'
        }).setOrigin(0.5);
      }
    }

    // ── Card highlights sub-section ────────────────────────────────────────────
    const hlTop = panelTop + 42 + relicAreaH;
    this.add.rectangle(rightX + rightW/2, hlTop + 14, rightW, 26, 0x1a1a2e);
    this.add.graphics().lineStyle(1, 0x2a2a4e).strokeRect(rightX, hlTop, rightW, 26);
    this.add.text(rightX + rightW/2, hlTop + 13, 'CARD HIGHLIGHTS', {
      fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#aa88ff'
    }).setOrigin(0.5);

    let hlY = hlTop + 32;

    if (snap.topDamageCards && snap.topDamageCards.length > 0) {
      this.add.text(rightX + 14, hlY, 'Top Damage:', {
        fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#777799'
      }).setOrigin(0, 0.5);
      hlY += 18;
      snap.topDamageCards.forEach((c, i) => {
        if (i % 2 === 1) this.add.rectangle(rightX + rightW/2, hlY, rightW - 4, 20, 0xffffff, 0.03);
        this.add.text(rightX + 20, hlY, c.name, {
          fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#e0c0ff'
        }).setOrigin(0, 0.5);
        this.add.text(rightX + rightW - 14, hlY, `${c.dmg} dmg`, {
          fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#ff8888'
        }).setOrigin(1, 0.5);
        hlY += 22;
      });
    }

    if (snap.mostPlayedCard) {
      hlY += 4;
      this.add.text(rightX + 14, hlY, 'Most Played:', {
        fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#777799'
      }).setOrigin(0, 0.5);
      hlY += 18;
      this.add.text(rightX + 20, hlY, snap.mostPlayedCard.name, {
        fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#e0c0ff'
      }).setOrigin(0, 0.5);
      this.add.text(rightX + rightW - 14, hlY, `×${snap.mostPlayedCard.count}`, {
        fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#88ccff'
      }).setOrigin(1, 0.5);
    }

    // ── Buttons ───────────────────────────────────────────────────────────────
    this._addReturnButton(W, H);
    if (snap) this._addShareButton(W, H, snap);
    if (this.newCatProfile && this.newCatProfile.totalRuns > 0) {
      this._addCatProfileDelta(W, H);
    }
    PurrSettings.scaleSceneText(this); // NAN-222
  }

  _addActBadges(W, snap, won) {
    // Show Act 1 ✓   Act 2 ✓   Act 3 ◐ based on snap.act and won
    // Acts 1..(snap.act-1) are completed; snap.act is current (partial or won); rest not reached
    const TOTAL_ACTS = 3;
    const badges = [];
    for (let a = 1; a <= TOTAL_ACTS; a++) {
      if (a < snap.act) {
        badges.push({ act: a, symbol: '✓', color: '#4caf50' });
      } else if (a === snap.act) {
        if (won) {
          badges.push({ act: a, symbol: '✓', color: '#ffd700' });
        } else {
          badges.push({ act: a, symbol: '✗', color: '#e94560' });
        }
      } else {
        badges.push({ act: a, symbol: '◐', color: '#444466' });
      }
    }

    const badgeStr = badges.map(b => `Act ${b.act} ${b.symbol}`).join('   ');
    // Render each segment with its own color
    const segW = 120;
    const totalW = TOTAL_ACTS * segW;
    const startX = W / 2 - totalW / 2 + segW / 2;
    const badgeY = 92;

    badges.forEach((b, i) => {
      const bx = startX + i * segW;
      this.add.text(bx, badgeY, `Act ${b.act} ${b.symbol}`, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_SM2, color: b.color,
        stroke: '#000000', strokeThickness: 1
      }).setOrigin(0.5);
    });
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
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD2, color: '#4caf50'
    }).setOrigin(0.5);

    btn.on('pointerover', () => { btn.setFillStyle(0x0a3a0a); label.setColor('#6cd66c'); });
    btn.on('pointerout',  () => { btn.setFillStyle(0x0a2a0a); label.setColor('#4caf50'); });
    btn.on('pointerdown', () => {
      this.registry.set('gameState', null);
      this.scene.start('MenuScene');
    });

  }

  _addShareButton(W, H, snap) {
    const btnY  = H - 44;
    const btnW  = 200;
    const btnH  = 40;
    // Position to the left of the Return button (Return is centred at W/2)
    const btnX  = W/2 - 160 - btnW/2;

    const btn = this.add.rectangle(btnX, btnY, btnW, btnH, 0x0a1a2a)
      .setInteractive({ useHandCursor: true });
    const border = this.add.graphics();
    border.lineStyle(2, 0x4fc3f7, 0.8);
    border.strokeRect(btnX - btnW/2, btnY - btnH/2, btnW, btnH);
    const label = this.add.text(btnX, btnY, 'SHARE RUN', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD, color: '#4fc3f7'
    }).setOrigin(0.5);

    btn.on('pointerover', () => { btn.setFillStyle(0x0a2a3a); label.setColor('#7fd8f8'); });
    btn.on('pointerout',  () => { btn.setFillStyle(0x0a1a2a); label.setColor('#4fc3f7'); });
    btn.on('pointerdown', () => {
      const text = buildShareText(snap, this.won);
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
    // Overlay with a textarea so the player can manually copy
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;
    const overlay = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.75)
      .setInteractive({ useHandCursor: false }).setDepth(100);

    const boxW = 480, boxH = 180;
    this.add.rectangle(W/2, H/2, boxW, boxH, 0x0d0d1a, 1).setDepth(101);
    this.add.graphics().setDepth(101).lineStyle(1, 0x4fc3f7).strokeRect(W/2 - boxW/2, H/2 - boxH/2, boxW, boxH);

    this.add.text(W/2, H/2 - boxH/2 + 18, 'Copy this text:', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#4fc3f7'
    }).setOrigin(0.5).setDepth(102);

    // Use a DOM textarea for the actual text selection
    const ta = this.add.dom(W/2, H/2 + 16, 'textarea', {
      width: (boxW - 32) + 'px',
      height: '80px',
      background: '#0d1a2a',
      color: '#f0ead6',
      border: '1px solid #4fc3f7',
      fontFamily: 'monospace',
      fontSize: FONT_SM2,
      resize: 'none',
      padding: '6px',
    }, text).setDepth(102);
    if (ta.node) { ta.node.select(); }

    const closeBtn = this.add.text(W/2, H/2 + boxH/2 - 16, '[ CLOSE ]', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#aaaaaa'
    }).setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { overlay.destroy(); closeBtn.destroy(); if (ta) ta.destroy(); });
    overlay.on('pointerdown', () => { overlay.destroy(); closeBtn.destroy(); if (ta) ta.destroy(); });
  }

  _addCatProfileDelta(W, H) {
    const prev = this.prevCatProfile;
    const next = this.newCatProfile;
    if (!next || next.totalRuns === 0) return;

    // Find the trait that changed most
    const traits = ['feisty', 'cozy', 'cunning'];
    let biggestTrait = null, biggestDelta = 0;
    traits.forEach(t => {
      const delta = Math.abs((next[t] || 0) - ((prev && prev.totalRuns > 0) ? (prev[t] || 0) : 0));
      if (delta > biggestDelta) { biggestDelta = delta; biggestTrait = t; }
    });

    const moodInfo = next.dominant ? PersonalitySystem.getMoodDescription(next.dominant) : null;
    let msg;
    if (!prev || prev.totalRuns === 0) {
      msg = `Your cat's personality is taking shape — ${moodInfo ? moodInfo.name : 'still undecided'}`;
    } else if (biggestTrait && biggestDelta > 0) {
      const sign = (next[biggestTrait] || 0) > (prev[biggestTrait] || 0) ? '+' : '-';
      const traitInfo = PersonalitySystem.getMoodDescription(biggestTrait);
      const tName = traitInfo ? traitInfo.name : biggestTrait;
      msg = `Your cat is becoming more ${tName} (${sign}${biggestDelta}%)`;
    } else {
      msg = `Your cat's personality holds steady — ${moodInfo ? moodInfo.name : '—'}`;
    }

    const color = moodInfo ? moodInfo.color : '#888888';
    const bannerY = H - 78;
    const bannerW = 580;

    this.add.rectangle(W / 2, bannerY, bannerW, 28, 0x0d0d1a, 0.88);
    this.add.graphics().lineStyle(1, Phaser.Display.Color.HexStringToColor(color).color, 0.5)
      .strokeRect(W / 2 - bannerW / 2, bannerY - 14, bannerW, 28);
    this.add.text(W / 2, bannerY, `🐱 ${msg}`, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color,
    }).setOrigin(0.5);
  }
}
