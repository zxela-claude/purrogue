import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from '../constants.js';
import { RELICS } from '../data/relics.js';
import { ALL_CARDS } from '../data/cards.js';

export class ShopScene extends Phaser.Scene {
  constructor() { super('ShopScene'); }

  create() {
    const gs = this.registry.get('gameState');
    if (this.textures.exists('bg_shop')) {
      this.add.image(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, 'bg_shop').setDisplaySize(SCREEN_WIDTH, SCREEN_HEIGHT).setDepth(-1);
      this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, 0x000000, 0.5).setDepth(-1);
    } else {
      this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, COLORS.BG);
    }
    this.add.text(SCREEN_WIDTH/2, 40, '🛒 SHOP', { fontFamily: '"Press Start 2P"', fontSize: '24px', color: '#ffd700' }).setOrigin(0.5);
    this.add.text(SCREEN_WIDTH/2, 80, `💰 ${gs.gold} gold`, { fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#f0ead6' }).setOrigin(0.5);

    const allCards = ALL_CARDS.filter(c => c.heroClass === gs.hero);
    const shopCardCount = (gs.isDaily && gs.dailyModifier && gs.dailyModifier.id === 'double_shop') ? 5 : 3;
    const shopCards = allCards.sort(() => Math.random() - 0.5).slice(0, shopCardCount);
    const shopRelics = RELICS.filter(r => !gs.relics.includes(r.id)).sort(() => Math.random() - 0.5).slice(0, 2);

    const noGold = gs.isDaily && gs.dailyModifier && gs.dailyModifier.id === 'no_gold';

    const cardSpacing = Math.min(280, Math.floor((SCREEN_WIDTH - 100) / shopCardCount));
    const cardsTotalW = cardSpacing * (shopCardCount - 1);
    const cardsStartX = SCREEN_WIDTH / 2 - cardsTotalW / 2;

    shopCards.forEach((card, i) => {
      const x = cardsStartX + i * cardSpacing;
      const price = noGold ? 0 : (card.cost === 0 ? 50 : card.cost === 1 ? 75 : 100);
      const canAfford = noGold || gs.gold >= price;
      const bg = this.add.rectangle(x, 280, 220, 180, COLORS.PANEL).setInteractive({ useHandCursor: canAfford });
      this.add.text(x, 210, card.name, { fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#f0ead6', wordWrap: { width: 200 }, align: 'center' }).setOrigin(0.5);
      this.add.text(x, 248, card.description, { fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#aaaaaa', wordWrap: { width: 200 }, align: 'center' }).setOrigin(0.5);
      this.add.text(x, 315, `💰 ${price}g`, { fontFamily: '"Press Start 2P"', fontSize: '14px', color: canAfford ? '#ffd700' : '#666666' }).setOrigin(0.5);
      if (canAfford) {
        bg.on('pointerover', () => bg.setFillStyle(0x2a2a5e));
        bg.on('pointerout', () => bg.setFillStyle(COLORS.PANEL));
        bg.on('pointerdown', () => {
          if (gs.gold >= price) {
            gs.spendGold(price);
            gs.addCard(card.id);
            this.scene.restart();
          }
        });
      }
    });

    // NAN-125 Bare Metal: no relics in shop
    const bareMetal = gs.hasModifier && gs.hasModifier('bare_metal');
    if (bareMetal) {
      this.add.text(SCREEN_WIDTH / 2, 480, '🪨 Bare Metal — no relics available', {
        fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#555555'
      }).setOrigin(0.5);
    }
    const relicCount = shopRelics.length;
    const relicSpacing = Math.min(300, Math.floor((SCREEN_WIDTH - 200) / relicCount));
    const relicsTotalW = relicSpacing * (relicCount - 1);
    const relicsStartX = SCREEN_WIDTH / 2 - relicsTotalW / 2;
    if (!bareMetal) shopRelics.forEach((relic, i) => {
      const x = relicsStartX + i * relicSpacing;
      const price = noGold ? 0 : 120 + (gs.getAscensionModifiers().relicPriceBonus || 0);
      const canAfford = noGold || gs.gold >= price;
      const bg = this.add.rectangle(x, 480, 280, 110, COLORS.PANEL).setInteractive({ useHandCursor: canAfford });
      const iconKey = `relic_${relic.id}`;
      if (this.textures.exists(iconKey)) {
        this.add.image(x - 110, 468, iconKey).setDisplaySize(44, 44);
      }
      this.add.text(x + (this.textures.exists(iconKey) ? 10 : 0), 450, relic.name, { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#ffd700', wordWrap: { width: 200 }, align: 'center' }).setOrigin(0.5);
      this.add.text(x, 476, relic.desc, { fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#aaaaaa', wordWrap: { width: 260 }, align: 'center' }).setOrigin(0.5);
      this.add.text(x, 513, `💰 ${price}g`, { fontFamily: '"Press Start 2P"', fontSize: '12px', color: canAfford ? '#ffd700' : '#666666' }).setOrigin(0.5);
      if (canAfford) {
        bg.on('pointerover', () => bg.setFillStyle(0x2a2a5e));
        bg.on('pointerout', () => bg.setFillStyle(COLORS.PANEL));
        bg.on('pointerdown', () => {
          if (gs.gold >= price) {
            gs.spendGold(price);
            gs.addRelic(relic.id);
            this.scene.restart();
          }
        });
      }
    });

    if (!bareMetal && shopRelics.length === 0) {
      this.add.text(SCREEN_WIDTH / 2, 420, 'All relics collected', {
        fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#555555'
      }).setOrigin(0.5);
    }

    // Card removal section
    const removalCost = noGold ? 0 : 75;
    const canRemove = (noGold || gs.gold >= removalCost) && gs.deck.length > 1;
    const removalY = 590;

    this.add.text(SCREEN_WIDTH/2, removalY, '━━━━━━━━━━━━━━━━━━━━━', {
      fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#333355'
    }).setOrigin(0.5);

    const removeLabel = this.add.text(SCREEN_WIDTH/2, removalY + 32,
      `REMOVE A CARD — 💰 ${removalCost}g`,
      { fontFamily: '"Press Start 2P"', fontSize: '14px', color: canRemove ? '#e94560' : '#555555' }
    ).setOrigin(0.5);

    if (canRemove) {
      removeLabel.setInteractive({ useHandCursor: true });
      removeLabel.on('pointerover', () => removeLabel.setColor('#ff7777'));
      removeLabel.on('pointerout', () => removeLabel.setColor('#e94560'));
      removeLabel.on('pointerdown', () => this._showRemoveMenu(gs, removalCost));
    }

    this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT - 40, '[ LEAVE SHOP ]', {
      fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#e94560'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('MapScene'));
  }

  _showRemoveMenu(gs, cost) {
    const allCards = ALL_CARDS;
    const cardDb = {};
    for (const c of allCards) {
      cardDb[c.id] = c;
      if (c.upgrades) {
        for (const [mood, upgrade] of Object.entries(c.upgrades)) {
          const uid = mood === 'default' ? `${c.id}_u` : `${c.id}_u_${mood}`;
          cardDb[uid] = { ...c, id: uid, name: c.name + '+', effects: upgrade.effects };
        }
      }
    }

    const group = this.add.group();
    const bg = this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH - 100, SCREEN_HEIGHT - 100, COLORS.PANEL).setDepth(20);
    group.add(bg);
    group.add(this.add.text(SCREEN_WIDTH/2, 80, `REMOVE A CARD — costs ${cost}g`, {
      fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#e94560'
    }).setOrigin(0.5).setDepth(21));

    const removable = gs.deck.slice(0, gs.deck.length - 1);
    removable.forEach((cardId, i) => {
      const card = cardDb[cardId];
      if (!card) return;
      const col = i % 4, row = Math.floor(i / 4);
      const x = 220 + col * 220, y = 160 + row * 46;
      const btn = this.add.text(x, y, `✕ ${card.name}`, {
        fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#f0ead6'
      }).setDepth(21).setInteractive({ useHandCursor: true });
      btn.on('pointerover', function() { this.setColor('#e94560'); });
      btn.on('pointerout', function() { this.setColor('#f0ead6'); });
      btn.on('pointerdown', () => {
        if (gs.deck.length <= 1) return;
        gs.spendGold(cost);
        gs.removeCard(cardId);
        group.destroy(true);
        this.scene.restart();
      });
      group.add(btn);
    });

    group.add(this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT - 55, '[ CANCEL ]', {
      fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#aaaaaa'
    }).setOrigin(0.5).setDepth(21)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => group.destroy(true)));
  }
}
