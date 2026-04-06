import { HERO_CLASSES, PERSONALITY, PERSONALITY_THRESHOLD, FERAL_WARNING_THRESHOLD, ENERGY_PER_TURN, HAND_SIZE } from './constants.js';
import { SeededRandom } from './SeededRandom.js';

const SAVE_KEY = 'purrogue_save';
const SCORES_KEY = 'purrogue_scores';

const ASCENSION_KEY = 'purrogue_ascension_unlocked';
const META_KEY      = 'purrogue_meta';

export class GameState {
  constructor() {
    this.ascensionUnlocked = GameState.loadAscensionUnlocked();
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
    // Daily challenge fields
    this.isDaily = false;
    this.dailySeed = null;
    this.dailyModifier = null;
    // Ghost run log: [{act, floor, score}] checkpoints recorded as floors complete
    this.ghostLog = [];
    // Ascension fields
    this.ascension = 0;     // 0 = Normal, 1-5 = tier for this run
    // Run modifier fields (NAN-125)
    this.runModifiers = []; // e.g. ['petite','relentless']
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
    // Glass Cannon: halve maxHp (runModifiers set before startRun via reset, apply after hero stats)
    // Note: runModifiers is applied after startRun call in MenuScene via gs.runModifiers assignment
    this.save();
  }

  // Apply run modifiers that depend on knowing the hero stats.
  // Called in MenuScene after runModifiers is set.
  applyRunModifiers() {
    if (this.runModifiers.includes('glass_cannon')) {
      this.maxHp = Math.max(1, Math.floor(this.maxHp / 2));
      this.hp = this.maxHp;
    }
    this.save();
  }

  hasModifier(id) {
    return Array.isArray(this.runModifiers) && this.runModifiers.includes(id);
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
    const threshold = this.getAscensionModifiers().personalityThreshold || PERSONALITY_THRESHOLD;

    // Feral: pending prompt instead of auto-lock
    const feralThreshold = (this.isDaily && this.dailyModifier && this.dailyModifier.id === 'fast_feral')
      ? 10
      : FERAL_WARNING_THRESHOLD;
    if (!this.personality.feralDeclined && feisty >= feralThreshold) {
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
      // Always use the current persisted ascensionUnlocked (may have changed)
      gs.ascensionUnlocked = GameState.loadAscensionUnlocked();
      return gs;
    } catch(e) { return null; }
  }

  computeScore(won) {
    const base = (this.act - 1) * 1000 + this.floor * 100;
    const killBonus = (this.runStats.enemies_killed || 0) * 25;
    const winBonus = won ? 500 : 0;
    const raw = base + killBonus + winBonus;

    // NAN-125: apply run modifier multipliers
    const MODIFIER_MULTS = {
      petite:      0.8,
      relentless:  1.3,
      bare_metal:  1.4,
      no_healing:  1.5,
      glass_cannon:1.6,
    };
    let mult = 1.0;
    for (const id of (this.runModifiers || [])) {
      if (MODIFIER_MULTS[id]) mult *= MODIFIER_MULTS[id];
    }
    return Math.round(raw * mult);
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
      ascension: this.ascension,
      runModifiers: [...(this.runModifiers || [])],
      date: new Date().toISOString()
    });
    scores.sort((a,b) => (b.score ?? 0) - (a.score ?? 0));
    try {
      localStorage.setItem(SCORES_KEY, JSON.stringify(scores.slice(0, 20)));
    } catch(e) {}
    // Unlock next ascension tier when winning at the highest unlocked tier
    if (won && this.ascension === this.ascensionUnlocked && this.ascensionUnlocked < 5) {
      this.ascensionUnlocked++;
      try {
        localStorage.setItem(ASCENSION_KEY, String(this.ascensionUnlocked));
      } catch(e) {}
    }
    // Update meta-progression
    GameState.saveMetaProgress(this, won);
  }

  static loadMeta() {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (!raw) return { heroWins: {}, a3Wins: {}, achievements: [] };
      return JSON.parse(raw);
    } catch(e) { return { heroWins: {}, a3Wins: {}, achievements: [] }; }
  }

  static saveMetaProgress(gs, won) {
    const meta = GameState.loadMeta();
    if (won) {
      const hero = gs.hero;
      meta.heroWins[hero] = (meta.heroWins[hero] || 0) + 1;
      if ((gs.ascension || 0) >= 3) {
        meta.a3Wins[hero] = (meta.a3Wins[hero] || 0) + 1;
      }
      const add = (id) => { if (!meta.achievements.includes(id)) meta.achievements.push(id); };
      add('first_win');
      if (['WARRIOR','MAGE','ROGUE'].every(h => (meta.heroWins[h] || 0) > 0)) add('all_heroes');
      if (gs.personality && gs.personality.feral) add('win_feral');
      if ((gs.ascension || 0) >= 5) add('a5_win');
      if ((gs.runModifiers || []).includes('no_healing')) add('no_heal_win');
    }
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch(e) {}
  }

  getAscensionModifiers() {
    const tier = this.ascension || 0;
    const mods = {};
    if (tier >= 1) mods.enemyHpBonus = 0.05;        // A1: enemies +5% max HP
    if (tier >= 2) mods.relicPriceBonus = 20;        // A2: shop relics cost +20 gold
    if (tier >= 3) mods.personalityThreshold = 12;   // A3: personality threshold reduced to 12
    if (tier >= 4) mods.bossThreshold = 0.6;         // A4: boss threshold at 60% HP
    if (tier >= 5) mods.startVulnerable = 2;         // A5: start each act with 2 Vulnerable
    return mods;
  }

  static loadAscensionUnlocked() {
    try {
      const val = localStorage.getItem(ASCENSION_KEY);
      return val !== null ? Math.min(5, Math.max(0, parseInt(val, 10) || 0)) : 0;
    } catch(e) { return 0; }
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

  static getDailySeed() {
    return new Date().toISOString().slice(0, 10); // "2026-03-25"
  }

  static getDailyModifier(seed) {
    const MODIFIERS = [
      { id: 'bonus_energy',  name: 'Energized',     desc: 'Start each combat with +1 energy' },
      { id: 'double_shop',   name: 'Grand Bazaar',   desc: 'Shop has 5 cards instead of 3' },
      { id: 'elites_only',   name: 'Elite Gauntlet', desc: 'All combat nodes are replaced with Elites' },
      { id: 'no_gold',       name: 'Pauper Run',     desc: 'Start with 0 gold — relics and removals are free' },
      { id: 'fast_feral',    name: 'Hair-Trigger',   desc: 'Feral warning triggers at 10 feisty instead of 20' },
      { id: 'all_upgraded',  name: 'Head Start',     desc: 'All starting cards are upgraded' },
      { id: 'cursed',        name: 'Cursed',         desc: 'Start every combat with 2 Vulnerable' },
      { id: 'lucky',         name: 'Lucky Day',      desc: 'Lucky Paw relic built in — always 4 reward choices' },
    ];
    const rng = new SeededRandom(seed);
    return rng.pick(MODIFIERS);
  }

  static getDailyStorageKey(seed) {
    return `purrogue_daily_${seed}`;
  }

  // Record a ghost checkpoint at the current act/floor (call after each floor victory)
  logGhostCheckpoint() {
    if (!this.isDaily) return;
    this.ghostLog.push({ act: this.act, floor: this.floor, score: this.computeScore(false) });
  }

  saveDailyScore(won) {
    if (!this.isDaily || !this.dailySeed) return;
    const key = GameState.getDailyStorageKey(this.dailySeed);
    const existing = (() => {
      try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch(e) { return null; }
    })();
    const score = this.computeScore(won);
    // Add final checkpoint
    const finalLog = [...this.ghostLog, { act: this.act, floor: this.floor, score }];
    if (!existing || score > existing.score) {
      try {
        localStorage.setItem(key, JSON.stringify({
          score,
          hero: this.hero,
          won,
          modifier: this.dailyModifier,
          date: this.dailySeed,
          checkpoints: finalLog,
          stats: this.runStats
        }));
      } catch(e) {}
    }
  }

  static getDailyBestScore(seed) {
    try {
      const raw = localStorage.getItem(GameState.getDailyStorageKey(seed));
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  // Returns ghost run checkpoints for the given daily seed (best run)
  static getDailyGhostRecord(seed) {
    const best = GameState.getDailyBestScore(seed);
    return (best && best.checkpoints) ? best : null;
  }
}
