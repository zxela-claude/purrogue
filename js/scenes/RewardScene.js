import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from '../constants.js';
import { PersonalitySystem } from '../PersonalitySystem.js';
import { WARRIOR_CARDS, MAGE_CARDS, ROGUE_CARDS } from '../data/cards.js';

export class RewardScene extends Phaser.Scene {
  constructor() { super('RewardScene'); }

  create() {
    const gs = this.registry.get('gameState');
    this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, COLORS.BG);
    this.add.text(SCREEN_WIDTH/2, 60, '🏆 CHOOSE A CARD', { fontFamily: '"Press Start 2P"', fontSize: '20px', color: '#ffd700' }).setOrigin(0.5);

    const heroCards = gs.hero === 'WARRIOR' ? WARRIOR_CARDS : gs.hero === 'MAGE' ? MAGE_CARDS : ROGUE_CARDS;
    const count = gs.relics.includes('lucky_paw') ? 4 : 3;
    const choices = [...heroCards].sort(() => Math.random() - 0.5).slice(0, count);

    const mood = gs.getDominantPersonality();

    choices.forEach((card, i) => {
      const x = SCREEN_WIDTH / (count + 1) * (i + 1);
      const bg = this.add.rectangle(x, 360, 200, 280, COLORS.PANEL).setInteractive({ useHandCursor: true });
      this.add.text(x, 240, card.name, { fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#f0ead6' }).setOrigin(0.5);
      this.add.text(x, 270, card.description, { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#aaaaaa', wordWrap: { width: 180 }, align: 'center' }).setOrigin(0.5);
      this.add.text(x, 360, `Cost: ${card.cost}⚡`, { fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#ffd700' }).setOrigin(0.5);
      this.add.text(x, 390, `Type: ${card.type}`, { fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#4fc3f7' }).setOrigin(0.5);
      if (mood && card.upgrades) {
        const upgradePath = PersonalitySystem.getUpgradePath(card, mood);
        if (upgradePath !== card) {
          this.add.text(x, 440, `Upgrade (${mood}): available`, { fontFamily: '"Press Start 2P"', fontSize: '7px', color: '#4caf50', wordWrap: { width: 180 }, align: 'center' }).setOrigin(0.5);
        }
      }

      bg.on('pointerover', () => bg.setFillStyle(0x2a2a5e));
      bg.on('pointerout', () => bg.setFillStyle(COLORS.PANEL));
      bg.on('pointerdown', () => {
        gs.addCard(card.id);
        this.scene.start('MapScene');
      });
    });

    this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT - 40, '[ SKIP ]', {
      fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#aaaaaa'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('MapScene'));
  }
}
