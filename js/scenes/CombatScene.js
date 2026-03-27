import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS, ENERGY_PER_TURN, HAND_SIZE } from '../constants.js';
import { CardEngine } from '../CardEngine.js';
import { PersonalitySystem } from '../PersonalitySystem.js';
import { getRandomEnemy, getBoss } from '../data/enemies.js';
import { ALL_CARDS } from '../data/cards.js';
import { SoundManager } from '../SoundManager.js';
import { MusicManager } from '../MusicManager.js';
import { PurrSettings } from '../PurrSettings.js';
import { COLORBLIND_MAPS } from './SettingsScene.js';

const CARD_TYPE_COLORS = { attack: 0xe94560, skill: 0x4fc3f7, power: 0x9b59b6 };
const STATUS_COLORS_BASE = { poison: '#4caf50', burn: '#ff6b35', freeze: '#a0d8ef', vulnerable: '#e67e22', weak: '#95a5a6', strong: '#f1c40f' };

// Full status names for accessibility 'full' label mode (NAN-123)
const STATUS_NAMES_FULL = { poison: 'Poison', burn: 'Burn', freeze: 'Freeze', vulnerable: 'Vulnerable', weak: 'Weak', bleed: 'Bleed', strong: 'Strong', thorns: 'Thorns' };
const STATUS_NAMES_SHORT = { poison: 'Psn', burn: 'Brn', freeze: 'Frz', vulnerable: 'Vul', weak: 'Wk', bleed: 'Bld', strong: 'Str', thorns: 'Thn' };

function getStatusColors() {
  const settings = PurrSettings.load();
  const mode = settings.colorblind || 'off';
  if (mode === 'off') return STATUS_COLORS_BASE;
  const remap = COLORBLIND_MAPS[mode] || {};
  const result = {};
  for (const [k, v] of Object.entries(STATUS_COLORS_BASE)) {
    result[k] = remap[v] || v;
  }
  return result;
}

function getStatusNames() {
  const settings = PurrSettings.load();
  return settings.statusLabels === 'full' ? STATUS_NAMES_FULL : STATUS_NAMES_SHORT;
}

export class CombatScene extends Phaser.Scene {
  constructor() { super('CombatScene'); }

  init(data) {
    this.isElite = data.elite || false;
    this.isBoss = data.boss || false;
    this.isActStart = data.actStart || false;
  }

  create() {
    const gs = this.registry.get('gameState');
    this.gs = gs;

    // Load all cards (base + upgraded variants)
    const allCards = ALL_CARDS;
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

    // Deck overlay page — persists for the lifetime of this combat scene
    this._deckPage = 0;

    // Setup enemy
    const enemy = this.isBoss ? getBoss(gs.act) : getRandomEnemy(gs.act, this.isElite);
    this.enemy = enemy;

    // Ascension modifiers
    const ascMods = gs.getAscensionModifiers();
    if (ascMods.enemyHpBonus) {
      const bonus = Math.round(enemy.maxHp * ascMods.enemyHpBonus);
      enemy.maxHp += bonus;
      enemy.hp += bonus;
    }
    if (ascMods.bossThreshold && enemy.thresholdBehavior) {
      enemy.thresholdBehavior = Object.assign({}, enemy.thresholdBehavior, { below: ascMods.bossThreshold });
    }

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
    // A5: start each act with 2 Vulnerable on the player
    if (ascMods.startVulnerable > 0 && this.isActStart) {
      this.playerStatuses.vulnerable = (this.playerStatuses.vulnerable || 0) + ascMods.startVulnerable;
    }
    // Daily modifier effects
    if (gs.isDaily && gs.dailyModifier) {
      const mod = gs.dailyModifier.id;
      if (mod === 'bonus_energy') {
        this.energy += 1;
        this.maxEnergy += 1;
      }
      if (mod === 'cursed') {
        this.playerStatuses.vulnerable = (this.playerStatuses.vulnerable || 0) + 2;
      }
    }
    // Apply pending statuses from events (e.g. Thunderstorm +strong, cursed fish +poison)
    if (gs.pendingStatusBonus) {
      for (const [status, amt] of Object.entries(gs.pendingStatusBonus)) {
        this.playerStatuses[status] = (this.playerStatuses[status] || 0) + amt;
      }
      gs.pendingStatusBonus = null;
    }
    // Pending draw bonus from events (e.g. The Sunny Spot)
    this._pendingDrawBonus = gs._pendingDrawBonus || 0;
    gs._pendingDrawBonus = 0;
    if (this.pendingEnemyDamage > 0) {
      this.enemy.hp = Math.max(0, this.enemy.hp - this.pendingEnemyDamage);
    }

    // Sound effects (NAN-5)
    this.soundManager = new SoundManager(this);

    // Background music (NAN-33): boss uses intense pattern, else combat
    const music = MusicManager.getInstance(this);
    music.play(this.isBoss ? 'boss' : 'combat');

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

  _showPersonalityToast(label, colorHex) {
    const W = SCREEN_WIDTH;
    const colorNum = Phaser.Display.Color.HexStringToColor(colorHex).color;
    const bg = this.add.rectangle(W/2, 80, 360, 40, 0x000000, 0.8).setDepth(38);
    const border = this.add.graphics().setDepth(38);
    border.lineStyle(2, colorNum);
    border.strokeRect(W/2 - 180, 60, 360, 40);
    const txt = this.add.text(W/2, 80, label, {
      fontFamily: '"Press Start 2P"', fontSize: '14px', color: colorHex,
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(39);
    this.tweens.add({
      targets: [txt, bg, border], alpha: 0, duration: 600, delay: 2000, ease: 'Power2',
      onComplete: () => { txt.destroy(); bg.destroy(); border.destroy(); }
    });
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
    this.enemyHpLabel = this.add.text(W/2, 70, '', { fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#f0ead6', stroke: '#000000', strokeThickness: 1 }).setOrigin(0.5).setDepth(3);

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
    this.add.text(20, H - 122, 'ENERGY', { fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#888888' }).setDepth(3);

    // Player status text
    this.playerStatusText = this.add.text(170, H - 70, '', { fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#aaaaaa' }).setDepth(3);

    // End turn button
    const endTurnHitZone = this.add.rectangle(W - 110, H - 155, 220, 60, 0x000000, 0).setInteractive({ useHandCursor: true });
    const endTurnBg = this.add.rectangle(W - 110, H - 155, 210, 50, 0x2a0a12).setDepth(4);
    this.add.graphics().setDepth(4).lineStyle(2, 0xe94560).strokeRect(W - 215, H - 180, 210, 50);
    this.endTurnBtn = this.add.text(W - 110, H - 162, 'END TURN', {
      fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#e94560'
    }).setOrigin(0.5).setDepth(5);
    this.add.text(W - 110, H - 144, '[E / ENTER]', {
      fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#884040'
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

    // M key — mute/unmute sound effects
    this.input.keyboard.on('keydown-M', () => {
      const nowEnabled = this.soundManager.toggle();
      this._spawnFloatingText(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 80,
        nowEnabled ? 'SFX ON' : 'SFX OFF', nowEnabled ? '#4caf50' : '#e94560');
    });

    // E / Enter / Space → End Turn
    ['E', 'ENTER', 'SPACE'].forEach(key => {
      this.input.keyboard.on(`keydown-${key}`, () => {
        if (!this._deckOverlay && this._endTurnHitZone?.input?.enabled) this._endPlayerTurn();
      });
    });

    // 1–6 → play card at that hand position
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'].forEach((name, idx) => {
      this.input.keyboard.on(`keydown-${name}`, () => {
        if (this._deckOverlay) return;
        const obj = this.handObjects?.[idx];
        if (!obj) return;
        const cardId = obj.getData('cardId');
        const canPlay = obj.getData('canPlay');
        if (cardId && canPlay) {
          obj.disableInteractive();
          this._playCard(cardId, idx);
        }
      });
    });

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
    const _statusColors = getStatusColors();
    const _statusNames  = getStatusNames();
    statuses.forEach(([k, v], i) => {
      const col = _statusColors[k] || '#aaaaaa';
      const displayName = _statusNames[k] || k;
      const badge = this.add.text(i * 72 - statuses.length * 36 + 36, 0, `${displayName}\u00d7${v}`, {
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
    const _pStatusNames = getStatusNames();
    const pStatuses = Object.entries(this.playerStatuses || {}).filter(([,v]) => v > 0);
    this.playerStatusText.setText(pStatuses.map(([k,v]) => `${_pStatusNames[k] || k}\u00d7${v}`).join(' '));

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

    // Sundial: gain 2 energy every 3rd turn (turn 3, 6, 9...)
    if (this.gs.relics.includes('sundial') && this.turnNumber % 3 === 0) this.energy += 2;

    // Thorns: grant block equal to thorns stacks at start of turn
    if (this.playerStatuses?.thorns > 0) this.playerBlock += this.playerStatuses.thorns;

    const fakePlayer = { hp: this.gs.hp, maxHp: this.gs.maxHp, block: this.playerBlock, statuses: this.playerStatuses };
    CardEngine.tickStatuses(fakePlayer);
    this.gs.hp = fakePlayer.hp;
    this.playerBlock = fakePlayer.block;
    this.playerStatuses = fakePlayer.statuses;

    const drawBonusThisTurn = (this.turnNumber === 1) ? (this._pendingDrawBonus || 0) : 0;
    this._pendingDrawBonus = 0;
    this._drawCards(HAND_SIZE + (this.gs.relics.includes('laser_toy') ? 1 : 0) + drawBonusThisTurn);
    this._updateStatsDisplay();
    this._renderHand();
    this._showTurnBanner('YOUR TURN', '#4caf50');

    if (this.gs.hp <= 0) this._playerDied();
  }

  _drawCards(count) {
    let drew = 0;
    for (let i = 0; i < count; i++) {
      if (this.drawPile.length === 0) {
        this.drawPile = [...this.discardPile].sort(() => Math.random() - 0.5);
        this.discardPile = [];
        if (this.gs.relics.includes('hairball')) this.enemy.hp -= 3;
        this._showTurnBanner('Deck shuffled', '#888888');
      }
      if (this.drawPile.length > 0) { this.hand.push(this.drawPile.pop()); drew++; }
    }
    // SFX: one soft tick per drawn card (staggered via timeout to avoid overlap)
    if (drew > 0 && this.soundManager) {
      for (let d = 0; d < drew; d++) {
        this.time.delayedCall(d * 60, () => this.soundManager.play('card_draw'));
      }
    }
  }

  _renderHand() {
    if (this.handObjects) this.handObjects.forEach(c => c.destroy(true));
    this.handObjects = [];
    if (this._emptyHandText) { this._emptyHandText.destroy(); this._emptyHandText = null; }

    if (this.hand.length === 0) {
      this._emptyHandText = this.add.text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 120, 'No cards in hand', {
        fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#555555'
      }).setOrigin(0.5);
      return;
    }

    const cardW = 118, cardH = 158;
    const n = this.hand.length;
    const arcRadius = 900;
    const arcCenterX = SCREEN_WIDTH / 2;
    const arcCenterY = SCREEN_HEIGHT - 102 + arcRadius;

    // Spread angle compression by hand size; cap so cards stay on screen.
    // 5 or fewer cards: 60 degrees total. Each extra card beyond 5 trims 5 degrees,
    // with a hard floor of 10 degrees so cards never fully stack.
    const maxTotalDeg = n <= 5 ? 60 : Math.max(10, 60 - (n - 5) * 5);
    const mood = this.gs.getDominantPersonality();

    this.hand.forEach((cardId, i) => {
      const card = this.cardDb[cardId];
      if (!card) return;

      const angle = n === 1 ? 0 : -maxTotalDeg / 2 + maxTotalDeg * i / (n - 1);
      const rad = angle * Math.PI / 180;
      // Clamp x so no card centre escapes the screen (half-card margin on each side).
      const rawX = arcCenterX + arcRadius * Math.sin(rad);
      const baseX = Math.max(cardW / 2, Math.min(SCREEN_WIDTH - cardW / 2, rawX));
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

      // Keyboard shortcut hint — only show for first 6 cards
      const keyLabels = ['1','2','3','4','5','6'];
      const keyHint = i < 6 ? this.add.text(cardW / 2 - 8, cardH / 2 - 10, keyLabels[i], {
        fontFamily: '"Press Start 2P"', fontSize: '7px', color: canPlay ? '#ffd70099' : '#33333399'
      }).setOrigin(1, 1).setDepth(4).setAlpha(0.6) : null;

      container.add([shadow, bg, border, pip, ...artItems, nameText, costText, descText, ...(keyHint ? [keyHint] : [])]);

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
      } else {
        container.on('pointerover', () => {
          container.setTint(0xff6666);
        });
        container.on('pointerout', () => {
          container.clearTint();
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

    // SFX: card play
    this.soundManager.play('card_play');

    const prevPersonality = this.gs.getDominantPersonality();
    const prevMoodLocked = this.gs.personality.mood;
    this.gs.trackPersonality(card.type);
    this.gs.runStats.cards_played++;
    this.lastPlayedCard = card;

    // NAN-48: show toast when personality changes this turn
    const newPersonality = this.gs.getDominantPersonality();
    const newMoodLocked = this.gs.personality.mood;
    if (newPersonality !== prevPersonality || newMoodLocked !== prevMoodLocked) {
      const moodInfo = newPersonality ? PersonalitySystem.getMoodDescription(newPersonality) : null;
      if (moodInfo) {
        this._showPersonalityToast(`\u2192 ${moodInfo.name}`, moodInfo.color);
      }
    }

    const prevHp = this.gs.hp;
    const prevBlock = this.playerBlock;
    const player = { hp: this.gs.hp, maxHp: this.gs.maxHp, block: this.playerBlock, statuses: this.playerStatuses };
    const results = CardEngine.resolveCard(card, { player, enemy: this.enemy, hand: this.hand, drawPile: this.drawPile, discardPile: this.discardPile, relics: this.gs.relics, modifiers: { glass_cannon: this.gs.hasModifier && this.gs.hasModifier('glass_cannon') } }, mood);

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
      // SFX: damage dealt
      this.soundManager.play('damage_dealt');
    }
    // Show heal if hp increased
    if (this.gs.hp > prevHp) {
      this._showHealNumber(100, SCREEN_HEIGHT - 220, this.gs.hp - prevHp);
      // SFX: heal
      this.soundManager.play('heal');
    }

    this._updateStatsDisplay();

    // Flash block display when block increases (NAN-124)
    if (this.playerBlock > prevBlock && this.playerBlockLabel) {
      this.tweens.add({ targets: this.playerBlockLabel, alpha: { from: 1, to: 0.3 }, duration: 120, yoyo: true });
    }

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

    // Check for scry result — show overlay before re-rendering hand
    const scryResult = results.find(r => r.scry > 0);
    if (scryResult) {
      // Read the keep limit from the card's effect definition
      const scryEffect = card.effects.find(e => e.type === 'scry');
      this._scryKeepLimit = scryEffect ? (scryEffect.keep || scryResult.scry) : scryResult.scry;
      this._showScryOverlay(scryResult.scry, () => {
        this._renderHand();
        if (this.enemy.hp <= 0) this._enemyDefeated();
        if (this.gs.hp <= 0) this._playerDied();
      });
      return;
    }

    this._renderHand();

    if (this.enemy.hp <= 0) this._enemyDefeated();
    if (this.gs.hp <= 0) this._playerDied();
  }

  _showScryOverlay(count, onDone) {
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;

    // Cunning personality bonus: scry 1 extra card
    const mood = this.gs.personality.mood;
    const actualCount = (mood === 'CUNNING') ? count + 1 : count;

    // Take cards from top of draw pile (pop = top)
    const available = Math.min(actualCount, this.drawPile.length);
    const scryCards = [];
    for (let i = 0; i < available; i++) {
      scryCards.push(this.drawPile.pop());
    }

    if (scryCards.length === 0) {
      onDone();
      return;
    }

    // Determine keep limit from the card effect
    // We pass the raw count from the effect — the keep value is stored on the effect itself.
    // Since we can't access the card here, we default to keeping up to all scried cards.
    // The caller passes the effect's value; keep limit must be derived from the played card.
    // We'll expose keepLimit via a property set just before this call, or fall back to all.
    const keepLimit = this._scryKeepLimit !== undefined ? this._scryKeepLimit : scryCards.length;
    this._scryKeepLimit = undefined;

    // Track which cards are marked "keep" (toggled by clicking)
    const keptSet = new Set();

    const overlay = this.add.container(0, 0).setDepth(20);

    // Dark backdrop (non-interactive — only the confirm button closes this)
    const backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72).setDepth(20);
    overlay.add(backdrop);

    // Title
    const title = this.add.text(W / 2, 60, `SCRY — choose up to ${keepLimit} card${keepLimit !== 1 ? 's' : ''} to keep`, {
      fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#ffd700',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(21);
    overlay.add(title);

    const subtitle = this.add.text(W / 2, 84, 'Click a card to keep it (gold). Others go to bottom of draw pile.', {
      fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#aaaaaa'
    }).setOrigin(0.5).setDepth(21);
    overlay.add(subtitle);

    // Lay out cards in a row centred on screen, above the hand area
    const cardW = 118, cardH = 158;
    const gap = 14;
    const totalWidth = scryCards.length * cardW + (scryCards.length - 1) * gap;
    const startX = W / 2 - totalWidth / 2 + cardW / 2;
    const cardY = H / 2 - 20;

    const cardContainers = [];

    const refreshCardVisuals = () => {
      cardContainers.forEach(({ container, cardId, bg, border, nameText, costText, descText }) => {
        const isKept = keptSet.has(cardId + '_' + container.getData('idx'));
        bg.setFillStyle(isKept ? 0x1a3a1a : 0x111622);
        const card = this.cardDb[cardId];
        const typeColor = CARD_TYPE_COLORS[card ? card.type : 'skill'] || 0x4fc3f7;
        border.clear();
        if (isKept) {
          border.lineStyle(3, 0xffd700);
        } else {
          border.lineStyle(2, 0x444444);
        }
        border.strokeRect(-cardW / 2, -cardH / 2, cardW, cardH);
        container.setAlpha(isKept ? 1 : 0.55);
      });
    };

    scryCards.forEach((cardId, i) => {
      const card = this.cardDb[cardId];
      const cx = startX + i * (cardW + gap);
      const container = this.add.container(cx, cardY).setDepth(22);
      container.setData('idx', i);

      const shadow = this.add.rectangle(3, 4, cardW, cardH, 0x000000, 0.4).setDepth(0);
      const bg = this.add.rectangle(0, 0, cardW, cardH, 0x111622).setDepth(1);
      const border = this.add.graphics().setDepth(2);
      border.lineStyle(2, 0x444444);
      border.strokeRect(-cardW / 2, -cardH / 2, cardW, cardH);

      const typeColor = card ? (CARD_TYPE_COLORS[card.type] || 0x666666) : 0x666666;
      const pip = this.add.rectangle(cardW / 2 - 10, -cardH / 2 + 10, 18, 18, typeColor).setDepth(3);

      const nameText = this.add.text(0, -61, card ? card.name : '?', {
        fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#f0ead6',
        wordWrap: { width: 104 }, align: 'center'
      }).setOrigin(0.5).setDepth(3);

      const cost = card ? card.cost : '?';
      const costText = this.add.text(-cardW / 2 + 8, -cardH / 2 + 8, `${cost}`, {
        fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#ffd700'
      }).setDepth(3);

      const descText = this.add.text(0, 36, card ? card.description : '', {
        fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#aaaaaa',
        wordWrap: { width: 104 }, align: 'center'
      }).setOrigin(0.5).setDepth(3);

      container.add([shadow, bg, border, pip, nameText, costText, descText]);
      container.setInteractive(
        new Phaser.Geom.Rectangle(-cardW / 2, -cardH / 2, cardW, cardH),
        Phaser.Geom.Rectangle.Contains
      );

      const slotKey = cardId + '_' + i;
      container.on('pointerdown', () => {
        if (keptSet.has(slotKey)) {
          keptSet.delete(slotKey);
        } else if (keptSet.size < keepLimit) {
          keptSet.add(slotKey);
        }
        refreshCardVisuals();
      });
      container.on('pointerover', () => {
        if (!keptSet.has(slotKey)) container.setAlpha(0.75);
      });
      container.on('pointerout', () => {
        refreshCardVisuals();
      });

      cardContainers.push({ container, cardId, bg, border, nameText, costText, descText });
      overlay.add(container);
    });

    refreshCardVisuals();

    // Confirm button
    const btnY = H - 80;
    const btnBg = this.add.rectangle(W / 2, btnY, 200, 44, 0x1a2a0a).setDepth(22);
    const btnBorder = this.add.graphics().setDepth(22);
    btnBorder.lineStyle(2, 0xffd700);
    btnBorder.strokeRect(W / 2 - 100, btnY - 22, 200, 44);
    const btnText = this.add.text(W / 2, btnY, 'CONFIRM', {
      fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#ffd700'
    }).setOrigin(0.5).setDepth(23);
    const btnZone = this.add.rectangle(W / 2, btnY, 200, 44, 0xffffff, 0)
      .setDepth(24).setInteractive({ useHandCursor: true });
    btnZone.on('pointerover', () => btnBg.setFillStyle(0x2a4a10));
    btnZone.on('pointerout', () => btnBg.setFillStyle(0x1a2a0a));
    btnZone.on('pointerdown', () => {
      // Kept cards go to hand; the rest go to the bottom of the draw pile
      const keptIndices = new Set([...keptSet].map(k => parseInt(k.split('_').pop(), 10)));
      const toBottom = [];
      scryCards.forEach((cid, i) => {
        if (keptIndices.has(i)) {
          this.hand.push(cid);
        } else {
          toBottom.push(cid);
        }
      });
      // Insert at front of drawPile (bottom of deck — pop() draws from the end/top)
      this.drawPile.unshift(...toBottom);

      overlay.destroy(true);
      this._updateStatsDisplay();
      onDone();
    });
    overlay.add([btnBg, btnBorder, btnText, btnZone]);

    // Fade in
    overlay.setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 160 });
  }

  _endPlayerTurn() {
    // Mirror relic: replay the last card played this turn at end of turn
    if (this.gs.relics.includes('mirror') && this.lastPlayedCard) {
      const cardToReplay = this.lastPlayedCard;
      // Reset before replaying so the replay itself cannot re-trigger mirror (infinite loop guard)
      this.lastPlayedCard = null;
      // Ensure mirror replay never benefits from coffee_mug's free-first-card effect;
      // that bonus applies only to cards the player explicitly plays, not mirror replays.
      this.coffeeMugUsed = true;
      const mood = this.gs.getDominantPersonality();
      const player = { hp: this.gs.hp, maxHp: this.gs.maxHp, block: this.playerBlock, statuses: this.playerStatuses };
      // Pass relics without 'mirror' to prevent the replay from triggering mirror again
      const relicsWithoutMirror = this.gs.relics.filter(r => r !== 'mirror');
      const results = CardEngine.resolveCard(cardToReplay, { player, enemy: this.enemy, hand: this.hand, drawPile: this.drawPile, discardPile: this.discardPile, relics: relicsWithoutMirror, modifiers: { glass_cannon: this.gs.hasModifier && this.gs.hasModifier('glass_cannon') } }, mood);
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
      const result = CardEngine.executeEnemyMove(move, this.enemy, player, {
        relentless: this.gs.hasModifier && this.gs.hasModifier('relentless')
      });

      this.gs.hp = player.hp;
      this.playerBlock = player.block;
      this.playerStatuses = player.statuses;
      if (result.type === 'attack') {
        this.gs.runStats.damage_taken += result.amount;
        const dmgTaken = prevHp - this.gs.hp;
        if (dmgTaken > 0) {
          this._showDamageNumber(100, SCREEN_HEIGHT - 240, dmgTaken, '#ff8888');
          this.cameras.main.shake(150, 0.008);
          if (dmgTaken >= 10) this.cameras.main.shake(150, 0.02);
          // Hit-flash on player HP bar area
          const flashRect = this.add.rectangle(170, SCREEN_HEIGHT - 173, 200, 14, 0xffffff, 0.85).setDepth(5);
          this.tweens.add({ targets: flashRect, alpha: 0, duration: 200, onComplete: () => flashRect.destroy() });
          // SFX: player hit
          this.soundManager.play('player_hit');
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
    // SFX: victory fanfare
    this.soundManager.play('victory');
    this.time.delayedCall(delay, () => {
      const victoryBg = this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, 500, 90, 0x000000, 0.85).setDepth(20);
      this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, `VICTORY!  +${goldGain} 💰`, {
        fontFamily: '"Press Start 2P"', fontSize: '28px', color: '#ffd700'
      }).setOrigin(0.5).setDepth(21);

      this.time.delayedCall(1500, () => {
        if (this.isBoss && this.gs.act >= 3) {
          this.gs.saveScore(true);
          this.gs.endRun();
          this.scene.start('RunSummaryScene', { won: true });
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
      // Enemy flinch: slide left -8px then back over 100ms
      this.tweens.add({ targets: this.enemySprite, x: this.enemySprite.x - 8, duration: 50, yoyo: true, ease: 'Power1' });
      // Hit-flash tint: white then back to normal over ~200ms
      if (this.enemySprite.setTint) {
        this.enemySprite.setTint(0xffffff);
        this.time.delayedCall(200, () => { if (this.enemySprite?.clearTint) this.enemySprite.clearTint(); });
      }
    }
  }

  _showCardTooltip(card, cost, x, y) {
    // Determine if this card is already upgraded
    const isUpgraded = card.id ? /_u(_\w+)?$/.test(card.id) : false;

    // Find upgrade variant: prefer mood-specific, fall back to default
    const mood = this.gs.getDominantPersonality();
    let upgradeData = null;
    let upgradeLabel = null;
    if (!isUpgraded && card.upgrades) {
      const moodUpgrade = mood && card.upgrades[mood];
      const defaultUpgrade = card.upgrades.default;
      upgradeData = moodUpgrade || defaultUpgrade || null;
      if (upgradeData) {
        upgradeLabel = moodUpgrade ? `Upgraded (${mood}):` : 'Upgraded:';
      }
    }

    // Build upgrade description by diffing effects
    let upgradeDesc = null;
    if (upgradeData && upgradeData.effects) {
      const baseEffects  = card.effects || [];
      const upgEffects   = upgradeData.effects;
      const parts = [];

      upgEffects.forEach((ue, i) => {
        const be = baseEffects[i];
        if (!be) { parts.push(`+${ue.type}`); return; }
        const diff = ue.value - be.value;
        if (diff === 0) return;
        const sign = diff > 0 ? '+' : '';
        const typeName = ue.type === 'damage' ? 'dmg'
          : ue.type === 'block' ? 'block'
          : ue.type === 'draw' ? 'draw'
          : ue.type === 'apply_status' ? ue.status
          : ue.type === 'apply_self_status' ? ue.status
          : ue.type === 'gain_energy' ? 'energy'
          : ue.type === 'heal' ? 'heal'
          : ue.type;
        parts.push(`${sign}${diff} ${typeName}`);
      });
      if (parts.length > 0) upgradeDesc = parts.join(', ');
      else upgradeDesc = 'Improved effect';
    }

    const hasUpgrade = upgradeData && upgradeDesc;
    const W = 220;
    const baseH = 290;
    const H = hasUpgrade ? baseH + 68 : baseH;

    const clampedX = Math.max(W / 2 + 10, Math.min(SCREEN_WIDTH - W / 2 - 10, x));
    const clampedY = Math.max(H / 2 + 10, Math.min(SCREEN_HEIGHT - H / 2 - 10, y));

    const tip = this.add.container(clampedX, clampedY).setDepth(100);
    const typeColor = CARD_TYPE_COLORS[card.type] || 0x666666;

    // Panel background + border
    const bg = this.add.rectangle(0, 0, W, H, 0x08081a);
    const border = this.add.graphics();
    border.lineStyle(3, typeColor);
    border.strokeRect(-W / 2, -H / 2, W, H);

    // Type banner
    const typeBanner = this.add.rectangle(0, -H / 2 + 18, W, 32, typeColor, 0.3);
    const typeLabel = this.add.text(0, -H / 2 + 18, card.type.toUpperCase(), {
      fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ffffff'
    }).setOrigin(0.5);

    // Card name
    const nameText = this.add.text(0, -H / 2 + 50, card.name, {
      fontFamily: '"Press Start 2P"', fontSize: '11px', color: isUpgraded ? '#ffd700' : '#f0d080',
      wordWrap: { width: W - 20 }, align: 'center'
    }).setOrigin(0.5);

    // Cost
    const costLabel = this.add.text(0, -H / 2 + 76, `Cost: ${cost} ⚡`, {
      fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ffcc44'
    }).setOrigin(0.5);

    // Separator
    const sep = this.add.graphics();
    sep.lineStyle(1, 0x333355);
    sep.lineBetween(-W / 2 + 12, -H / 2 + 94, W / 2 - 12, -H / 2 + 94);

    // Description
    const descText = this.add.text(0, -H / 2 + 130, card.description, {
      fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#cccccc',
      wordWrap: { width: 260 }, align: 'center'
    }).setOrigin(0.5);

    // Already-upgraded badge
    const items = [bg, border, typeBanner, typeLabel, nameText, costLabel, sep, descText];

    if (isUpgraded) {
      const upgBadge = this.add.text(0, H / 2 - 22, '✦ UPGRADED', {
        fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#ffd700'
      }).setOrigin(0.5);
      items.push(upgBadge);
    }

    // Upgrade preview section
    if (hasUpgrade) {
      const dividerY = H / 2 - 72;
      const upgSep = this.add.graphics();
      upgSep.lineStyle(1, 0xffd700, 0.4);
      upgSep.lineBetween(-W / 2 + 12, dividerY, W / 2 - 12, dividerY);

      const upgBg = this.add.rectangle(0, H / 2 - 38, W, 64, 0x1a1a08, 0.9);
      const upgHeader = this.add.text(0, dividerY + 12, upgradeLabel, {
        fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd700'
      }).setOrigin(0.5);
      const upgDescText = this.add.text(0, dividerY + 34, upgradeDesc, {
        fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#ffe080',
        wordWrap: { width: W - 24 }, align: 'center'
      }).setOrigin(0.5);

      items.push(upgSep, upgBg, upgHeader, upgDescText);
    }

    tip.add(items);
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
    // SFX: death
    this.soundManager.play('death');
    this.gs.saveScore(false);
    this.gs.endRun();
    const bg = this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, 480, 90, 0x000000, 0.85).setDepth(20);
    this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, 'YOU DIED  😿', {
      fontFamily: '"Press Start 2P"', fontSize: '30px', color: '#e94560'
    }).setOrigin(0.5).setDepth(21);
    this.time.delayedCall(2000, () => this.scene.start('RunSummaryScene', { won: false }));
  }
}
