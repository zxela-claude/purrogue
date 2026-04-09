import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from '../constants.js';
import { RELICS } from '../data/relics.js';
import { PersonalitySystem } from '../PersonalitySystem.js';
import { getBiome } from '../DungeonBuilding.js';
import { PurrSettings } from '../PurrSettings.js';

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
  ]},
  { title: 'The Yarn Tangle', desc: 'A glorious tangle of yarn sprawls across the path. Something glints inside...', choices: [
    { label: 'Untangle it (gain relic, lose 1 card)', requiresConfirm: true, confirmText: 'A random card will be permanently removed from your deck. Continue?', action: gs => {
      const relicPool = ['laser_toy','bell_collar','toy_mouse','lucky_paw','claw_sharpener','warm_blanket'];
      gs.addRelic(relicPool[Math.floor(Math.random() * relicPool.length)]);
      if (gs.deck.length > 1) {
        const idx = Math.floor(Math.random() * gs.deck.length);
        gs.deck.splice(idx, 1);
        gs.save();
      }
    }},
    { label: 'Grab a strand (+10 gold)', action: gs => { gs.gold += 10; gs.save(); } },
    { label: 'Walk past (nothing)', action: gs => {} }
  ]},
  { title: 'Catnip Stash', desc: 'A hidden cache of premium catnip. The scent is overwhelming.', choices: [
    { label: 'Sniff it (+1 energy next combat)', action: gs => { gs.pendingEnergyBonus = (gs.pendingEnergyBonus || 0) + 1; } },
    { label: 'Pocket some (add Catnip Surge card)', action: gs => { gs.addCard('catnip_surge'); } },
    { label: 'Leave it (nothing)', action: gs => {} }
  ]},
  { title: "The Mysterious Box", desc: "A cardboard box sits in the middle of the path. It could contain anything.", choices: [
    { label: "Open it (random: good or bad)", requiresConfirm: true, confirmText: 'The outcome is random — it could heal, grant gold or a relic, or permanently remove a card from your deck. Continue?', action: gs => {
      const outcomes = [
        gs2 => { gs2.heal(20); },
        gs2 => { gs2.gold += 30; gs2.save(); },
        gs2 => { gs2.addRelic('lucky_paw'); },
        gs2 => { gs2.hp = Math.max(1, gs2.hp - 15); gs2.save(); },
        gs2 => {
          if (gs2.deck.length > 1) {
            gs2.deck.splice(Math.floor(Math.random() * gs2.deck.length), 1);
            gs2.save();
          }
        },
        gs2 => { gs2.pendingEnergyBonus = (gs2.pendingEnergyBonus || 0) + 2; }
      ];
      outcomes[Math.floor(Math.random() * outcomes.length)](gs);
    }},
    { label: "Leave it (+15 gold)", action: gs => { gs.gold += 15; gs.save(); } }
  ]},
  { title: 'Rival Cat Encounter', desc: 'A battle-scarred stray blocks your path, eyes locked on yours.', choices: [
    { label: 'Fight! (+25 gold, -8 HP)', action: gs => {
      gs.gold += 25; gs.save();
      gs.hp = Math.max(1, gs.hp - 8); gs.save();
    }},
    { label: 'Hiss and flee (nothing)', action: gs => {} },
    { label: 'Trade scraps (+1 card)', action: gs => {
      const cardPool = ['w_strike','m_zap','r_shiv','w_defend','m_frost','r_dodge'];
      gs.addCard(cardPool[Math.floor(Math.random() * cardPool.length)]);
    }}
  ]},
  { title: 'The Sunny Spot', desc: 'A perfect patch of warm sunlight filters through a broken window.', choices: [
    { label: 'Rest here (+10 HP)', action: gs => {
      const bonus = gs.getDominantPersonality() === 'cozy' ? 5 : 0;
      gs.heal(10 + bonus);
    }},
    { label: 'Skip it (draw 1 extra card next combat)', action: gs => { gs._pendingDrawBonus = (gs._pendingDrawBonus || 0) + 1; gs.save(); } }
  ]},
  { title: 'Shiny Vending Machine', desc: 'An ancient machine hums. It wants gold.', choices: [
    { label: 'Pay 50g (random relic)', action: gs => {
      if (gs.gold >= 50) {
        gs.spendGold(50);
        const available = RELICS.filter(r => !gs.relics.includes(r.id));
        if (available.length > 0) gs.addRelic(available[Math.floor(Math.random() * available.length)].id);
      }
    }},
    { label: 'Smash it! (10 dmg to you, 3 gold)', action: gs => { gs.takeDamage(10); gs.gainGold(3); } }
  ]},
  { title: 'Haunted Litter Box', desc: 'Something stirs within. Dare you look?', choices: [
    { label: 'Investigate (upgrade 2 random cards)', action: gs => {
      const upgradeable = gs.deck.filter(id => !/_u(_\w+)?$/.test(id));
      const picks = upgradeable.sort(() => Math.random() - 0.5).slice(0, 2);
      picks.forEach(id => gs.upgradeCard(id, gs.getDominantPersonality()));
    }},
    { label: 'Walk away (+20 gold)', action: gs => { gs.gainGold(20); } }
  ]},
  { title: 'Travelling Merchant', desc: 'A robed figure sells forbidden knowledge.', choices: [
    { label: 'Buy a curse (-20g, -1 max HP, draw +1/turn)', action: gs => {
      if (gs.gold >= 20) { gs.spendGold(20); gs.maxHp = Math.max(1, gs.maxHp - 1); gs.pendingDrawBonus = (gs.pendingDrawBonus || 0) + 1; }
    }},
    { label: 'Buy a tonic (-15g, +20 HP)', action: gs => {
      if (gs.gold >= 15) { gs.spendGold(15); gs.heal(20); }
    }},
    { label: 'Ignore (nothing)', action: gs => {} }
  ]},
  { title: 'Thunderstorm', desc: 'Lightning crackles. The air smells electric.', choices: [
    { label: 'Channel it (+2 Strong next combat)', action: gs => { gs.pendingStatusBonus = gs.pendingStatusBonus || {}; gs.pendingStatusBonus.strong = (gs.pendingStatusBonus.strong || 0) + 2; } },
    { label: 'Shelter (nothing bad happens)', action: gs => {} }
  ]},
  { title: 'The Doppelganger', desc: 'A cat that looks exactly like you blocks the path.', choices: [
    { label: 'Fight! (take 15 dmg, gain 40 gold)', action: gs => { gs.takeDamage(15); gs.gainGold(40); } },
    { label: 'Befriend it (lose 20g, copy its relic)', action: gs => {
      if (gs.gold >= 20) {
        gs.spendGold(20);
        const available = RELICS.filter(r => !gs.relics.includes(r.id));
        if (available.length > 0) gs.addRelic(available[Math.floor(Math.random() * available.length)].id);
      }
    }}
  ]},
  { title: 'Turf War', desc: 'A rival gang of cats offers you a temporary alliance before the next fight.', choices: [
    { label: 'Join the brawl (+3 Strong next combat)', action: gs => {
      gs.pendingStatusBonus = gs.pendingStatusBonus || {};
      gs.pendingStatusBonus.strong = (gs.pendingStatusBonus.strong || 0) + 3;
      gs.save();
    }},
    { label: 'Stay out of it (nothing)', action: gs => {} }
  ]},
  { title: 'Catnap', desc: 'An irresistibly warm patch of sunlight. You could sleep the whole floor away...', choices: [
    { label: 'Sleep it off (heal to full HP, skip rewards)', action: gs => {
      gs.heal(gs.maxHp);
      gs.skipNextReward = true;
      gs.save();
    }},
    { label: 'Push through (nothing)', action: gs => {} }
  ]},
  { title: 'Cursed Fish', desc: 'A glowing fish lies on the ground. It smells wrong — but gold coins are stuffed inside its mouth.', choices: [
    { label: 'Eat it (+40 gold, +5 Poison next combat)', action: gs => {
      gs.gainGold(40);
      gs.pendingStatusBonus = gs.pendingStatusBonus || {};
      gs.pendingStatusBonus.poison = (gs.pendingStatusBonus.poison || 0) + 5;
      gs.save();
    }},
    { label: 'Take the gold only (+20 gold)', action: gs => { gs.gainGold(20); gs.save(); } },
    { label: 'Leave it (nothing)', action: gs => {} }
  ]},
  { title: 'Rival Cat Duel', desc: 'A scarred tom cat challenges you to a duel. Winner takes all.', choices: [
    { label: 'Accept (-12 HP, gain random relic)', action: gs => {
      gs.hp = Math.max(1, gs.hp - 12);
      const available = RELICS.filter(r => !gs.relics.includes(r.id));
      if (available.length > 0) gs.addRelic(available[Math.floor(Math.random() * available.length)].id);
      gs.save();
    }},
    { label: 'Back down (nothing)', action: gs => {} }
  ]},
  { title: 'The Toymaker', desc: 'A wizened cat merchant displays a single exquisite, upgraded card under glass.', choices: [
    { label: 'Buy it (-45 gold, upgraded card)', action: gs => {
      if (gs.gold >= 45) {
        gs.spendGold(45);
        const allUpgradeable = gs.deck.filter(id => !/_u(_\w+)?$/.test(id));
        if (allUpgradeable.length > 0) {
          const cardId = allUpgradeable[Math.floor(Math.random() * allUpgradeable.length)];
          gs.upgradeCard(cardId, gs.getDominantPersonality());
        }
      }
    }},
    { label: 'Admire it (nothing)', action: gs => {} }
  ]}
];

export class EventScene extends Phaser.Scene {
  constructor() { super('EventScene'); }

  create() {
    const gs = this.registry.get('gameState');
    const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];

    const eventBgKey = `bg_combat_${Math.min(gs.act || 1, 3)}`;
    // NAN-215: use biome fog colour as the atmospheric overlay tint
    const biome = getBiome(gs.act);
    if (this.textures.exists(eventBgKey)) {
      this.add.image(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, eventBgKey).setDisplaySize(SCREEN_WIDTH, SCREEN_HEIGHT).setDepth(-1);
      this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, biome.fogColor, 0.65).setDepth(-1);
    } else {
      this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, COLORS.BG);
    }
    this.add.text(SCREEN_WIDTH/2, 100, '❓ EVENT', { fontFamily: '"Press Start 2P"', fontSize: '20px', color: '#4fc3f7' }).setOrigin(0.5);
    this.add.text(SCREEN_WIDTH/2, 160, event.title, { fontFamily: '"Press Start 2P"', fontSize: '20px', color: '#f0ead6' }).setOrigin(0.5);
    this.add.text(SCREEN_WIDTH/2, 230, event.desc, { fontFamily: '"Press Start 2P"', fontSize: '15px', color: '#aaaaaa', wordWrap: { width: 700 }, align: 'center' }).setOrigin(0.5);

    const totalH = event.choices.length * 80;
    const choiceStartY = Math.max(300, (300 + 700) / 2 - totalH / 2);
    const choiceSpacing = Math.min(80, (700 - choiceStartY) / event.choices.length);

    event.choices.forEach((choice, i) => {
      const btn = this.add.text(SCREEN_WIDTH/2, choiceStartY + i * choiceSpacing, `► ${choice.label}`, {
        fontFamily: '"Press Start 2P"', fontSize: '15px', color: '#f0ead6',
        wordWrap: { width: 700 }, align: 'center'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerover', function() { this.setColor('#ffd700'); });
      btn.on('pointerout', function() { this.setColor('#f0ead6'); });
      btn.on('pointerdown', () => {
        if (choice.requiresConfirm) {
          this._showConfirmModal(gs, choice);
        } else {
          choice.action(gs);
          gs.save();
          this.scene.start('MapScene');
        }
      });
    });
    PurrSettings.scaleSceneText(this); // NAN-222
  }

  _showConfirmModal(gs, choice) {
    // Dim overlay
    const overlay = this.add.rectangle(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT, 0x000000, 0.75)
      .setDepth(10).setInteractive(); // block clicks through

    // Modal box
    const boxW = 640, boxH = 260;
    const boxX = SCREEN_WIDTH / 2, boxY = SCREEN_HEIGHT / 2;
    this.add.rectangle(boxX, boxY, boxW, boxH, 0x1a1a2e, 1).setDepth(11);
    this.add.rectangle(boxX, boxY, boxW, boxH).setDepth(11).setStrokeStyle(2, 0xffd700);

    // Warning text
    this.add.text(boxX, boxY - 70, '⚠ Are you sure?', {
      fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#ffd700'
    }).setOrigin(0.5).setDepth(12);

    this.add.text(boxX, boxY - 10, choice.confirmText, {
      fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#f0ead6',
      wordWrap: { width: boxW - 60 }, align: 'center'
    }).setOrigin(0.5).setDepth(12);

    // Confirm button
    const confirmBtn = this.add.text(boxX - 120, boxY + 80, '✓ CONFIRM', {
      fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#4caf50',
      backgroundColor: '#1a3a1a', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setDepth(12).setInteractive({ useHandCursor: true });

    confirmBtn.on('pointerover', function() { this.setColor('#a5d6a7'); });
    confirmBtn.on('pointerout', function() { this.setColor('#4caf50'); });
    confirmBtn.on('pointerdown', () => {
      choice.action(gs);
      gs.save();
      this.scene.start('MapScene');
    });

    // Cancel button
    const cancelBtn = this.add.text(boxX + 120, boxY + 80, '✗ CANCEL', {
      fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#ef5350',
      backgroundColor: '#3a1a1a', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setDepth(12).setInteractive({ useHandCursor: true });

    cancelBtn.on('pointerover', function() { this.setColor('#ef9a9a'); });
    cancelBtn.on('pointerout', function() { this.setColor('#ef5350'); });
    cancelBtn.on('pointerdown', () => {
      overlay.destroy();
      // destroy all modal elements by depth
      this.children.list
        .filter(c => c.depth >= 11)
        .forEach(c => c.destroy());
    });
  }
}
