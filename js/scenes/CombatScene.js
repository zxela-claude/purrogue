import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS, ENERGY_PER_TURN, HAND_SIZE } from '../constants.js';
import { CardEngine } from '../CardEngine.js';
import { PersonalitySystem } from '../PersonalitySystem.js';
import { getRandomEnemy, getBoss } from '../data/enemies.js';
import { WARRIOR_CARDS, MAGE_CARDS, ROGUE_CARDS } from '../data/cards.js';

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
      const upgEffects = card.upgrades?.default?.effects;
      if (upgEffects) {
        this.cardDb[card.id + '_u'] = { ...card, id: card.id + '_u', name: card.name + '+', effects: upgEffects };
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

    // Apply bonus block relic
    if (gs.relics.includes('toy_mouse')) this.playerBlock = 3;

    // Apply pre-combat enemy damage from events
    if (this.pendingEnemyDamage > 0) {
      this.enemy.hp = Math.max(0, this.enemy.hp - this.pendingEnemyDamage);
    }

    this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, COLORS.BG);

    this._drawUI();
    this._startPlayerTurn();
  }

  _drawUI() {
    const gs = this.gs;

    // Enemy area
    this.enemyNameText = this.add.text(SCREEN_WIDTH/2, 40, this.enemy.name, { fontFamily: '"Press Start 2P"', fontSize: '16px', color: '#e94560' }).setOrigin(0.5);
    this.enemyHpText = this.add.text(SCREEN_WIDTH/2, 75, `HP: ${this.enemy.hp}/${this.enemy.maxHp}`, { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#f0ead6' }).setOrigin(0.5);
    this.enemyBlockText = this.add.text(SCREEN_WIDTH/2, 100, '', { fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#4fc3f7' }).setOrigin(0.5);
    this.enemyStatusText = this.add.text(SCREEN_WIDTH/2, 120, '', { fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ffd700' }).setOrigin(0.5);
    this.enemyIntentText = this.add.text(SCREEN_WIDTH/2, 145, '', { fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#aaaaaa' }).setOrigin(0.5);

    // Enemy sprite — use generated asset if available, else colored rect fallback
    const enemySpriteKey = this.enemy.id;
    const enemyTexture = this.textures.exists(enemySpriteKey) ? enemySpriteKey : null;
    if (enemyTexture) {
      this.enemySprite = this.add.image(SCREEN_WIDTH/2, 280, enemyTexture).setDisplaySize(140, 140);
    } else {
      this.enemySprite = this.add.rectangle(SCREEN_WIDTH/2, 280, 120, 120, 0x9b59b6);
      this.add.text(SCREEN_WIDTH/2, 280, '👾', { fontSize: '64px' }).setOrigin(0.5);
    }

    // Player hero sprite (bottom-left)
    const heroKey = gs.hero ? gs.hero.toLowerCase() + '_idle' : null;
    if (heroKey && this.textures.exists(heroKey)) {
      this.heroSprite = this.add.image(80, SCREEN_HEIGHT - 220, heroKey).setDisplaySize(100, 100);
    }

    // Player stats
    this.playerHpText = this.add.text(20, SCREEN_HEIGHT - 180, '', { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#4caf50' });
    this.playerBlockText = this.add.text(20, SCREEN_HEIGHT - 160, '', { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#4fc3f7' });
    this.energyText = this.add.text(20, SCREEN_HEIGHT - 140, '', { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#ffd700' });

    // End turn button
    this.endTurnBtn = this.add.text(SCREEN_WIDTH - 20, SCREEN_HEIGHT - 160, '[ END TURN ]', {
      fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#e94560'
    }).setOrigin(1).setInteractive({ useHandCursor: true }).on('pointerdown', () => this._endPlayerTurn());

    // Personality indicator
    const mood = gs.getDominantPersonality();
    if (mood) {
      const moodInfo = PersonalitySystem.getMoodDescription(mood);
      if (moodInfo) {
        this.add.text(SCREEN_WIDTH - 20, 20, `${moodInfo.name}`, { fontFamily: '"Press Start 2P"', fontSize: '10px', color: moodInfo.color }).setOrigin(1, 0);
      }
    }

    // Deck/discard counts
    this.deckCountText = this.add.text(20, SCREEN_HEIGHT - 40, '', { fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#aaaaaa' });
    this.discardCountText = this.add.text(200, SCREEN_HEIGHT - 40, '', { fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#aaaaaa' });

    this._updateStatsDisplay();
  }

  _updateStatsDisplay() {
    const gs = this.gs;
    this.playerHpText.setText(`❤️ ${gs.hp}/${gs.maxHp}`);
    this.playerBlockText.setText(`🛡 ${this.playerBlock}`);
    this.energyText.setText(`⚡ ${this.energy}/${this.maxEnergy}`);
    this.enemyHpText.setText(`HP: ${this.enemy.hp}/${this.enemy.maxHp}`);
    this.enemyBlockText.setText(this.enemy.block > 0 ? `🛡 ${this.enemy.block}` : '');

    const statuses = Object.entries(this.enemy.statuses || {}).filter(([,v]) => v > 0);
    this.enemyStatusText.setText(statuses.map(([k,v]) => `${k}:${v}`).join(' '));

    this.deckCountText.setText(`📚 ${this.drawPile.length}`);
    this.discardCountText.setText(`🗑 ${this.discardPile.length}`);

    // Enemy intent
    const move = this.enemy.movePattern[this.enemy.moveIndex % this.enemy.movePattern.length];
    this.enemyIntentText.setText(`Intent: ${move.desc}`);
  }

  _startPlayerTurn() {
    this.turnNumber++;
    this.gs.runStats.turns++;
    this.energy = this.maxEnergy;
    this.playerBlock = 0; // Block resets each turn

    // Tick player statuses
    const fakePlayer = { hp: this.gs.hp, maxHp: this.gs.maxHp, block: this.playerBlock, statuses: this.playerStatuses };
    CardEngine.tickStatuses(fakePlayer);
    this.gs.hp = fakePlayer.hp;
    this.playerBlock = fakePlayer.block;
    this.playerStatuses = fakePlayer.statuses;

    this._drawCards(HAND_SIZE + (this.gs.relics.includes('laser_toy') ? 1 : 0));
    this._updateStatsDisplay();
    this._renderHand();

    if (this.gs.hp <= 0) this._playerDied();
  }

  _drawCards(count) {
    for (let i = 0; i < count; i++) {
      if (this.drawPile.length === 0) {
        this.drawPile = [...this.discardPile].sort(() => Math.random() - 0.5);
        this.discardPile = [];
        // Hairball relic
        if (this.gs.relics.includes('hairball')) this.enemy.hp -= 3;
      }
      if (this.drawPile.length > 0) {
        this.hand.push(this.drawPile.pop());
      }
    }
  }

  _renderHand() {
    // Clear existing hand display
    if (this.handObjects) this.handObjects.forEach(o => o.destroy());
    this.handObjects = [];

    const cardW = 120, cardH = 160;
    const totalW = this.hand.length * (cardW + 10);
    const startX = (SCREEN_WIDTH - totalW) / 2 + cardW / 2;
    const y = SCREEN_HEIGHT - 100;

    this.hand.forEach((cardId, i) => {
      const card = this.cardDb[cardId];
      if (!card) return;

      const x = startX + i * (cardW + 10);
      const mood = this.gs.getDominantPersonality();
      const cost = PersonalitySystem.getCardCost(card, mood);
      const canPlay = this.energy >= cost;

      const bg = this.add.rectangle(x, y, cardW, cardH, canPlay ? 0x2a2a5e : 0x1a1a2e)
        .setInteractive({ useHandCursor: canPlay })
        .setDepth(5);

      const nameText = this.add.text(x, y - 55, card.name, { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#f0ead6', wordWrap: { width: 110 }, align: 'center' }).setOrigin(0.5).setDepth(6);
      const costText = this.add.text(x - 48, y - 68, `${cost}⚡`, { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffd700' }).setDepth(6);
      const descText = this.add.text(x, y + 10, card.description, { fontFamily: '"Press Start 2P"', fontSize: '6px', color: '#aaaaaa', wordWrap: { width: 110 }, align: 'center' }).setOrigin(0.5).setDepth(6);

      if (canPlay) {
        bg.on('pointerover', () => bg.setFillStyle(0x3a3a7e));
        bg.on('pointerout', () => bg.setFillStyle(0x2a2a5e));
        bg.on('pointerdown', () => this._playCard(cardId, i));
      }

      this.handObjects.push(bg, nameText, costText, descText);
    });
  }

  _playCard(cardId, handIndex) {
    const card = this.cardDb[cardId];
    const mood = this.gs.getDominantPersonality();
    const cost = PersonalitySystem.getCardCost(card, mood);
    if (this.energy < cost) return;

    this.energy -= cost;
    this.hand.splice(handIndex, 1);
    this.discardPile.push(cardId);

    // Track personality
    this.gs.trackPersonality(card.type);
    this.gs.runStats.cards_played++;

    // Resolve effects
    const player = { hp: this.gs.hp, maxHp: this.gs.maxHp, block: this.playerBlock, statuses: this.playerStatuses };
    const results = CardEngine.resolveCard(card, { player, enemy: this.enemy, hand: this.hand, drawPile: this.drawPile, discardPile: this.discardPile }, mood);

    // Apply results back
    this.gs.hp = player.hp;
    this.playerBlock = player.block;
    this.playerStatuses = player.statuses;

    // Handle draw
    const draws = results.filter(r => r.type === 'draw').reduce((s, r) => s + r.amount, 0);
    if (draws > 0) this._drawCards(draws);

    // Handle energy
    const energyGain = results.filter(r => r.type === 'gain_energy').reduce((s, r) => s + r.amount, 0);
    this.energy += energyGain;

    // Track damage + animate hero/enemy
    const dmg = results.filter(r => r.type === 'damage').reduce((s, r) => s + r.amount, 0);
    this.gs.runStats.damage_dealt += dmg;
    if (dmg > 0) this._flashAttack();

    this._updateStatsDisplay();
    this._renderHand();

    if (this.enemy.hp <= 0) this._enemyDefeated();
    if (this.gs.hp <= 0) this._playerDied();
  }

  _endPlayerTurn() {
    // Discard hand
    this.discardPile.push(...this.hand);
    this.hand = [];

    // Enemy turn
    this.endTurnBtn.removeInteractive();
    this.time.delayedCall(500, () => this._enemyTurn());
  }

  _enemyTurn() {
    // Tick enemy statuses
    if (this.enemy.statuses && this.enemy.statuses.freeze > 0) {
      // Frozen — skip turn
      CardEngine.tickStatuses(this.enemy);
      this._updateStatsDisplay();
      this.time.delayedCall(500, () => this._startPlayerTurn());
      this.endTurnBtn.setInteractive({ useHandCursor: true });
      return;
    }

    CardEngine.tickStatuses(this.enemy);
    const move = CardEngine.resolveEnemyIntent(this.enemy, null);
    const player = { hp: this.gs.hp, maxHp: this.gs.maxHp, block: this.playerBlock, statuses: this.playerStatuses };
    const result = CardEngine.executeEnemyMove(move, this.enemy, player);

    this.gs.hp = player.hp;
    this.playerBlock = player.block;
    this.playerStatuses = player.statuses;
    if (result.type === 'attack') this.gs.runStats.damage_taken += result.amount;

    // Enemy lunges, hero flashes when hit
    if (this.enemySprite) {
      this.tweens.add({ targets: this.enemySprite, x: this.enemySprite.x - 20, duration: 100, yoyo: true });
    }
    if (result.type === 'attack' && this.heroSprite) {
      this.tweens.add({ targets: this.heroSprite, alpha: 0.3, duration: 100, yoyo: true, repeat: 1 });
    }

    this._updateStatsDisplay();

    if (this.gs.hp <= 0) {
      this.time.delayedCall(500, () => this._playerDied());
    } else {
      this.time.delayedCall(600, () => {
        this.endTurnBtn.setInteractive({ useHandCursor: true });
        this._startPlayerTurn();
      });
    }
  }

  _enemyDefeated() {
    this.gs.runStats.enemies_killed++;
    const goldGain = this.isElite ? 25 + (this.gs.relics.includes('fish_snack') ? 10 : 0) : 15;
    this.gs.gold += goldGain;

    // Yarn ball relic: heal after combat
    if (this.gs.relics.includes('yarn_ball')) {
      this.gs.heal(2);
    }

    this.gs.save();

    this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, `VICTORY! +${goldGain}💰`, {
      fontFamily: '"Press Start 2P"', fontSize: '32px', color: '#ffd700'
    }).setOrigin(0.5).setDepth(20);

    this.time.delayedCall(1500, () => {
      if (this.isBoss && this.gs.act >= 3) {
        // Won the game!
        this.gs.saveScore(true);
        this.gs.endRun();
        this.scene.start('GameOverScene', { won: true });
      } else if (this.isBoss) {
        // Next act
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
    // Hero swings forward, enemy flashes red
    if (this.heroSprite) {
      this.tweens.add({ targets: this.heroSprite, x: this.heroSprite.x + 30, duration: 80, yoyo: true });
    }
    if (this.enemySprite) {
      this.tweens.add({ targets: this.enemySprite, alpha: 0.3, duration: 80, yoyo: true, repeat: 1 });
    }
  }

  _playerDied() {
    this.gs.saveScore(false);
    this.gs.endRun();
    this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, 'YOU DIED 😿', {
      fontFamily: '"Press Start 2P"', fontSize: '32px', color: '#e94560'
    }).setOrigin(0.5).setDepth(20);
    this.time.delayedCall(2000, () => this.scene.start('GameOverScene', { won: false }));
  }
}
