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

    if (gs.relics.includes('toy_mouse')) this.playerBlock = 3;
    // Cursed collar: start combat with 2 stacks of vulnerable
    if (gs.relics.includes('cursed_collar')) this.playerStatuses.vulnerable = 2;
    // Bell collar: enemy starts with 1 weak stack
    if (gs.relics.includes('bell_collar')) {
      if (!this.enemy.statuses) this.enemy.statuses = {};
      this.enemy.statuses.weak = (this.enemy.statuses.weak || 0) + 1;
    }
    if (this.pendingEnemyDamage > 0) {
      this.enemy.hp = Math.max(0, this.enemy.hp - this.pendingEnemyDamage);
    }

    this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, COLORS.BG);

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

  _showDamageNumber(x, y, amount, color = '#ff4444') {
    const txt = this.add.text(x, y, `-${amount}`, {
      fontFamily: '"Press Start 2P"', fontSize: '20px', color,
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: txt, y: y - 80, alpha: 0, duration: 900, ease: 'Power2', onComplete: () => txt.destroy() });
  }

  _showHealNumber(x, y, amount) {
    const txt = this.add.text(x, y, `+${amount}`, {
      fontFamily: '"Press Start 2P"', fontSize: '16px', color: '#4caf50',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: txt, y: y - 60, alpha: 0, duration: 800, ease: 'Power2', onComplete: () => txt.destroy() });
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

    this.enemyBlockText = this.add.text(W/2, 285, '', { fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#4fc3f7', stroke: '#000000', strokeThickness: 1 }).setOrigin(0.5);
    this.enemyStatusContainer = this.add.container(W/2, 310).setDepth(5);
    this.enemyIntentText = this.add.text(W/2, 335, '', { fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#cccccc', stroke: '#000000', strokeThickness: 1 }).setOrigin(0.5);

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

    // Act indicator top-left
    this.add.text(20, 22, `ACT ${this.gs.act}${this.isBoss ? ' — BOSS' : this.isElite ? ' — ELITE' : ''}`, {
      fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#666666'
    });

    this._updateStatsDisplay();
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

    // Enemy intent
    const move = this.enemy.movePattern[this.enemy.moveIndex % this.enemy.movePattern.length];
    const intentIcon = move.type === 'attack' ? '⚔️' : move.type === 'block' ? '🛡' : '✨';
    this.enemyIntentText.setText(`${intentIcon} ${move.desc}`);

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
    if (this.handObjects) this.handObjects.forEach(o => o.destroy());
    this.handObjects = [];

    const cardW = 118, cardH = 158, gap = 12;
    const totalW = this.hand.length * (cardW + gap) - gap;
    const startX = (SCREEN_WIDTH - totalW) / 2 + cardW / 2;
    const y = SCREEN_HEIGHT - 102;

    this.hand.forEach((cardId, i) => {
      const card = this.cardDb[cardId];
      if (!card) return;

      const x = startX + i * (cardW + gap);
      const mood = this.gs.getDominantPersonality();
      const cost = PersonalitySystem.getCardCost(card, mood);
      const canPlay = this.energy >= cost;
      const typeColor = CARD_TYPE_COLORS[card.type] || 0x666666;

      // Shadow
      const shadow = this.add.rectangle(x + 3, y + 4, cardW, cardH, 0x000000, 0.4).setDepth(4);

      // Card body
      const bg = this.add.rectangle(x, y, cardW, cardH, canPlay ? 0x1e2a4a : 0x111622)
        .setInteractive({ useHandCursor: canPlay }).setDepth(5);

      // Colored type border (3px)
      const border = this.add.graphics().setDepth(6);
      border.lineStyle(3, canPlay ? typeColor : 0x444444);
      border.strokeRect(x - cardW/2, y - cardH/2, cardW, cardH);

      // Type pip (top-right corner)
      const pip = this.add.rectangle(x + cardW/2 - 10, y - cardH/2 + 10, 18, 18, typeColor).setDepth(7);

      // Upgraded card — gold shimmer on left edge
      if (cardId.endsWith('_u')) {
        border.lineStyle(3, 0xffd700);
        border.strokeRect(x - cardW/2, y - cardH/2, cardW, cardH);
      }

      // Card texts
      const nameText = this.add.text(x, y - 52, card.name, {
        fontFamily: '"Press Start 2P"', fontSize: '9px',
        color: canPlay ? '#f0ead6' : '#666666',
        wordWrap: { width: 104 }, align: 'center'
      }).setOrigin(0.5).setDepth(8);

      const costText = this.add.text(x - cardW/2 + 8, y - cardH/2 + 8, `${cost}`, {
        fontFamily: '"Press Start 2P"', fontSize: '11px', color: canPlay ? '#ffd700' : '#555555'
      }).setDepth(8);

      const descText = this.add.text(x, y + 18, card.description, {
        fontFamily: '"Press Start 2P"', fontSize: '8px',
        color: canPlay ? '#aaaaaa' : '#444444',
        wordWrap: { width: 104 }, align: 'center'
      }).setOrigin(0.5).setDepth(8);

      if (canPlay) {
        bg.on('pointerover', () => {
          bg.setFillStyle(0x2e3f6e);
          border.clear();
          border.lineStyle(3, typeColor === 0xffd700 ? 0xffee55 : Phaser.Display.Color.IntegerToColor(typeColor).brighten(30).color32);
          border.strokeRect(x - cardW/2, y - cardH/2, cardW, cardH);
        });
        bg.on('pointerout', () => {
          bg.setFillStyle(0x1e2a4a);
          border.clear();
          border.lineStyle(3, typeColor);
          border.strokeRect(x - cardW/2, y - cardH/2, cardW, cardH);
        });
        bg.on('pointerdown', () => {
          bg.setFillStyle(0xffd700);
          this.time.delayedCall(80, () => this._playCard(cardId, i));
        });
      }

      this.handObjects.push(shadow, bg, border, pip, nameText, costText, descText);
    });

    // Animate each card sliding up from below, staggered
    const objectsPerCard = 7;
    this.hand.forEach((_, i) => {
      const start = i * objectsPerCard;
      const cardObjs = this.handObjects.slice(start, start + objectsPerCard);
      cardObjs.forEach(o => {
        if (o && o.y !== undefined) o.y += 55;
        if (o) o.setAlpha(0);
      });
      this.tweens.add({
        targets: cardObjs,
        y: '-=55',
        alpha: 1,
        duration: 180,
        delay: i * 55,
        ease: 'Back.easeOut'
      });
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
    }
    // Show heal if hp increased
    if (this.gs.hp > prevHp) {
      this._showHealNumber(100, SCREEN_HEIGHT - 220, this.gs.hp - prevHp);
    }

    this._updateStatsDisplay();

    // Card play animation: spawn ghost at played card's position, zoom to center, fade
    const cardW = 118, cardH = 158, gap = 12;
    // Calculate position of the played card BEFORE hand was spliced (hand.length + 1 was the original size)
    const origLen = this.hand.length + 1; // hand already spliced above
    const totalW = origLen * (cardW + gap) - gap;
    const startX = (SCREEN_WIDTH - totalW) / 2 + cardW / 2;
    const playedX = startX + handIndex * (cardW + gap);
    const playedY = SCREEN_HEIGHT - 102;

    const ghost = this.add.rectangle(playedX, playedY, cardW, cardH,
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

    this._renderHand();

    if (this.enemy.hp <= 0) this._enemyDefeated();
    if (this.gs.hp <= 0) this._playerDied();
  }

  _endPlayerTurn() {
    this.discardPile.push(...this.hand);
    this.hand = [];
    if (this.handObjects) this.handObjects.forEach(o => o.destroy());
    this.handObjects = [];

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
        if (dmgTaken > 0) this._showDamageNumber(100, SCREEN_HEIGHT - 240, dmgTaken, '#ff8888');
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
  }

  _flashAttack() {
    if (this.heroSprite) {
      this.tweens.add({ targets: this.heroSprite, x: this.heroSprite.x + 34, duration: 75, yoyo: true });
    }
    if (this.enemySprite) {
      this.tweens.add({ targets: this.enemySprite, alpha: 0.2, duration: 75, yoyo: true, repeat: 1 });
    }
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
