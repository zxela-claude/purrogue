import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from '../constants.js';
import { RELICS } from '../data/relics.js';
import { PersonalitySystem } from '../PersonalitySystem.js';

const EVENTS = [
  { title: 'Mysterious Fisherman', desc: 'A fisherman offers you fish. Take it?', choices: [
    { label: 'Take the fish (+15 HP)', action: gs => { if (PersonalitySystem.canHeal(gs.getDominantPersonality())) gs.heal(15); } },
    { label: 'Decline (nothing)', action: gs => {} }
  ]},
  { title: 'Ancient Cat Shrine', desc: 'A golden shrine pulses with energy.', choices: [
    { label: 'Pray (+1 max HP, -5 HP)', action: gs => { gs.maxHp++; gs.hp = Math.max(1, gs.hp - 5); } },
    { label: 'Ignore (nothing)', action: gs => {} }
  ]},
  { title: 'Suspicious Dog', desc: 'A dog wants to trade.', choices: [
    { label: 'Trade (lose 30g, gain relic)', action: gs => {
      if (gs.gold >= 30) {
        gs.spendGold(30);
        if (!gs.relics.includes('yarn_ball')) {
          gs.addRelic('yarn_ball');
        } else {
          const available = RELICS.filter(r => !gs.relics.includes(r.id));
          if (available.length > 0) {
            const chosen = available[Math.floor(Math.random() * available.length)];
            gs.addRelic(chosen.id);
          }
        }
      }
    }},
    { label: 'Attack! (deal 10 dmg to next enemy)', action: gs => { gs.pendingEnemyDamage = (gs.pendingEnemyDamage || 0) + 10; } }
  ]},
  { title: 'The Old Cat', desc: 'A wise elder offers wisdom.', choices: [
    { label: 'Listen (upgrade a random card)', action: gs => {
      const upgradeable = gs.deck.filter(id => !/_u(_\w+)?$/.test(id));
      if (upgradeable.length > 0) {
        const cardId = upgradeable[Math.floor(Math.random() * upgradeable.length)];
        gs.upgradeCard(cardId, gs.getDominantPersonality());
      }
    }},
    { label: 'Nap instead (+8 HP)', action: gs => { if (PersonalitySystem.canHeal(gs.getDominantPersonality())) gs.heal(8); } }
  ]},
  { title: 'Catnip Field', desc: 'A massive field of catnip.', choices: [
    { label: 'Roll in it! (+1 energy next combat)', action: gs => { gs.pendingEnergyBonus = (gs.pendingEnergyBonus || 0) + 1; } },
    { label: 'Resist (+3 max HP)', action: gs => { gs.maxHp += 3; gs.heal(3); } }
  ]}
];

export class EventScene extends Phaser.Scene {
  constructor() { super('EventScene'); }

  create() {
    const gs = this.registry.get('gameState');
    const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];

    const eventBgKey = `bg_combat_${Math.min(gs.act || 1, 3)}`;
    if (this.textures.exists(eventBgKey)) {
      this.add.image(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, eventBgKey).setDisplaySize(SCREEN_WIDTH, SCREEN_HEIGHT).setDepth(-1);
      this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, 0x000000, 0.65).setDepth(-1);
    } else {
      this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, COLORS.BG);
    }
    this.add.text(SCREEN_WIDTH/2, 100, '❓ EVENT', { fontFamily: '"Press Start 2P"', fontSize: '20px', color: '#4fc3f7' }).setOrigin(0.5);
    this.add.text(SCREEN_WIDTH/2, 160, event.title, { fontFamily: '"Press Start 2P"', fontSize: '20px', color: '#f0ead6' }).setOrigin(0.5);
    this.add.text(SCREEN_WIDTH/2, 230, event.desc, { fontFamily: '"Press Start 2P"', fontSize: '15px', color: '#aaaaaa', wordWrap: { width: 700 }, align: 'center' }).setOrigin(0.5);

    event.choices.forEach((choice, i) => {
      const btn = this.add.text(SCREEN_WIDTH/2, 350 + i * 80, `► ${choice.label}`, {
        fontFamily: '"Press Start 2P"', fontSize: '15px', color: '#f0ead6'
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
