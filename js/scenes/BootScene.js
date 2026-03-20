import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../constants.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // Create loading bar
    const bg = this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, 404, 24, 0x333333);
    const bar = this.add.rectangle(SCREEN_WIDTH/2 - 200, SCREEN_HEIGHT/2, 0, 20, 0xe94560).setOrigin(0, 0.5);
    bg.setDepth(0); bar.setDepth(1);

    this.load.on('progress', v => bar.setSize(400 * v, 20));

    // Hero sprites
    this.load.image('warrior_idle', 'assets/heroes/warrior_idle.png');
    this.load.image('warrior_attack', 'assets/heroes/warrior_attack.png');
    this.load.image('warrior_hurt', 'assets/heroes/warrior_hurt.png');
    this.load.image('mage_idle', 'assets/heroes/mage_idle.png');
    this.load.image('mage_attack', 'assets/heroes/mage_attack.png');
    this.load.image('mage_hurt', 'assets/heroes/mage_hurt.png');
    this.load.image('rogue_idle', 'assets/heroes/rogue_idle.png');
    this.load.image('rogue_attack', 'assets/heroes/rogue_attack.png');
    this.load.image('rogue_hurt', 'assets/heroes/rogue_hurt.png');

    // Enemy sprites
    this.load.image('yarn_golem', 'assets/enemies/yarn_golem.png');
    this.load.image('laser_sprite', 'assets/enemies/laser_sprite.png');
    this.load.image('moth_swarm', 'assets/enemies/moth_swarm.png');
    this.load.image('guard_dog', 'assets/enemies/guard_dog.png');
    this.load.image('vacuum_monster', 'assets/enemies/vacuum_monster.png');
    this.load.image('squirrel', 'assets/enemies/squirrel.png');
    this.load.image('boss_dog', 'assets/enemies/boss_dog.png');
    this.load.image('boss_vacuum', 'assets/enemies/boss_vacuum.png');

    // Map node icons
    this.load.image('node_combat', 'assets/mapnodes/node_combat.png');
    this.load.image('node_elite', 'assets/mapnodes/node_elite.png');
    this.load.image('node_shop', 'assets/mapnodes/node_shop.png');
    this.load.image('node_event', 'assets/mapnodes/node_event.png');
    this.load.image('node_rest', 'assets/mapnodes/node_rest.png');
    this.load.image('node_boss', 'assets/mapnodes/node_boss.png');

    // UI elements
    this.load.image('card_attack', 'assets/ui/card_attack.png');
    this.load.image('card_skill', 'assets/ui/card_skill.png');
    this.load.image('card_power', 'assets/ui/card_power.png');
    this.load.image('energy_orb', 'assets/ui/energy_orb.png');
    this.load.image('block_shield', 'assets/ui/block_shield.png');
    this.load.image('mood_feisty', 'assets/ui/mood_feisty.png');
    this.load.image('mood_cozy', 'assets/ui/mood_cozy.png');
  }

  create() {
    this.scene.start('MenuScene');
  }
}
