import { HERO_CLASSES, PERSONALITY, PERSONALITY_THRESHOLD, FERAL_WARNING_THRESHOLD, ENERGY_PER_TURN, HAND_SIZE } from './constants.js';

const SAVE_KEY = 'purrogue_save';
const SCORES_KEY = 'purrogue_scores';

export class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.hero = null;       // 'WARRIOR' | 'MAGE' | 'ROGUE'
    this.hp = 0;
    this.maxHp = 0;
    this.gold = 0;
    this.deck = [];         // array of card ids
    this.relics = [];       // array of relic ids
    this.act = 1;
    this.floor = 0;
    this.map = null;        // MapGenerator output
    this.currentNode = null;
    this.personality = {
      feisty: 0,
      cozy: 0,
      cunning: 0,
      mood: null,           // locked mood once threshold hit
      feral: false,
      feralPending: false,
      feralDeclined: false
    };
    this.runStats = {
      damage_dealt: 0,
      damage_taken: 0,
      cards_played: 0,
      enemies_killed: 0,
      turns: 0
    };
    this.combat = null;     // transient combat state
    this.pendingEnergyBonus = 0;
    this.pendingEnemyDamage = 0;
    this.inRun = false;
  }

  startRun(heroClass) {
    this.reset();
    const stats = HERO_CLASSES[heroClass];
    this.hero = heroClass;
    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.gold = 50;
    this.act = 1;
    this.floor = 0;
    this.inRun = true;
    this.save();
  }

  heal(amount) {
    this.hp = Math.min(this.hp + amount, this.maxHp);
    this.save();
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.save();
    return this.hp <= 0;
  }

  addCard(cardId) {
    this.deck.push(cardId);
    this.save();
  }

  removeCard(cardId) {
    const idx = this.deck.indexOf(cardId);
    if (idx !== -1) this.deck.splice(idx, 1);
    this.save();
  }

  upgradeCard(cardId, personality = null) {
    // Already upgraded: id ends with '_u' or '_u_<mood>'
    if (/_u(_\w+)?$/.test(cardId)) return false;
    const idx = this.deck.indexOf(cardId);
    if (idx === -1) return false;
    const newId = personality ? `${cardId}_u_${personality}` : `${cardId}_u`;
    this.deck[idx] = newId;
    this.save();
    return true;
  }

  addRelic(relicId) {
    const copies = this.relics.filter(r => r === relicId).length;
    if (copies >= 3) return;
    this.relics.push(relicId);
    this.save();
  }

  gainGold(amount) {
    const multiplier = this.relics.includes('golden_ball') ? 1.25 : 1;
    this.gold += Math.floor(amount * multiplier);
    this.save();
  }

  spendGold(amount) {
    this.gold = Math.max(0, this.gold - amount);
    this.save();
  }

  trackPersonality(cardType) {
    // cardType: 'attack' | 'skill' | 'power' | 'status'
    if (this.personality.feral) return;
    if (this.personality.feralDeclined) {
      // Still track but cap feisty below warning threshold
      if (cardType === 'attack') this.personality.feisty = Math.min(this.personality.feisty + 1, PERSONALITY_THRESHOLD);
      else if (cardType === 'skill') this.personality.cozy++;
      else if (cardType === 'power') this.personality.cunning++;
    } else {
      if (cardType === 'attack') this.personality.feisty++;
      else if (cardType === 'skill') this.personality.cozy++;
      else if (cardType === 'power') this.personality.cunning++;
    }

    const { feisty, cozy, cunning } = this.personality;
    const threshold = PERSONALITY_THRESHOLD;

    // Feral: pending prompt instead of auto-lock
    if (!this.personality.feralDeclined && feisty >= FERAL_WARNING_THRESHOLD) {
      this.personality.feralPending = true;
    } else if (!this.personality.mood) {
      if (feisty >= threshold && feisty >= cozy && feisty >= cunning) {
        this.personality.mood = PERSONALITY.FEISTY;
      } else if (cozy >= threshold && cozy >= feisty && cozy >= cunning) {
        this.personality.mood = PERSONALITY.COZY;
      } else if (cunning >= threshold && cunning >= feisty && cunning >= cozy) {
        this.personality.mood = PERSONALITY.CUNNING;
      }
    }
    this.save();
  }

  getDominantPersonality() {
    if (this.personality.mood) return this.personality.mood;
    const { feisty, cozy, cunning } = this.personality;
    const max = Math.max(feisty, cozy, cunning);
    if (max === 0) return null;
    if (feisty === max) return PERSONALITY.FEISTY;
    if (cozy === max) return PERSONALITY.COZY;
    return PERSONALITY.CUNNING;
  }

  save() {
    if (!this.inRun) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this));
    } catch(e) {}
  }

  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data.inRun) return null;
      const gs = new GameState();
      Object.assign(gs, data);
      return gs;
    } catch(e) { return null; }
  }

  computeScore(won) {
    const base = (this.act - 1) * 1000 + this.floor * 100;
    const killBonus = (this.runStats.enemies_killed || 0) * 25;
    const winBonus = won ? 500 : 0;
    return base + killBonus + winBonus;
  }

  saveScore(won) {
    const scores = GameState.getScores();
    scores.push({
      hero: this.hero,
      won,
      act: this.act,
      floor: this.floor,
      personality: this.getDominantPersonality(),
      relics: [...this.relics],
      score: this.computeScore(won),
      stats: this.runStats,
      date: new Date().toISOString()
    });
    scores.sort((a,b) => (b.score ?? 0) - (a.score ?? 0));
    try {
      localStorage.setItem(SCORES_KEY, JSON.stringify(scores.slice(0, 20)));
    } catch(e) {}
  }

  static getScores() {
    try {
      return JSON.parse(localStorage.getItem(SCORES_KEY) || '[]');
    } catch(e) { return []; }
  }

  endRun() {
    this.inRun = false;
    try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
  }
}
