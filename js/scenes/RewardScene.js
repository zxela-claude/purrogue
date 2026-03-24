import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from '../constants.js';
import { PersonalitySystem } from '../PersonalitySystem.js';
import { WARRIOR_CARDS, MAGE_CARDS, ROGUE_CARDS } from '../data/cards.js';

const CARD_TYPE_COLORS = { attack: 0xe94560, skill: 0x4fc3f7, power: 0x9b59b6 };
const CARD_TYPE_LABEL_COLORS = { attack: '#e94560', skill: '#4fc3f7', power: '#bb86fc' };

export class RewardScene extends Phaser.Scene {
  constructor() { super('RewardScene'); }

  create() {
    const gs = this.registry.get('gameState');
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;

    // Catnap event: skip rewards, go straight to map
    if (gs.skipNextReward) {
      gs.skipNextReward = false;
      gs.save();
      this.scene.start('MapScene');
      return;
    }

    this.add.rectangle(W/2, H/2, W, H, COLORS.BG);

    // Decorative star field (light version)
    const gfx = this.add.graphics().setDepth(-1);
    for (let i = 0; i < 40; i++) {
      gfx.fillStyle(0xffffff, Math.random() * 0.3 + 0.05);
      gfx.fillCircle(Math.random() * W, Math.random() * H, Math.random() * 1.5 + 0.5);
    }

    // Title
    this.add.text(W/2, 55, 'CHOOSE A CARD', {
      fontFamily: '"Press Start 2P"', fontSize: '20px', color: '#ffd700',
      stroke: '#7a6000', strokeThickness: 3
    }).setOrigin(0.5);

    const heroCards = gs.hero === 'WARRIOR' ? WARRIOR_CARDS : gs.hero === 'MAGE' ? MAGE_CARDS : ROGUE_CARDS;
    const count = gs.relics.includes('lucky_paw') ? 4 : 3;
    const mood = gs.getDominantPersonality();
    const choices = this._weightedCardDraft(heroCards, gs.act, mood, count);

    choices.forEach((card, i) => {
      const x = W / (count + 1) * (i + 1);
      const cardY = 370;
      const cardW = 210, cardH = 310;
      const typeColor = CARD_TYPE_COLORS[card.type] || 0x666666;
      const typeLabelColor = CARD_TYPE_LABEL_COLORS[card.type] || '#aaaaaa';

      // Animate slide-in from below
      const cardGroup = this.add.container(x, cardY + 80).setAlpha(0);
      this.tweens.add({
        targets: cardGroup, y: cardY, alpha: 1,
        duration: 280, delay: i * 100, ease: 'Back.easeOut'
      });

      // Shadow
      const shadow = this.add.rectangle(4, 6, cardW, cardH, 0x000000, 0.45);
      cardGroup.add(shadow);

      // Card body
      const bg = this.add.rectangle(0, 0, cardW, cardH, COLORS.PANEL)
        .setInteractive({ useHandCursor: true });
      cardGroup.add(bg);

      // Colored border
      const border = this.add.graphics();
      border.lineStyle(3, typeColor);
      border.strokeRect(-cardW/2, -cardH/2, cardW, cardH);
      cardGroup.add(border);

      // Type banner at top
      const typeBanner = this.add.rectangle(0, -cardH/2 + 18, cardW, 36, typeColor, 0.25);
      cardGroup.add(typeBanner);
      const typeLabel = this.add.text(0, -cardH/2 + 18, card.type.toUpperCase(), {
        fontFamily: '"Press Start 2P"', fontSize: '11px', color: typeLabelColor
      }).setOrigin(0.5);
      cardGroup.add(typeLabel);

      // Card name
      const nameText = this.add.text(0, -cardH/2 + 54, card.name, {
        fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#f0ead6',
        wordWrap: { width: cardW - 20 }, align: 'center'
      }).setOrigin(0.5);
      cardGroup.add(nameText);

      // Cost
      const costText = this.add.text(0, -cardH/2 + 84, `Cost: ${card.cost} ⚡`, {
        fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#ffd700'
      }).setOrigin(0.5);
      cardGroup.add(costText);

      // Separator line
      const sep = this.add.graphics();
      sep.lineStyle(1, 0x444444);
      sep.lineBetween(-cardW/2 + 16, -cardH/2 + 100, cardW/2 - 16, -cardH/2 + 100);
      cardGroup.add(sep);

      // Description
      const descText = this.add.text(0, -cardH/2 + 150, card.description, {
        fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#aaaaaa',
        wordWrap: { width: cardW - 24 }, align: 'center'
      }).setOrigin(0.5);
      cardGroup.add(descText);

      // Upgrade badge
      if (mood && card.upgrades) {
        const upgradePath = PersonalitySystem.getUpgradePath(card, mood);
        if (upgradePath !== card) {
          const badge = this.add.rectangle(0, cardH/2 - 28, cardW - 20, 28, 0x1a3a1a);
          const badgeBorder = this.add.graphics();
          badgeBorder.lineStyle(1, 0x4caf50, 0.8);
          badgeBorder.strokeRect(-cardW/2 + 10, cardH/2 - 42, cardW - 20, 28);
          const badgeText = this.add.text(0, cardH/2 - 28, `✨ ${mood} upgrade ready`, {
            fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#4caf50'
          }).setOrigin(0.5);
          cardGroup.add(badge);
          cardGroup.add(badgeBorder);
          cardGroup.add(badgeText);
        }
      }

      bg.on('pointerover', () => {
        bg.setFillStyle(0x2a2a5e);
        border.clear();
        border.lineStyle(4, typeColor);
        border.strokeRect(-cardW/2, -cardH/2, cardW, cardH);
      });
      bg.on('pointerout', () => {
        bg.setFillStyle(COLORS.PANEL);
        border.clear();
        border.lineStyle(3, typeColor);
        border.strokeRect(-cardW/2, -cardH/2, cardW, cardH);
      });
      bg.on('pointerdown', () => {
        bg.setFillStyle(0xffd700);
        this.time.delayedCall(100, () => {
          gs.addCard(card.id);
          this.scene.start('MapScene');
        });
      });
    });

    // Skip
    this.add.text(W/2, H - 40, '[ SKIP ]', {
      fontFamily: '"Press Start 2P"', fontSize: '15px', color: '#555555'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', function() { this.setColor('#aaaaaa'); })
      .on('pointerout',  function() { this.setColor('#555555'); })
      .on('pointerdown', () => this.scene.start('MapScene'));
  }

  _weightedCardDraft(heroCards, act, mood, count) {
    // Rarity weights by act: [common%, uncommon%, rare%]
    const weights = act === 1 ? [70, 25, 5] : act === 2 ? [40, 40, 20] : [15, 40, 45];

    const byRarity = { common: [], uncommon: [], rare: [] };
    for (const c of heroCards) {
      const r = c.rarity || 'common';
      byRarity[r].push(c);
    }

    // Personality weighting: boost cards whose type aligns with mood
    const personalityType = { feisty: 'attack', cozy: 'skill', cunning: 'power', feral: 'attack' };
    const boostedType = mood ? personalityType[mood] : null;

    const pool = [];
    const addWithWeight = (cards, weight) => {
      for (const c of cards) {
        const w = (boostedType && c.type === boostedType) ? weight * 2 : weight;
        for (let i = 0; i < w; i++) pool.push(c);
      }
    };
    addWithWeight(byRarity.common, weights[0]);
    addWithWeight(byRarity.uncommon, weights[1]);
    addWithWeight(byRarity.rare, weights[2]);

    // Pick `count` unique cards
    const chosen = new Set();
    const result = [];
    let attempts = 0;
    while (result.length < count && attempts < 200) {
      const card = pool[Math.floor(Math.random() * pool.length)];
      if (!chosen.has(card.id)) {
        chosen.add(card.id);
        result.push(card);
      }
      attempts++;
    }
    return result;
  }
}
