export const SCREEN_WIDTH = 1280;
export const SCREEN_HEIGHT = 720;
export const ENERGY_PER_TURN = 3;
export const HAND_SIZE = 5;
export const CARD_COSTS = { 0: 0, 1: 1, 2: 2 };

export const PERSONALITY = {
  FEISTY: 'feisty',
  COZY: 'cozy',
  CUNNING: 'cunning',
  FERAL: 'feral'
};

export const PERSONALITY_THRESHOLD = 10;

export const NODE_TYPES = {
  COMBAT: 'combat',
  ELITE: 'elite',
  SHOP: 'shop',
  EVENT: 'event',
  REST: 'rest',
  BOSS: 'boss'
};

export const COLORS = {
  BG: 0x1a1a2e,
  PANEL: 0x16213e,
  ACCENT: 0xe94560,
  TEXT: 0xf0ead6,
  GREEN: 0x4caf50,
  RED: 0xe94560,
  GOLD: 0xffd700,
  BLUE: 0x4fc3f7
};

export const HERO_CLASSES = {
  WARRIOR: { name: 'Warrior Cat', hp: 80, color: 0xe74c3c, emoji: '⚔️' },
  MAGE: { name: 'Mage Cat', hp: 60, color: 0x9b59b6, emoji: '🔮' },
  ROGUE: { name: 'Rogue Cat', hp: 70, color: 0x27ae60, emoji: '🗡️' }
};
