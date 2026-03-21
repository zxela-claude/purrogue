import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from '../constants.js';
import { RELICS } from '../data/relics.js';
import { WARRIOR_CARDS, MAGE_CARDS, ROGUE_CARDS } from '../data/cards.js';

export class ShopScene extends Phaser.Scene {
  constructor() { super('ShopScene'); }

  create() {
    const gs = this.registry.get('gameState');
    this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, COLORS.BG);
    this.add.text(SCREEN_WIDTH/2, 40, '🛒 SHOP', { fontFamily: '"Press Start 2P"', fontSize: '24px', color: '#ffd700' }).setOrigin(0.5);
    this.add.text(SCREEN_WIDTH/2, 80, `💰 ${gs.gold} gold`, { fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#f0ead6' }).setOrigin(0.5);

    const allCards = [...WARRIOR_CARDS, ...MAGE_CARDS, ...ROGUE_CARDS].filter(c => c.heroClass === gs.hero);
    const shopCards = allCards.sort(() => Math.random() - 0.5).slice(0, 3);
    const shopRelics = RELICS.filter(r => !gs.relics.includes(r.id)).sort(() => Math.random() - 0.5).slice(0, 2);

    shopCards.forEach((card, i) => {
      const x = 200 + i * 280;
      const price = card.cost === 0 ? 50 : card.cost === 1 ? 75 : 100;
      const canAfford = gs.gold >= price;
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

    shopRelics.forEach((relic, i) => {
      const x = 300 + i * 400;
      const price = 150;
      const canAfford = gs.gold >= price;
      const bg = this.add.rectangle(x, 480, 280, 100, COLORS.PANEL).setInteractive({ useHandCursor: canAfford });
      this.add.text(x, 450, `${relic.name} — ${relic.desc}`, { fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#ffd700', wordWrap: { width: 260 }, align: 'center' }).setOrigin(0.5);
      this.add.text(x, 510, `💰 ${price}g`, { fontFamily: '"Press Start 2P"', fontSize: '12px', color: canAfford ? '#ffd700' : '#666666' }).setOrigin(0.5);
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

    this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT - 40, '[ LEAVE SHOP ]', {
      fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#e94560'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('MapScene'));
  }
}
