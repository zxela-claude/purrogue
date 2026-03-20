import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from '../constants.js';
import { DeckCode } from '../DeckCode.js';
import { PersonalitySystem } from '../PersonalitySystem.js';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  init(data) { this.won = data.won; }

  create() {
    const gs = this.registry.get('gameState');
    this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, COLORS.BG);

    const title = this.won ? '🎉 YOU WIN! 🎉' : '😿 GAME OVER';
    const color = this.won ? '#ffd700' : '#e94560';
    this.add.text(SCREEN_WIDTH/2, 100, title, { fontFamily: '"Press Start 2P"', fontSize: '36px', color }).setOrigin(0.5);

    if (gs) {
      // Stats
      const mood = gs.getDominantPersonality();
      const moodInfo = mood ? PersonalitySystem.getMoodDescription(mood) : null;
      const stats = [
        `Hero: ${gs.hero}`,
        `Act ${gs.act}, Floor ${gs.floor}`,
        `Mood: ${moodInfo ? moodInfo.name : 'Undefined'}`,
        `Cards Played: ${gs.runStats.cards_played}`,
        `Damage Dealt: ${gs.runStats.damage_dealt}`,
        `Damage Taken: ${gs.runStats.damage_taken}`,
        `Enemies Killed: ${gs.runStats.enemies_killed}`,
        `Deck Size: ${gs.deck.length}`
      ];
      stats.forEach((s, i) => {
        this.add.text(SCREEN_WIDTH/2, 200 + i * 35, s, { fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#f0ead6' }).setOrigin(0.5);
      });

      // Share deck code
      const code = DeckCode.encode(gs);
      if (code) {
        this.add.text(SCREEN_WIDTH/2, 540, '[ COPY DECK CODE ]', {
          fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#4fc3f7'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => alert('Deck code copied!'));
          } else {
            alert('Deck code: ' + code);
          }
        });
      }
    }

    this.add.text(SCREEN_WIDTH/2, 620, '[ PLAY AGAIN ]', {
      fontFamily: '"Press Start 2P"', fontSize: '16px', color: '#4caf50'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.registry.set('gameState', null);
      this.scene.start('MenuScene');
    });
  }
}
