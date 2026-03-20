import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from '../constants.js';

const EVENTS = [
  { title: 'Mysterious Fisherman', desc: 'A fisherman offers you fish. Take it?', choices: [
    { label: 'Take the fish (+15 HP)', action: gs => { gs.heal(15); } },
    { label: 'Decline (nothing)', action: gs => {} }
  ]},
  { title: 'Ancient Cat Shrine', desc: 'A golden shrine pulses with energy.', choices: [
    { label: 'Pray (+1 max HP, -5 HP)', action: gs => { gs.maxHp++; gs.hp = Math.max(1, gs.hp - 5); } },
    { label: 'Ignore (nothing)', action: gs => {} }
  ]},
  { title: 'Suspicious Dog', desc: 'A dog wants to trade.', choices: [
    { label: 'Trade (lose 30g, gain relic)', action: gs => {
      if (gs.gold >= 30) { gs.spendGold(30); gs.addRelic('yarn_ball'); }
    }},
    { label: 'Attack! (deal 10 dmg to next enemy)', action: gs => {} }
  ]},
  { title: 'The Old Cat', desc: 'A wise elder offers wisdom.', choices: [
    { label: 'Listen (upgrade a random card)', action: gs => {} },
    { label: 'Nap instead (+8 HP)', action: gs => { gs.heal(8); } }
  ]},
  { title: 'Catnip Field', desc: 'A massive field of catnip.', choices: [
    { label: 'Roll in it! (+1 energy this combat)', action: gs => {} },
    { label: 'Resist (+3 max HP)', action: gs => { gs.maxHp += 3; gs.heal(3); } }
  ]}
];

export class EventScene extends Phaser.Scene {
  constructor() { super('EventScene'); }

  create() {
    const gs = this.registry.get('gameState');
    const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];

    this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, COLORS.BG);
    this.add.text(SCREEN_WIDTH/2, 100, '❓ EVENT', { fontFamily: '"Press Start 2P"', fontSize: '20px', color: '#4fc3f7' }).setOrigin(0.5);
    this.add.text(SCREEN_WIDTH/2, 160, event.title, { fontFamily: '"Press Start 2P"', fontSize: '16px', color: '#f0ead6' }).setOrigin(0.5);
    this.add.text(SCREEN_WIDTH/2, 220, event.desc, { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#aaaaaa', wordWrap: { width: 600 }, align: 'center' }).setOrigin(0.5);

    event.choices.forEach((choice, i) => {
      const btn = this.add.text(SCREEN_WIDTH/2, 340 + i * 70, `► ${choice.label}`, {
        fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#f0ead6'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerover', function() { this.setColor('#ffd700'); });
      btn.on('pointerout', function() { this.setColor('#f0ead6'); });
      btn.on('pointerdown', () => {
        choice.action(gs);
        gs.save();
        this.scene.start('MapScene');
      });
    });
  }
}
