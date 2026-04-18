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

    // Enemy sprites (key must match enemy id in enemies.js)
    this.load.image('yarn_golem', 'assets/enemies/yarn_golem.png');
    this.load.image('laser_sprite', 'assets/enemies/laser_sprite.png');
    this.load.image('moth_swarm', 'assets/enemies/moth_swarm.png');
    this.load.image('curtain_phantom', 'assets/enemies/curtain_phantom.png');
    this.load.image('guard_dog', 'assets/enemies/guard_dog.png');
    this.load.image('vacuum_cleaner', 'assets/enemies/vacuum_monster.png');
    this.load.image('squirrel', 'assets/enemies/squirrel.png');
    this.load.image('golden_retriever', 'assets/enemies/golden_retriever.png');
    this.load.image('alley_cat', 'assets/enemies/alley_cat.png');
    this.load.image('robot_cat', 'assets/enemies/robot_cat.png');
    this.load.image('feral_pigeon', 'assets/enemies/feral_pigeon.png');
    this.load.image('doberman', 'assets/enemies/doberman.png');
    this.load.image('the_dog', 'assets/enemies/boss_dog.png');
    this.load.image('vacuum_boss', 'assets/enemies/boss_vacuum.png');
    this.load.image('the_vet', 'assets/enemies/the_vet.png');
    this.load.image('raccoon', 'assets/enemies/raccoon.png');
    this.load.image('the_washing_machine', 'assets/enemies/the_washing_machine.png');

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

    // Backgrounds
    this.load.image('bg_combat_1', 'assets/backgrounds/bg_combat_1.png');
    this.load.image('bg_combat_2', 'assets/backgrounds/bg_combat_2.png');
    this.load.image('bg_combat_3', 'assets/backgrounds/bg_combat_3.png');
    this.load.image('bg_map_1', 'assets/backgrounds/bg_map_1.png');
    this.load.image('bg_map_2', 'assets/backgrounds/bg_map_2.png');
    this.load.image('bg_map_3', 'assets/backgrounds/bg_map_3.png');
    this.load.image('bg_shop', 'assets/backgrounds/bg_shop.png');
    this.load.image('bg_rest', 'assets/backgrounds/bg_rest.png');
    this.load.image('bg_boss', 'assets/backgrounds/bg_boss.png');

    // Relic icons
    const relicIds = ['laser_toy','catnip','hairball','yarn_ball','bell_collar','cat_nap',
      'toy_mouse','fish_snack','sundial','cursed_collar','ancient_tome','lucky_paw',
      'coffee_mug','mirror','claw_sharpener','warm_blanket','magnifying_glass',
      'tuna_can','golden_ball','nine_lives','power_cell',
      'iron_paw','spell_tome','shadow_cloak'];
    for (const id of relicIds) {
      this.load.image(`relic_${id}`, `assets/relics/${id}.png`);
    }

    // Card art — warrior
    const warriorCards = ['w_strike','w_defend','w_bash','w_cleave','w_armored','w_headbutt',
      'w_rage','w_pummel','w_entrench','w_sword_boomerang','w_war_cry','w_shield_bash',
      'w_flex','w_double_tap','w_infernal_blade','w_spot_weakness','w_bloodletting',
      'w_immovable','w_true_grit','w_limit_break',
      'w_pounce_strike','w_battle_stance','w_warpath','w_roar','w_reckless_charge',
      'w_stalwart','w_pulverize','w_iron_will','w_primal_fury','w_lions_heart',
      'w_unstoppable','w_whirlwind','w_sharpen_claws'];
    for (const id of warriorCards) this.load.image(`card_art_${id}`, `assets/cards/${id}.png`);

    // Card art — mage
    const mageCards = ['m_zap','m_frost','m_fireball','m_arcane','m_poison_claw','m_ice_barrier',
      'm_thunder','m_mana_burn','m_blizzard','m_study','m_corruption','m_dual_cast',
      'm_reflex','m_meteor','m_echo','m_slow','m_adrenaline','m_burn_wave','m_barrier','m_static',
      'm_spark','m_frost_nova','m_arcane_bolt','m_mind_fog','m_chain_lightning','m_glacial_wall',
      'm_overload','m_mana_surge','m_nullify','m_comet','m_astral_projection','m_time_loop','m_foresight'];
    for (const id of mageCards) this.load.image(`card_art_${id}`, `assets/cards/${id}.png`);

    // Card art — rogue
    const rogueCards = ['r_shiv','r_dodge','r_backstab','r_poison_dart','r_sprint','r_blade_dance',
      'r_caltrops','r_predator','r_acrobatics','r_calculated_gamble','r_flechettes',
      'r_masterful_stab','r_concentrate','r_noxious_fumes','r_sucker_punch','r_infiltrate',
      'r_terror','r_bullet_time','r_storm_of_steel','r_wraith_form','r_thousand_cuts'];
    for (const id of rogueCards) this.load.image(`card_art_${id}`, `assets/cards/${id}.png`);
  }

  create() {
    // Generate fallback texture for missing card art (paw silhouette on dark bg)
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x1a1a2e);
    g.fillRect(0, 0, 70, 70);
    // toe pads
    g.fillStyle(0x3a3a5e);
    g.fillEllipse(16, 24, 14, 12);
    g.fillEllipse(30, 18, 14, 12);
    g.fillEllipse(44, 18, 14, 12);
    g.fillEllipse(57, 24, 14, 12);
    // central pad
    g.fillEllipse(35, 44, 28, 24);
    g.generateTexture('card_art_fallback', 70, 70);
    g.destroy();

    this.scene.start('MenuScene');
  }
}
