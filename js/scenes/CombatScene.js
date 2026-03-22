import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS, ENERGY_PER_TURN, HAND_SIZE } from '../constants.js';
import { CardEngine } from '../CardEngine.js';
import { PersonalitySystem } from '../PersonalitySystem.js';
import { getRandomEnemy, getBoss } from '../data/enemies.js';
import { WARRIOR_CARDS, MAGE_CARDS, ROGUE_CARDS } from '../data/cards.js';

const CARD_TYPE_COLORS = { attack: 0xe94560, skill: 0x4fc3f7, power: 0x9b59b6 };
const STATUS_COLORS = { poison: '#4caf50', burn: '#ff6b35', freeze: '#a0d8ef', vulnerable: '#e67e22', weak: '#95a5a6', strong: '#f1c40f' };

export class CombatScene extends Phaser.Scene {
  constructor() { super('CombatScene'); }

  init(data) {
    this.isElite = data.elite || false;
    this.isBoss = data.boss || false;
  }

  create() {
    const gs = this.registry.get('gameState');
    this.gs = gs;

    // Load all cards (base + upgraded variants)
    const allCards = [...WARRIOR_CARDS, ...MAGE_CARDS, ...ROGUE_CARDS];
    this.cardDb = {};
    for (const card of allCards) {
      this.cardDb[card.id] = card;
      if (card.upgrades) {
        for (const [mood, upgrade] of Object.entries(card.upgrades)) {
          const upgradeId = mood === 'default' ? `${card.id}_u` : `${card.id}_u_${mood}`;
          this.cardDb[upgradeId] = { ...card, id: upgradeId, name: card.name + '+', effects: upgrade.effects };
        }
      }
    }

    // Setup enemy
    const enemy = this.isBoss ? getBoss(gs.act) : getRandomEnemy(gs.act, this.isElite);
    this.enemy = enemy;

    // Setup combat state
    this.drawPile = [...gs.deck].sort(() => Math.random() - 0.5);
    this.discardPile = [];
    this.hand = [];
    this.energy = ENERGY_PER_TURN + (gs.relics.includes('catnip') ? 1 : 0) + (gs.pendingEnergyBonus || 0);
    gs.pendingEnergyBonus = 0;
    this.maxEnergy = this.energy;
    this.pendingEnemyDamage = gs.pendingEnemyDamage || 0;
    gs.pendingEnemyDamage = 0;
    this.turnNumber = 0;
    this.playerBlock = 0;
    this.playerStatuses = {};
    this.usedNineLives = false;
    this.coffeeMugUsed = false;
    this.bellCollarUsed = false;
    this.lastPlayedCard = null;

    if (gs.relics.includes('toy_mouse')) this.playerBlock = 3;
    // Cursed collar: start combat with 2 stacks of vulnerable
    if (gs.relics.includes('cursed_collar')) this.playerStatuses.vulnerable = 2;
    if (this.pendingEnemyDamage > 0) {
      this.enemy.hp = Math.max(0, this.enemy.hp - this.pendingEnemyDamage);
    }

    const bgKey = this.isBoss ? 'bg_boss' : `bg_combat_${Math.min(gs.act || 1, 3)}`;
    if (this.textures.exists(bgKey)) {
      this.add.image(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, bgKey).setDisplaySize(SCREEN_WIDTH, SCREEN_HEIGHT).setDepth(-1);
      this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, 0x000000, 0.45).setDepth(-1);
    } else {
      this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, COLORS.BG);
    }

    this._drawUI();
    this._startPlayerTurn();
  }

  // ── Visual helpers ──────────────────────────────────────────────────────────

  _drawHPBar(gfx, x, y, w, h, current, max) {
    gfx.clear();
    // Track
    gfx.fillStyle(0x222222);
    gfx.fillRoundedRect(x, y, w, h, 4);
    // Fill
    const pct = Math.max(0, Math.min(1, current / max));
    const fillColor = pct > 0.5 ? 0x4caf50 : pct > 0.25 ? 0xff9800 : 0xe94560;
    gfx.fillStyle(fillColor);
    gfx.fillRoundedRect(x + 1, y + 1, Math.floor((w - 2) * pct), h - 2, 3);
    // Border
    gfx.lineStyle(1, 0x555555);
    gfx.strokeRoundedRect(x, y, w, h, 4);
  }

  _drawEnergyOrbs(gfx) {
    gfx.clear();
    const r = 10, gap = 26, startX = 20 + r;
    const y = SCREEN_HEIGHT - 115;
    for (let i = 0; i < this.maxEnergy; i++) {
      const filled = i < this.energy;
      gfx.fillStyle(filled ? 0xffd700 : 0x333333);
      gfx.fillCircle(startX + i * gap, y, r);
      gfx.lineStyle(1.5, filled ? 0xffa500 : 0x555555);
      gfx.strokeCircle(startX + i * gap, y, r);
    }
  }

  _spawnFloatingText(x, y, text, color) {
    const txt = this.add.text(x, y, text, {
      fontFamily: '"Press Start 2P"', fontSize: '20px', color,
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: txt, y: y - 60, alpha: 0, duration: 800, ease: 'Power2', onComplete: () => txt.destroy() });
  }

  _showDamageNumber(x, y, amount, color = '#e94560') {
    this._spawnFloatingText(x, y, `-${amount}`, color);
  }

  _showHealNumber(x, y, amount) {
    this._spawnFloatingText(x, y, `+${amount}`, '#4caf50');
  }

  _showTurnBanner(label, color) {
    const bg = this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2 - 60, 440, 56, 0x000000, 0.7)
      .setDepth(35);
    const txt = this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT/2 - 60, label, {
      fontFamily: '"Press Start 2P"', fontSize: '22px', color,
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(36).setAlpha(0);
    this.tweens.add({
      targets: [txt, bg], alpha: { from: 1, to: 0 }, y: `-=30`,
      duration: 1100, delay: 300, ease: 'Power2',
      onComplete: () => { txt.destroy(); bg.destroy(); }
    });
    this.tweens.add({ targets: [txt, bg], alpha: 1, duration: 180 });
  }

  // ── UI Layout ───────────────────────────────────────────────────────────────

  _drawUI() {
    const gs = this.gs;
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;

    // ── Enemy section ──
    const enemyPanelY = 170;
    // Elite/boss tint
    if (this.isElite) this.add.rectangle(W/2, enemyPanelY, 300, 200, 0x9b59b6, 0.12).setDepth(0);
    if (this.isBoss) this.add.rectangle(W/2, enemyPanelY, 340, 210, 0xe94560, 0.12).setDepth(0);

    this.enemyNameText = this.add.text(W/2, 22, this.enemy.name + (this.isElite ? ' ⚡' : this.isBoss ? ' 👑' : ''), {
      fontFamily: '"Press Start 2P"', fontSize: '18px', color: this.isBoss ? '#ff4444' : '#e94560',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5);

    // Enemy HP bar
    this.enemyHpBar = this.add.graphics().setDepth(2);
    this.enemyHpLabel = this.add.text(W/2, 58, '', { fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#f0ead6', stroke: '#000000', strokeThickness: 1 }).setOrigin(0.5).setDepth(3);

    // Enemy sprite
    const enemySpriteKey = this.enemy.id;
    if (this.textures.exists(enemySpriteKey)) {
      this.enemySprite = this.add.image(W/2, 200, enemySpriteKey).setDisplaySize(150, 150);
    } else {
      // Stylised fallback — gradient circle using layered circles
      const enemyColors = { 1: 0x9b59b6, 2: 0xe74c3c, 3: 0xff4444 };
      const c = enemyColors[this.gs.act] || 0x9b59b6;
      this.add.circle(W/2, 200, 64, c, 0.3);
      this.add.circle(W/2, 200, 50, c, 0.6);
      this.add.circle(W/2, 200, 36, c);
      this.enemySprite = this.add.text(W/2, 200, this.enemy.emoji || '👾', { fontSize: '56px' }).setOrigin(0.5);
    }

    // Intent pill sits just below the HP bar so the player always sees
    // what the enemy plans to do next turn before committing their actions.
    this.enemyIntentContainer = this.add.container(W/2, 78).setDepth(5);

    this.enemyBlockText = this.add.text(W/2, 285, '', { fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#4fc3f7', stroke: '#000000', strokeThickness: 1 }).setOrigin(0.5);
    this.enemyStatusContainer = this.add.container(W/2, 310).setDepth(5);

    // ── Player section ──
    const heroKey = gs.hero ? gs.hero.toLowerCase() + '_idle' : null;
    if (heroKey && this.textures.exists(heroKey)) {
      this.heroSprite = this.add.image(100, H - 200, heroKey).setDisplaySize(110, 110);
    } else {
      const heroColors = { WARRIOR: 0xe74c3c, MAGE: 0x9b59b6, ROGUE: 0x27ae60 };
      const hc = heroColors[gs.hero] || 0xffffff;
      this.add.circle(100, H - 200, 50, hc, 0.3);
      this.add.circle(100, H - 200, 38, hc, 0.6);
      this.add.circle(100, H - 200, 26, hc);
      this.heroSprite = this.add.text(100, H - 200, gs.hero === 'WARRIOR' ? '⚔️' : gs.hero === 'MAGE' ? '🔮' : '🗡️', { fontSize: '36px' }).setOrigin(0.5);
    }

    // Player HP bar
    this.playerHpBar = this.add.graphics().setDepth(2);
    this.playerHpLabel = this.add.text(170, H - 168, '', { fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#f0ead6', stroke: '#000000', strokeThickness: 1 }).setDepth(3);

    // Block indicator
    this.playerBlockLabel = this.add.text(170, H - 148, '', { fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#4fc3f7', stroke: '#000000', strokeThickness: 1 }).setDepth(3);

    // Energy orbs
    this.energyOrbGfx = this.add.graphics().setDepth(2);
    this.add.text(20, H - 131, 'ENERGY', { fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#888888' }).setDepth(3);

    // Player status text
    this.playerStatusText = this.add.text(170, H - 128, '', { fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#aaaaaa' }).setDepth(3);

    // End turn button
    const endTurnHitZone = this.add.rectangle(W - 110, H - 155, 220, 60, 0x000000, 0).setInteractive({ useHandCursor: true });
    const endTurnBg = this.add.rectangle(W - 110, H - 155, 210, 50, 0x2a0a12).setDepth(4);
    this.add.graphics().setDepth(4).lineStyle(2, 0xe94560).strokeRect(W - 215, H - 180, 210, 50);
    this.endTurnBtn = this.add.text(W - 110, H - 155, 'END TURN', {
      fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#e94560'
    }).setOrigin(0.5).setDepth(5);
    endTurnHitZone.on('pointerdown', () => { if (!endTurnHitZone.input?.enabled) return; this._endPlayerTurn(); });
    endTurnHitZone.on('pointerover', () => endTurnBg.setFillStyle(0x500a20));
    endTurnHitZone.on('pointerout', () => endTurnBg.setFillStyle(0x2a0a12));
    this._endTurnHitZone = endTurnHitZone;

    // Personality chip
    const mood = gs.getDominantPersonality();
    if (mood) {
      const moodInfo = PersonalitySystem.getMoodDescription(mood);
      if (moodInfo) {
        const chip = this.add.rectangle(W - 80, 18, 150, 26, 0x111111).setDepth(3);
        this.add.graphics().setDepth(3).lineStyle(1, Phaser.Display.Color.HexStringToColor(moodInfo.color).color).strokeRect(W - 155, 5, 150, 26);
        this.add.text(W - 80, 18, moodInfo.name, { fontFamily: '"Press Start 2P"', fontSize: '11px', color: moodInfo.color }).setOrigin(0.5).setDepth(4);
      }
    }

    // Deck / discard counters
    this.deckCountText = this.add.text(20, H - 32, '', { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#888888' });
    this.discardCountText = this.add.text(200, H - 32, '', { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#888888' });

    // View Deck button — small, unobtrusive, bottom-center
    const deckBtnBg = this.add.rectangle(W / 2, H - 20, 140, 28, 0x111122).setDepth(6);
    this.add.graphics().setDepth(6).lineStyle(1, 0x4fc3f7, 0.6).strokeRect(W / 2 - 70, H - 34, 140, 28);
    const deckBtnLabel = this.add.text(W / 2, H - 20, 'VIEW DECK [D]', {
      fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#4fc3f7'
    }).setOrigin(0.5).setDepth(7);
    const deckBtnZone = this.add.rectangle(W / 2, H - 20, 140, 28, 0xffffff, 0)
      .setDepth(8).setInteractive({ useHandCursor: true });
    deckBtnZone.on('pointerover', () => deckBtnBg.setFillStyle(0x1a2244));
    deckBtnZone.on('pointerout', () => deckBtnBg.setFillStyle(0x111122));
    deckBtnZone.on('pointerdown', () => this._showDeckOverlay());

    // Keyboard shortcut D to open deck view
    this.input.keyboard.on('keydown-D', () => this._showDeckOverlay());

    // Act indicator top-left
    this.add.text(20, 22, `ACT ${this.gs.act}${this.isBoss ? ' — BOSS' : this.isElite ? ' — ELITE' : ''}`, {
      fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#666666'
    });

    this._updateStatsDisplay();
  }

  _showDeckOverlay() {
    // Don't open if already open
    if (this._deckOverlay) return;

    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;
    const gs = this.gs;

    // Full deck = draw pile + discard pile + current hand
    const fullDeck = [...this.drawPile, ...this.discardPile, ...this.hand];

    const overlay = this.add.container(0, 0).setDepth(200);
    this._deckOverlay = overlay;

    // Dark backdrop — click outside to close
    const backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75)
      .setInteractive();
    backdrop.on('pointerdown', () => this._closeDeckOverlay());
    overlay.add(backdrop);

    // Panel
    const panelW = Math.min(W - 60, 760);
    const panelH = H - 80;
    const panelX = W / 2;
    const panelY = H / 2;
    const panel = this.add.rectangle(panelX, panelY, panelW, panelH, 0x0a0a1e);
    const panelBorder = this.add.graphics();
    panelBorder.lineStyle(2, 0x4fc3f7);
    panelBorder.strokeRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH);
    overlay.add([panel, panelBorder]);

    // Title
    const title = this.add.text(panelX, panelY - panelH / 2 + 22, `FULL DECK — ${fullDeck.length} cards`, {
      fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#4fc3f7',
      stroke: '#000000', strokeThickness: 1
    }).setOrigin(0.5);
    overlay.add(title);

    const subTitle = this.add.text(panelX, panelY - panelH / 2 + 44, 'Draw + Discard + Hand  |  [ESC] or click outside to close', {
      fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#666666'
    }).setOrigin(0.5);
    overlay.add(subTitle);

    // Separator
    const sep = this.add.graphics();
    sep.lineStyle(1, 0x222244);
    sep.lineBetween(panelX - panelW / 2 + 16, panelY - panelH / 2 + 56, panelX + panelW / 2 - 16, panelY - panelH / 2 + 56);
    overlay.add(sep);

    // Card list — paginated rows
    const CARD_TYPE_COLORS_LOCAL = { attack: '#e94560', skill: '#4fc3f7', power: '#9b59b6' };
    const rowH = 34;
    const cols = 3;
    const startY = panelY - panelH / 2 + 74;
    const colW = Math.floor((panelW - 32) / cols);
    const maxRows = Math.floor((panelH - 120) / rowH);
    const maxVisible = maxRows * cols;
    this._deckPage = this._deckPage || 0;
    const page = this._deckPage;
    const pageSlice = fullDeck.slice(page * maxVisible, (page + 1) * maxVisible);
    const totalPages = Math.ceil(fullDeck.length / maxVisible);

    pageSlice.forEach((cardId, i) => {
      const card = this.cardDb[cardId];
      if (!card) return;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = panelX - panelW / 2 + 16 + col * colW;
      const cy = startY + row * rowH;

      const typeCol = CARD_TYPE_COLORS_LOCAL[card.type] || '#888888';
      const isUpgraded = cardId.includes('_u');
      const nameColor = isUpgraded ? '#ffd700' : '#f0ead6';

      // Type pip
      const pip = this.add.rectangle(cx + 6, cy + rowH / 2 - 1, 10, 10, Phaser.Display.Color.HexStringToColor(typeCol).color);
      overlay.add(pip);

      // Card name
      const nameText = this.add.text(cx + 18, cy + 4, card.name + (isUpgraded ? '+' : ''), {
        fontFamily: '"Press Start 2P"', fontSize: '10px', color: nameColor
      });
      overlay.add(nameText);

      // Stats line: cost | type | damage/block value
      const effects = card.effects || [];
      const dmgEffect = effects.find(e => e.type === 'damage');
      const blockEffect = effects.find(e => e.type === 'block');
      const statParts = [`Cost:${card.cost ?? '?'}`, card.type.toUpperCase()];
      if (dmgEffect) statParts.push(`DMG:${dmgEffect.value}`);
      if (blockEffect) statParts.push(`BLK:${blockEffect.value}`);

      const statText = this.add.text(cx + 18, cy + 18, statParts.join('  '), {
        fontFamily: '"Press Start 2P"', fontSize: '7px', color: typeCol
      });
      overlay.add(statText);

      // Row separator
      if (row > 0) {
        const rowSep = this.add.graphics();
        rowSep.lineStyle(1, 0x111133);
        rowSep.lineBetween(cx, cy, cx + colW - 4, cy);
        overlay.add(rowSep);
      }
    });

    // Pagination controls
    if (totalPages > 1) {
      const pageLabel = this.add.text(panelX, panelY + panelH / 2 - 38, `Page ${page + 1} / ${totalPages}`, {
        fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#888888'
      }).setOrigin(0.5);
      overlay.add(pageLabel);

      if (page > 0) {
        const prevBtn = this.add.text(panelX - 100, panelY + panelH / 2 - 38, '< PREV', {
          fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#4fc3f7'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        prevBtn.on('pointerdown', () => { this._deckPage--; this._closeDeckOverlay(); this._showDeckOverlay(); });
        overlay.add(prevBtn);
      }
      if (page < totalPages - 1) {
        const nextBtn = this.add.text(panelX + 100, panelY + panelH / 2 - 38, 'NEXT >', {
          fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#4fc3f7'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        nextBtn.on('pointerdown', () => { this._deckPage++; this._closeDeckOverlay(); this._showDeckOverlay(); });
        overlay.add(nextBtn);
      }
    }

    // Close button
    const closeBtn = this.add.text(panelX, panelY + panelH / 2 - 16, '[ CLOSE ]', {
      fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#e94560'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this._closeDeckOverlay());
    overlay.add(closeBtn);

    // Escape key to close
    this._deckEscKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this._deckEscKey.once('down', () => this._closeDeckOverlay());

    // Fade-in
    overlay.setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 140 });
  }

  _closeDeckOverlay() {
    if (!this._deckOverlay) return;
    const overlay = this._deckOverlay;
    this._deckOverlay = null;
    if (this._deckEscKey) {
      this._deckEscKey.removeAllListeners();
      this._deckEscKey = null;
    }
    this.tweens.add({
      targets: overlay, alpha: 0, duration: 120,
      onComplete: () => overlay.destroy(true)
    });
  }

  _updateStatsDisplay() {
    const gs = this.gs;
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;

    // Enemy HP bar
    this._drawHPBar(this.enemyHpBar, W/2 - 110, 44, 220, 14, this.enemy.hp, this.enemy.maxHp);
    this.enemyHpLabel.setText(`${this.enemy.hp} / ${this.enemy.maxHp}`);

    // Enemy block
    this.enemyBlockText.setText(this.enemy.block > 0 ? `🛡 ${this.enemy.block}` : '');

    // Enemy status badges
    this.enemyStatusContainer.removeAll(true);
    const statuses = Object.entries(this.enemy.statuses || {}).filter(([,v]) => v > 0);
    statuses.forEach(([k, v], i) => {
      const col = STATUS_COLORS[k] || '#aaaaaa';
      const badge = this.add.text(i * 72 - statuses.length * 36 + 36, 0, `${k[0].toUpperCase()}:${v}`, {
        fontFamily: '"Press Start 2P"', fontSize: '11px', color: col,
        backgroundColor: '#111111', padding: { x: 5, y: 3 }
      }).setOrigin(0.5);
      this.enemyStatusContainer.add(badge);
    });

    // Enemy intent — use threshold pattern when below HP threshold
    const _tb = this.enemy.thresholdBehavior;
    const _useThreshold = _tb && (this.enemy.hp / this.enemy.maxHp) < _tb.below;
    const _intentPattern = _useThreshold ? _tb.pattern : this.enemy.movePattern;
    const move = _intentPattern[this.enemy.moveIndex % _intentPattern.length];
    const intentIcon = move.type === 'attack' ? '⚔️' : move.type === 'block' ? '🛡' : '✨';
    const intentColor = move.type === 'attack' ? 0xe94560 : move.type === 'block' ? 0x4fc3f7 : 0x9b59b6;
    const intentLabel = (_useThreshold ? '⚠️ ' : '') + `${intentIcon} ${move.desc}`;

    this.enemyIntentContainer.removeAll(true);
    const pillW = Math.min(260, intentLabel.length * 10 + 32);
    const pillBg = this.add.rectangle(0, 0, pillW, 28, intentColor, 0.25);
    const pillBorder = this.add.graphics();
    pillBorder.lineStyle(1, intentColor, 0.8);
    pillBorder.strokeRoundedRect(-pillW / 2, -14, pillW, 28, 8);
    const pillText = this.add.text(0, 0, intentLabel, {
      fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#ffffff'
    }).setOrigin(0.5);
    this.enemyIntentContainer.add([pillBg, pillBorder, pillText]);

    // Player HP bar
    this._drawHPBar(this.playerHpBar, 160, H - 180, 200, 14, gs.hp, gs.maxHp);
    this.playerHpLabel.setText(`${gs.hp} / ${gs.maxHp}`);

    // Player block
    this.playerBlockLabel.setText(this.playerBlock > 0 ? `🛡 ${this.playerBlock}` : '');

    // Energy orbs
    this._drawEnergyOrbs(this.energyOrbGfx);

    // Player statuses
    const pStatuses = Object.entries(this.playerStatuses || {}).filter(([,v]) => v > 0);
    this.playerStatusText.setText(pStatuses.map(([k,v]) => `${k[0].toUpperCase()}:${v}`).join(' '));

    // Deck / discard
    this.deckCountText.setText(`📚 Draw: ${this.drawPile.length}`);
    this.discardCountText.setText(`🗑 Disc: ${this.discardPile.length}`);
  }

  // ── Card Hand ───────────────────────────────────────────────────────────────

  _startPlayerTurn() {
    this.turnNumber++;
    this.gs.runStats.turns++;
    const carried = this.gs.relics.includes('power_cell') ? Math.min(this.energy, 1) : 0;
    this.energy = this.maxEnergy + carried;
    this.playerBlock = 0;
    this.coffeeMugUsed = false;

    // Sundial: gain +1 energy on turns after the first
    if (this.gs.relics.includes('sundial') && this.turnNumber > 1) this.energy += 1;

    // Thorns: grant block equal to thorns stacks at start of turn
    if (this.playerStatuses?.thorns > 0) this.playerBlock += this.playerStatuses.thorns;

    const fakePlayer = { hp: this.gs.hp, maxHp: this.gs.maxHp, block: this.playerBlock, statuses: this.playerStatuses };
    CardEngine.tickStatuses(fakePlayer);
    this.gs.hp = fakePlayer.hp;
    this.playerBlock = fakePlayer.block;
    this.playerStatuses = fakePlayer.statuses;

    const extraDraw = (this.gs.relics.includes('ancient_tome') && this.turnNumber === 1) ? 2 : 0;
    this._drawCards(HAND_SIZE + (this.gs.relics.includes('laser_toy') ? 1 : 0) + extraDraw);
    this._updateStatsDisplay();
    this._renderHand();
    this._showTurnBanner('YOUR TURN', '#4caf50');

    if (this.gs.hp <= 0) this._playerDied();
  }

  _drawCards(count) {
    for (let i = 0; i < count; i++) {
      if (this.drawPile.length === 0) {
        this.drawPile = [...this.discardPile].sort(() => Math.random() - 0.5);
        this.discardPile = [];
        if (this.gs.relics.includes('hairball')) this.enemy.hp -= 3;
      }
      if (this.drawPile.length > 0) this.hand.push(this.drawPile.pop());
    }
  }

  _renderHand() {
    if (this.handObjects) this.handObjects.forEach(c => c.destroy(true));
    this.handObjects = [];

    if (this.hand.length === 0) return;

    const cardW = 118, cardH = 158;
    const n = this.hand.length;
    const arcRadius = 900;
    const arcCenterX = SCREEN_WIDTH / 2;
    const arcCenterY = SCREEN_HEIGHT - 102 + arcRadius;

    // Spread angle compression by hand size
    const totalDeg = n <= 4 ? 36 : n <= 7 ? 30 : n <= 9 ? 24 : 20;
    const mood = this.gs.getDominantPersonality();

    this.hand.forEach((cardId, i) => {
      const card = this.cardDb[cardId];
      if (!card) return;

      const angle = n === 1 ? 0 : -totalDeg / 2 + totalDeg * i / (n - 1);
      const rad = angle * Math.PI / 180;
      const baseX = arcCenterX + arcRadius * Math.sin(rad);
      const baseY = arcCenterY - arcRadius * Math.cos(rad);

      const cost = PersonalitySystem.getCardCost(card, mood);
      const canPlay = this.energy >= cost;
      const typeColor = CARD_TYPE_COLORS[card.type] || 0x666666;

      // Build container
      const container = this.add.container(baseX, baseY).setDepth(5).setRotation(rad);
      container.setData({ baseX, baseY, baseAngle: angle, index: i, cardId, canPlay });

      // Shadow
      const shadow = this.add.rectangle(3, 4, cardW, cardH, 0x000000, 0.4).setDepth(0);

      // Card body
      const bg = this.add.rectangle(0, 0, cardW, cardH, canPlay ? 0x1e2a4a : 0x111622);
      bg.setDepth(1);

      // Border
      const border = this.add.graphics().setDepth(2);
      const borderColor = cardId.includes('_u') ? 0xffd700 : (canPlay ? typeColor : 0x444444);
      border.lineStyle(3, borderColor);
      border.strokeRect(-cardW / 2, -cardH / 2, cardW, cardH);

      // Type pip
      const pip = this.add.rectangle(cardW / 2 - 10, -cardH / 2 + 10, 18, 18, typeColor).setDepth(3);

      // Card art (middle zone)
      const baseCardId = cardId.replace(/_u(_\w+)?$/, '');
      const artKey = `card_art_${baseCardId}`;
      const artItems = [];
      if (this.textures.exists(artKey)) {
        const artBg = this.add.rectangle(0, -8, cardW - 8, 56, 0x000000, 0.3).setDepth(2);
        const art = this.add.image(0, -8, artKey).setDisplaySize(cardW - 8, 56).setDepth(2);
        if (!canPlay) art.setTint(0x444466);
        artItems.push(artBg, art);
      }

      // Texts
      const nameText = this.add.text(0, -61, card.name, {
        fontFamily: '"Press Start 2P"', fontSize: '8px',
        color: canPlay ? '#f0ead6' : '#666666',
        wordWrap: { width: 104 }, align: 'center'
      }).setOrigin(0.5).setDepth(3);

      const costText = this.add.text(-cardW / 2 + 8, -cardH / 2 + 8, `${cost}`, {
        fontFamily: '"Press Start 2P"', fontSize: '11px', color: canPlay ? '#ffd700' : '#555555'
      }).setDepth(3);

      const descText = this.add.text(0, 36, card.description, {
        fontFamily: '"Press Start 2P"', fontSize: '8px',
        color: canPlay ? '#aaaaaa' : '#444444',
        wordWrap: { width: 104 }, align: 'center'
      }).setOrigin(0.5).setDepth(3);

      container.add([shadow, bg, border, pip, ...artItems, nameText, costText, descText]);

      // Make container interactive using card bounds
      container.setInteractive(
        new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH),
        Phaser.Geom.Rectangle.Contains
      );

      // Track tooltip
      let tooltipTimer = null;
      let tooltip = null;

      if (canPlay) {
        container.on('pointerover', () => {
          bg.setFillStyle(0x2e3f6e);
          this.tweens.add({ targets: container, y: baseY - 28, angle: 0, scaleX: 1.18, scaleY: 1.18, duration: 150, ease: 'Power2' });
          // Push neighbors
          const siblings = this.handObjects;
          if (i > 0 && siblings[i - 1]) this.tweens.add({ targets: siblings[i - 1], x: siblings[i - 1].getData('baseX') - 12, duration: 150 });
          if (i < siblings.length - 1 && siblings[i + 1]) this.tweens.add({ targets: siblings[i + 1], x: siblings[i + 1].getData('baseX') + 12, duration: 150 });
          // Tooltip after 300ms
          tooltipTimer = this.time.delayedCall(300, () => {
            tooltip = this._showCardTooltip(card, cost, baseX, baseY - 200);
          });
        });

        container.on('pointerout', () => {
          bg.setFillStyle(0x1e2a4a);
          this.tweens.add({ targets: container, x: baseX, y: baseY, angle: angle, scaleX: 1, scaleY: 1, duration: 120 });
          // Reset neighbors
          const siblings = this.handObjects;
          if (i > 0 && siblings[i - 1]) this.tweens.add({ targets: siblings[i - 1], x: siblings[i - 1].getData('baseX'), duration: 120 });
          if (i < siblings.length - 1 && siblings[i + 1]) this.tweens.add({ targets: siblings[i + 1], x: siblings[i + 1].getData('baseX'), duration: 120 });
          // Cancel tooltip
          if (tooltipTimer) { tooltipTimer.remove(); tooltipTimer = null; }
          if (tooltip) { tooltip.destroy(true); tooltip = null; }
        });

        container.on('pointerdown', () => {
          bg.setFillStyle(0xffd700);
          if (tooltipTimer) { tooltipTimer.remove(); tooltipTimer = null; }
          if (tooltip) { tooltip.destroy(true); tooltip = null; }
          container.disableInteractive();
          this.time.delayedCall(80, () => this._playCard(cardId, i));
        });
      }

      this.handObjects.push(container);
    });

    // Card draw animation: scale + fade in, staggered
    this.handObjects.forEach((container, i) => {
      container.setAlpha(0).setScale(0.8);
      this.tweens.add({ targets: container, alpha: 1, scaleX: 1, scaleY: 1, duration: 180, delay: i * 55, ease: 'Back.easeOut' });
    });
  }

  // ── Card Play / Enemy Turn ──────────────────────────────────────────────────

  _playCard(cardId, handIndex) {
    const card = this.cardDb[cardId];
    const mood = this.gs.getDominantPersonality();
    const cost = PersonalitySystem.getCardCost(card, mood);
    // Coffee mug: first card each turn costs 0
    const actualCost = (!this.coffeeMugUsed && this.gs.relics.includes('coffee_mug')) ? 0 : cost;
    if (actualCost === 0 && this.gs.relics.includes('coffee_mug')) this.coffeeMugUsed = true;
    if (this.energy < actualCost) return;

    this.energy -= actualCost;
    this.hand.splice(handIndex, 1);
    this.discardPile.push(cardId);

    this.gs.trackPersonality(card.type);
    this.gs.runStats.cards_played++;
    this.lastPlayedCard = card;

    const prevHp = this.gs.hp;
    const player = { hp: this.gs.hp, maxHp: this.gs.maxHp, block: this.playerBlock, statuses: this.playerStatuses };
    const results = CardEngine.resolveCard(card, { player, enemy: this.enemy, hand: this.hand, drawPile: this.drawPile, discardPile: this.discardPile, relics: this.gs.relics }, mood);

    this.gs.hp = player.hp;
    this.playerBlock = player.block;
    this.playerStatuses = player.statuses;

    // Claw sharpener: attack cards deal 2 extra damage
    if (this.gs.relics.includes('claw_sharpener') && card.type === 'attack') {
      const sharpDmg = 2;
      const sharpBlocked = Math.min(this.enemy.block || 0, sharpDmg);
      this.enemy.block = Math.max(0, (this.enemy.block || 0) - sharpDmg);
      this.enemy.hp -= (sharpDmg - sharpBlocked);
    }
    // Bell collar: first attack card each combat deals +3 damage
    if (this.gs.relics.includes('bell_collar') && card.type === 'attack' && !this.bellCollarUsed) {
      this.bellCollarUsed = true;
      const bellDmg = 3;
      const bellBlocked = Math.min(this.enemy.block || 0, bellDmg);
      this.enemy.block = Math.max(0, (this.enemy.block || 0) - bellDmg);
      this.enemy.hp -= (bellDmg - bellBlocked);
    }
    // Warm blanket: skill cards grant +2 block
    if (this.gs.relics.includes('warm_blanket') && card.type === 'skill') {
      this.playerBlock += 2;
    }

    const draws = results.filter(r => r.type === 'draw').reduce((s, r) => s + r.amount, 0);
    if (draws > 0) this._drawCards(draws);

    const energyGain = results.filter(r => r.type === 'gain_energy').reduce((s, r) => s + r.amount, 0);
    this.energy += energyGain;

    const dmg = results.filter(r => r.type === 'damage').reduce((s, r) => s + r.amount, 0);
    this.gs.runStats.damage_dealt += dmg;
    if (dmg > 0) {
      this._flashAttack();
      this._showDamageNumber(SCREEN_WIDTH/2, 220, dmg);
      this.cameras.main.shake(100, 0.005);
    }
    // Show heal if hp increased
    if (this.gs.hp > prevHp) {
      this._showHealNumber(100, SCREEN_HEIGHT - 220, this.gs.hp - prevHp);
    }

    this._updateStatsDisplay();

    // Card play animation: spawn ghost at container's position
    const playedContainer = this.handObjects[handIndex];
    if (playedContainer) {
      const ghost = this.add.rectangle(playedContainer.x, playedContainer.y, 118, 158,
        CARD_TYPE_COLORS[card.type] || 0x4444aa, 0.85).setDepth(50);
      this.tweens.add({
        targets: ghost,
        x: SCREEN_WIDTH / 2,
        y: SCREEN_HEIGHT / 2 - 60,
        scaleX: 1.25,
        scaleY: 1.25,
        alpha: 0,
        duration: 220,
        ease: 'Power2',
        onComplete: () => ghost.destroy()
      });
    }

    this._renderHand();

    if (this.enemy.hp <= 0) this._enemyDefeated();
    if (this.gs.hp <= 0) this._playerDied();
  }

  _endPlayerTurn() {
    // Mirror relic: replay the last card played this turn at end of turn
    if (this.gs.relics.includes('mirror') && this.lastPlayedCard) {
      const mood = this.gs.getDominantPersonality();
      const player = { hp: this.gs.hp, maxHp: this.gs.maxHp, block: this.playerBlock, statuses: this.playerStatuses };
      const results = CardEngine.resolveCard(this.lastPlayedCard, { player, enemy: this.enemy, hand: this.hand, drawPile: this.drawPile, discardPile: this.discardPile, relics: this.gs.relics }, mood);
      this.gs.hp = player.hp;
      this.playerBlock = player.block;
      this.playerStatuses = player.statuses;
      const dmg = results.filter(r => r.type === 'damage').reduce((s, r) => s + r.amount, 0);
      this.gs.runStats.damage_dealt += dmg;
      if (dmg > 0) this._showDamageNumber(SCREEN_WIDTH/2, 220, dmg);
      this._updateStatsDisplay();
      if (this.enemy.hp <= 0) { this._enemyDefeated(); return; }
      if (this.gs.hp <= 0) { this._playerDied(); return; }
    }
    this.lastPlayedCard = null;

    this.discardPile.push(...this.hand);
    this.hand = [];

    const sweepContainers = this.handObjects ? [...this.handObjects] : [];
    this.handObjects = [];

    if (sweepContainers.length === 0) {
      this._continueEndTurn();
      return;
    }

    let completed = 0;
    sweepContainers.forEach((container, i) => {
      this.tweens.add({
        targets: container,
        x: container.x + 300,
        y: container.y + 120,
        alpha: 0,
        angle: container.angle + 25,
        duration: 200,
        delay: i * 40,
        ease: 'Power1',
        onComplete: () => {
          container.destroy(true);
          completed++;
          if (completed === sweepContainers.length) this._continueEndTurn();
        }
      });
    });
  }

  _continueEndTurn() {
    this._endTurnHitZone.removeInteractive();
    this.time.delayedCall(400, () => this._enemyTurn());
  }

  _enemyTurn() {
    this._showTurnBanner('ENEMY TURN', '#e94560');

    if (this.enemy.statuses && this.enemy.statuses.freeze > 0) {
      CardEngine.tickStatuses(this.enemy);
      this._updateStatsDisplay();
      this.time.delayedCall(700, () => {
        this._endTurnHitZone.setInteractive({ useHandCursor: true });
        this._startPlayerTurn();
      });
      return;
    }

    CardEngine.tickStatuses(this.enemy);

    this.time.delayedCall(600, () => {
      const move = CardEngine.resolveEnemyIntent(this.enemy, null);
      const prevHp = this.gs.hp;
      const player = { hp: this.gs.hp, maxHp: this.gs.maxHp, block: this.playerBlock, statuses: this.playerStatuses };
      const result = CardEngine.executeEnemyMove(move, this.enemy, player);

      this.gs.hp = player.hp;
      this.playerBlock = player.block;
      this.playerStatuses = player.statuses;
      if (result.type === 'attack') {
        this.gs.runStats.damage_taken += result.amount;
        const dmgTaken = prevHp - this.gs.hp;
        if (dmgTaken > 0) {
          this._showDamageNumber(100, SCREEN_HEIGHT - 240, dmgTaken, '#ff8888');
          this.cameras.main.shake(150, 0.008);
          // Hit-flash on player HP bar area
          const flashRect = this.add.rectangle(170, SCREEN_HEIGHT - 173, 200, 14, 0xffffff, 0.85).setDepth(5);
          this.tweens.add({ targets: flashRect, alpha: 0, duration: 200, onComplete: () => flashRect.destroy() });
        }
      }

      if (this.enemySprite?.type === 'Image' || this.enemySprite?.type === 'Text') {
        this.tweens.add({ targets: this.enemySprite, x: this.enemySprite.x - 28, duration: 110, yoyo: true });
      }
      if (result.type === 'attack' && this.heroSprite) {
        this.tweens.add({ targets: this.heroSprite, alpha: 0.25, duration: 90, yoyo: true, repeat: 1 });
      }

      this._updateStatsDisplay();

      if (this.gs.hp <= 0) {
        this.time.delayedCall(500, () => this._playerDied());
      } else {
        this.time.delayedCall(700, () => {
          this._endTurnHitZone.setInteractive({ useHandCursor: true });
          this._startPlayerTurn();
        });
      }
    });
  }

  _enemyDefeated() {
    this.gs.runStats.enemies_killed++;
    const baseGold = this.isElite ? 25 + (this.gs.relics.includes('fish_snack') ? 10 : 0) : 15;
    const goldGain = this.gs.relics.includes('golden_ball') ? Math.ceil(baseGold * 1.25) : baseGold;
    this.gs.gold += goldGain;
    if (this.gs.relics.includes('yarn_ball')) this.gs.heal(2);
    this.gs.save();

    // Death collapse: tilt and slide down
    if (this.enemySprite) {
      this.tweens.add({
        targets: this.enemySprite,
        angle: 35,
        y: this.enemySprite.y + 90,
        alpha: 0,
        duration: 420,
        ease: 'Power2'
      });

      // Burst particles using graphics circles
      for (let p = 0; p < 8; p++) {
        const px = this.enemySprite.x + (Math.random() - 0.5) * 80;
        const py = (this.enemySprite.y || 200) + (Math.random() - 0.5) * 60;
        const particle = this.add.circle(px, py, 4 + Math.random() * 5, 0xffd700).setDepth(25).setAlpha(0.9);
        this.tweens.add({
          targets: particle,
          x: px + (Math.random() - 0.5) * 120,
          y: py - 40 - Math.random() * 60,
          alpha: 0,
          scaleX: 0,
          scaleY: 0,
          duration: 400 + Math.random() * 200,
          ease: 'Power2',
          onComplete: () => particle.destroy()
        });
      }
    }

    const delay = this.enemySprite ? 480 : 0;
    this.time.delayedCall(delay, () => {
      const victoryBg = this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, 500, 90, 0x000000, 0.85).setDepth(20);
      this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, `VICTORY!  +${goldGain} 💰`, {
        fontFamily: '"Press Start 2P"', fontSize: '28px', color: '#ffd700'
      }).setOrigin(0.5).setDepth(21);

      this.time.delayedCall(1500, () => {
        if (this.isBoss && this.gs.act >= 3) {
          this.gs.saveScore(true);
          this.gs.endRun();
          this.scene.start('GameOverScene', { won: true });
        } else if (this.isBoss) {
          this.gs.act++;
          this.gs.map = null;
          this.gs.save();
          this.scene.start('MapScene');
        } else {
          this.scene.start('RewardScene');
        }
      });
    });
  }

  _flashAttack() {
    if (this.heroSprite) {
      this.tweens.add({ targets: this.heroSprite, x: this.heroSprite.x + 34, duration: 75, yoyo: true });
    }
    if (this.enemySprite) {
      this.tweens.add({ targets: this.enemySprite, alpha: 0.2, duration: 75, yoyo: true, repeat: 1 });
      // Hit-flash tint: white then back to normal over ~200ms
      if (this.enemySprite.setTint) {
        this.enemySprite.setTint(0xffffff);
        this.time.delayedCall(200, () => { if (this.enemySprite?.clearTint) this.enemySprite.clearTint(); });
      }
    }
  }

  _showCardTooltip(card, cost, x, y) {
    const W = 200, H = 270;
    const clampedX = Math.max(W / 2 + 10, Math.min(SCREEN_WIDTH - W / 2 - 10, x));
    const clampedY = Math.max(H / 2 + 10, Math.min(SCREEN_HEIGHT - H / 2 - 10, y));

    const tip = this.add.container(clampedX, clampedY).setDepth(100);
    const typeColor = CARD_TYPE_COLORS[card.type] || 0x666666;

    const bg = this.add.rectangle(0, 0, W, H, 0x0a0a1e);
    const border = this.add.graphics();
    border.lineStyle(3, typeColor);
    border.strokeRect(-W / 2, -H / 2, W, H);
    const typeBanner = this.add.rectangle(0, -H / 2 + 18, W, 32, typeColor, 0.3);
    const typeLabel = this.add.text(0, -H / 2 + 18, card.type.toUpperCase(), {
      fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ffffff'
    }).setOrigin(0.5);
    const nameText = this.add.text(0, -H / 2 + 50, card.name, {
      fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#ffd700',
      wordWrap: { width: W - 20 }, align: 'center'
    }).setOrigin(0.5);
    const costLabel = this.add.text(0, -H / 2 + 78, `Cost: ${cost} ⚡`, {
      fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ffcc44'
    }).setOrigin(0.5);
    const sep = this.add.graphics();
    sep.lineStyle(1, 0x333355);
    sep.lineBetween(-W / 2 + 12, -H / 2 + 96, W / 2 - 12, -H / 2 + 96);
    const descText = this.add.text(0, 10, card.description, {
      fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#cccccc',
      wordWrap: { width: W - 24 }, align: 'center'
    }).setOrigin(0.5);

    tip.add([bg, border, typeBanner, typeLabel, nameText, costLabel, sep, descText]);
    tip.setAlpha(0);
    this.tweens.add({ targets: tip, alpha: 1, duration: 120 });
    return tip;
  }

  _playerDied() {
    // Nine lives: survive the killing blow once
    if (this.gs.relics.includes('nine_lives') && !this.usedNineLives) {
      this.usedNineLives = true;
      this.gs.hp = 1;
      const idx = this.gs.relics.indexOf('nine_lives');
      if (idx !== -1) this.gs.relics.splice(idx, 1);
      this._showTurnBanner('NINE LIVES! ❤️', '#ffd700');
      this._updateStatsDisplay();
      return;
    }
    this.gs.saveScore(false);
    this.gs.endRun();
    const bg = this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, 480, 90, 0x000000, 0.85).setDepth(20);
    this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, 'YOU DIED  😿', {
      fontFamily: '"Press Start 2P"', fontSize: '30px', color: '#e94560'
    }).setOrigin(0.5).setDepth(21);
    this.time.delayedCall(2000, () => this.scene.start('GameOverScene', { won: false }));
  }
}
