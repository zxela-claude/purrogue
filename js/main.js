import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { MapScene } from './scenes/MapScene.js';
import { CombatScene } from './scenes/CombatScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { EventScene } from './scenes/EventScene.js';
import { RewardScene } from './scenes/RewardScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from './constants.js';

const config = {
  type: Phaser.AUTO,
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  backgroundColor: '#1a1a2e',
  scene: [BootScene, MenuScene, MapScene, CombatScene, ShopScene, EventScene, RewardScene, GameOverScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);
