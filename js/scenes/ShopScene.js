import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from '../constants.js';
import { RELICS } from '../data/relics.js';
import { ALL_CARDS } from '../data/cards.js';
import { PurrSettings } from '../PurrSettings.js';

const CARD_TYPE_COLORS = { attack: 0xe94560, skill: 0x4fc3f7, power: 0x9b59b6 };
const RARITY_BORDER_COLORS = { common: 0x888888, uncommon: 0x22cc77, rare: 0xffd700 };
const CARD_W = 118, CARD_H = 158;

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

    this.add.text(SCREEN_WIDTH/2, 30, '🛒 SHOP', { fontFamily: '"Press Start 2P"', fontSize: '20px', color: '#ffd700' }).setOrigin(0.5);
    this.add.text(SCREEN_WIDTH/2, 58, `💰 ${gs.gold} gold`, { fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#f0ead6' }).setOrigin(0.5);

    // Preserve shop inventory across restarts so buying one item doesn't re-roll the others
    const noGold = gs.isDaily && gs.dailyModifier && gs.dailyModifier.id === 'no_gold';
    const shopCardCount = (gs.isDaily && gs.dailyModifier && gs.dailyModifier.id === 'double_shop') ? 5 : 3;
    if (!gs.shopInventory) {
      const allCards = ALL_CARDS.filter(c => c.heroClass === gs.hero);
      gs.shopInventory = {
        cards: allCards.sort(() => Math.random() - 0.5).slice(0, shopCardCount),
        relics: RELICS.filter(r => !gs.relics.includes(r.id)).sort(() => Math.random() - 0.5).slice(0, 2)
      };
    }
    const shopCards = gs.shopInventory.cards;
    const shopRelics = gs.shopInventory.relics;

    // ── Cards section ─────────────────────────────────────────────
    this.add.text(SCREEN_WIDTH/2, 90, '— CARDS —', { fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#555577' }).setOrigin(0.5);

    const displayCount = Math.max(1, shopCards.length);
    const cardSpacing = Math.min(260, Math.floor((SCREEN_WIDTH - 120) / displayCount));
    const cardsTotalW = cardSpacing * (displayCount - 1);
    const cardsStartX = SCREEN_WIDTH / 2 - cardsTotalW / 2;
    const cardCenterY = 255;

    shopCards.forEach((card, i) => {
      const x = cardsStartX + i * cardSpacing;
      const price = noGold ? 0 : (card.cost === 0 ? 50 : card.cost === 1 ? 75 : 100);
      const canAfford = noGold || gs.gold >= price;
      this._buildShopCard(x, cardCenterY, card, i, price, canAfford, gs, noGold);
    });

    // ── Relics section ────────────────────────────────────────────
    const bareMetal = gs.hasModifier && gs.hasModifier('bare_metal');
    const relicSectionY = cardCenterY + CARD_H / 2 + 58;

    this.add.text(SCREEN_WIDTH/2, relicSectionY - 24, '— RELICS —', { fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#555577' }).setOrigin(0.5);

    if (bareMetal) {
      this.add.text(SCREEN_WIDTH / 2, relicSectionY + 28, '🪨 Bare Metal — no relics available', {
        fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#555555'
      }).setOrigin(0.5);
    } else if (shopRelics.length === 0) {
      this.add.text(SCREEN_WIDTH / 2, relicSectionY + 28, 'All relics collected', {
        fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#555555'
      }).setOrigin(0.5);
    } else {
      const relicCount = shopRelics.length;
      const relicSpacing = Math.min(320, Math.floor((SCREEN_WIDTH - 200) / relicCount));
      const relicsTotalW = relicSpacing * (relicCount - 1);
      const relicsStartX = SCREEN_WIDTH / 2 - relicsTotalW / 2;
      shopRelics.forEach((relic, i) => {
        const x = relicsStartX + i * relicSpacing;
        const price = noGold ? 0 : 120 + (gs.getAscensionModifiers().relicPriceBonus || 0);
        const canAfford = noGold || gs.gold >= price;
        const bg = this.add.rectangle(x, relicSectionY + 30, 300, 96, canAfford ? 0x1e1e3a : 0x111122).setInteractive({ useHandCursor: canAfford });

        // Gold-style border for relics
        const relicBorder = this.add.graphics();
        relicBorder.lineStyle(2, canAfford ? 0xffd700 : 0x333333);
        relicBorder.strokeRect(x - 150, relicSectionY - 18, 300, 96);

        const iconKey = `relic_${relic.id}`;
        if (this.textures.exists(iconKey)) {
          this.add.image(x - 118, relicSectionY + 18, iconKey).setDisplaySize(44, 44);
        }
        const textOffsetX = this.textures.exists(iconKey) ? 16 : 0;
        this.add.text(x + textOffsetX, relicSectionY + 4, relic.name, {
          fontFamily: '"Press Start 2P"', fontSize: '12px', color: canAfford ? '#ffd700' : '#666666',
          wordWrap: { width: 220 }, align: 'center'
        }).setOrigin(0.5);
        this.add.text(x + textOffsetX, relicSectionY + 26, relic.desc, {
          fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#aaaaaa',
          wordWrap: { width: 220 }, align: 'center'
        }).setOrigin(0.5);
        this.add.text(x, relicSectionY + 56, `💰 ${price}g`, {
          fontFamily: '"Press Start 2P"', fontSize: '12px', color: canAfford ? '#ffd700' : '#666666'
        }).setOrigin(0.5);

        if (canAfford) {
          bg.on('pointerover', () => bg.setFillStyle(0x2a2a5e));
          bg.on('pointerout', () => bg.setFillStyle(0x1e1e3a));
          bg.on('pointerdown', () => {
            if (gs.gold >= price || noGold) {
              if (!noGold) gs.spendGold(price);
              gs.addRelic(relic.id);
              // Remove purchased relic from inventory so remaining relics stay the same
              if (gs.shopInventory) gs.shopInventory.relics.splice(i, 1);
              this.scene.restart();
            }
          });
        }
      });
    }

    // ── Card removal ──────────────────────────────────────────────
    const removalCost = noGold ? 0 : 75;
    const canRemove = (noGold || gs.gold >= removalCost) && gs.deck.length > 1;
    const removalY = relicSectionY + 118;

    this.add.text(SCREEN_WIDTH/2, removalY, '━━━━━━━━━━━━━━━━━━━━━', {
      fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#333355'
    }).setOrigin(0.5);

    const removeLabel = this.add.text(SCREEN_WIDTH/2, removalY + 28,
      `REMOVE A CARD — 💰 ${removalCost}g`,
      { fontFamily: '"Press Start 2P"', fontSize: '13px', color: canRemove ? '#e94560' : '#555555' }
    ).setOrigin(0.5);

    if (canRemove) {
      removeLabel.setInteractive({ useHandCursor: true });
      removeLabel.on('pointerover', () => removeLabel.setColor('#ff7777'));
      removeLabel.on('pointerout', () => removeLabel.setColor('#e94560'));
      removeLabel.on('pointerdown', () => this._showRemoveMenu(gs, removalCost));
    }

    this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT - 28, '[ LEAVE SHOP ]', {
      fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#e94560'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      gs.shopInventory = null; // Clear so next shop visit gets fresh items
      this.scene.start('MapScene');
    });
    PurrSettings.scaleSceneText(this); // NAN-222
  }

  _buildShopCard(x, cy, card, cardIndex, price, canAfford, gs, noGold) {
    const container = this.add.container(x, cy);
    const typeColor = CARD_TYPE_COLORS[card.type] || 0x666666;
    const rarityColor = RARITY_BORDER_COLORS[card.rarity] || 0x888888;

    // Shadow
    container.add(this.add.rectangle(3, 4, CARD_W, CARD_H, 0x000000, 0.45));

    // Card body
    const body = this.add.rectangle(0, 0, CARD_W, CARD_H, canAfford ? 0x1e2a4a : 0x111622);
    container.add(body);

    // Rarity border (outer)
    const rarityBorder = this.add.graphics();
    rarityBorder.lineStyle(3, canAfford ? rarityColor : 0x333333);
    rarityBorder.strokeRect(-CARD_W/2, -CARD_H/2, CARD_W, CARD_H);
    container.add(rarityBorder);

    // Type pip (top-right corner)
    container.add(this.add.rectangle(CARD_W/2 - 10, -CARD_H/2 + 10, 18, 18, canAfford ? typeColor : 0x333333));

    // Cost (top-left)
    container.add(this.add.text(-CARD_W/2 + 8, -CARD_H/2 + 6, `${card.cost}`, {
      fontFamily: '"Press Start 2P"', fontSize: '11px', color: canAfford ? '#ffd700' : '#444444'
    }));

    // Card art (center zone)
    const baseCardId = card.id.replace(/_u(_\w+)?$/, '');
    const artKey = `card_art_${baseCardId}`;
    if (this.textures.exists(artKey)) {
      container.add(this.add.rectangle(0, -12, 74, 74, 0x000000, 0.3));
      const art = this.add.image(0, -12, artKey).setDisplaySize(70, 70);
      if (!canAfford) art.setTint(0x334455);
      container.add(art);
    }

    // Card name
    container.add(this.add.text(0, -63, card.name, {
      fontFamily: '"Press Start 2P"', fontSize: '7px',
      color: canAfford ? '#f0ead6' : '#555566',
      wordWrap: { width: 100 }, align: 'center'
    }).setOrigin(0.5));

    // Rarity initial (bottom-left)
    container.add(this.add.text(-CARD_W/2 + 4, CARD_H/2 - 14, card.rarity ? card.rarity[0].toUpperCase() : '', {
      fontFamily: '"Press Start 2P"', fontSize: '7px',
      color: canAfford ? `#${rarityColor.toString(16).padStart(6, '0')}` : '#333333'
    }));

    // Description
    container.add(this.add.text(0, 38, card.description, {
      fontFamily: '"Press Start 2P"', fontSize: '7px',
      color: canAfford ? '#aaaaaa' : '#444444',
      wordWrap: { width: 104 }, align: 'center'
    }).setOrigin(0.5));

    // Price below card
    this.add.text(x, cy + CARD_H / 2 + 16, noGold ? 'FREE' : `💰 ${price}g`, {
      fontFamily: '"Press Start 2P"', fontSize: '12px', color: canAfford ? '#ffd700' : '#555555'
    }).setOrigin(0.5);

    // Interactivity
    container.setInteractive(
      new Phaser.Geom.Rectangle(-CARD_W/2, -CARD_H/2, CARD_W, CARD_H),
      Phaser.Geom.Rectangle.Contains
    );

    if (canAfford) {
      container.on('pointerover', () => {
        body.setFillStyle(0x2e3f6e);
        this.tweens.add({ targets: container, y: cy - 12, scaleX: 1.08, scaleY: 1.08, duration: 120, ease: 'Power2' });
      });
      container.on('pointerout', () => {
        body.setFillStyle(0x1e2a4a);
        this.tweens.add({ targets: container, y: cy, scaleX: 1, scaleY: 1, duration: 100 });
      });
      container.on('pointerdown', () => {
        if (gs.gold >= price || noGold) {
          if (!noGold) gs.spendGold(price);
          gs.addCard(card.id);
          // Remove purchased card from inventory so other cards stay the same
          if (gs.shopInventory) gs.shopInventory.cards.splice(cardIndex, 1);
          this.scene.restart();
        }
      });
    }
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
