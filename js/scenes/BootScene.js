import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../constants.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    // Create loading bar
    const bg = this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, 404, 24, 0x333333);
    const bar = this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, 400, 20, 0xe94560);
    bg.setDepth(0); bar.setDepth(1);

    this.load.on('progress', v => bar.setSize(400 * v, 20));
    // All assets generated procedurally — nothing to load for v1
  }

  create() {
    this.scene.start('MenuScene');
  }
}
