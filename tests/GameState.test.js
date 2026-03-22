import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../js/GameState.js';

describe('GameState', () => {
  let gs;

  beforeEach(() => {
    // Clear localStorage between tests
    localStorage.clear();
    gs = new GameState();
    gs.startRun('WARRIOR');
  });

  // ── startRun ───────────────────────────────────────────────────────────────
  describe('startRun', () => {
    it('sets correct hp for WARRIOR', () => {
      expect(gs.hp).toBe(80);
      expect(gs.maxHp).toBe(80);
    });

    it('sets correct hp for MAGE', () => {
      const g = new GameState();
      g.startRun('MAGE');
      expect(g.hp).toBe(60);
    });

    it('sets correct hp for ROGUE', () => {
      const g = new GameState();
      g.startRun('ROGUE');
      expect(g.hp).toBe(70);
    });

    it('starts with 50 gold', () => {
      expect(gs.gold).toBe(50);
    });

    it('sets inRun = true', () => {
      expect(gs.inRun).toBe(true);
    });

    it('resets personality', () => {
      expect(gs.personality.feisty).toBe(0);
      expect(gs.personality.mood).toBeNull();
    });
  });

  // ── heal / takeDamage ──────────────────────────────────────────────────────
  describe('heal', () => {
    it('restores hp', () => {
      gs.hp = 50;
      gs.heal(10);
      expect(gs.hp).toBe(60);
    });

    it('does not exceed maxHp', () => {
      gs.hp = 75;
      gs.heal(20);
      expect(gs.hp).toBe(80);
    });
  });

  describe('takeDamage', () => {
    it('reduces hp', () => {
      gs.takeDamage(10);
      expect(gs.hp).toBe(70);
    });

    it('does not go below 0', () => {
      gs.takeDamage(999);
      expect(gs.hp).toBe(0);
    });

    it('returns true when hp reaches 0', () => {
      expect(gs.takeDamage(999)).toBe(true);
    });

    it('returns false when still alive', () => {
      expect(gs.takeDamage(10)).toBe(false);
    });
  });

  // ── deck management ────────────────────────────────────────────────────────
  describe('addCard / removeCard', () => {
    it('adds a card to the deck', () => {
      gs.addCard('w_strike');
      expect(gs.deck).toContain('w_strike');
    });

    it('removes the first occurrence of a card', () => {
      gs.addCard('w_strike');
      gs.addCard('w_strike');
      gs.removeCard('w_strike');
      expect(gs.deck.filter(c => c === 'w_strike').length).toBe(1);
    });

    it('does nothing when card not in deck', () => {
      gs.addCard('w_strike');
      gs.removeCard('w_defend');
      expect(gs.deck).toHaveLength(1);
    });
  });

  // ── upgradeCard ────────────────────────────────────────────────────────────
  describe('upgradeCard', () => {
    it('upgrades card id to id_u when no personality', () => {
      gs.addCard('w_strike');
      gs.upgradeCard('w_strike', null);
      expect(gs.deck).toContain('w_strike_u');
      expect(gs.deck).not.toContain('w_strike');
    });

    it('upgrades to personality variant when personality given', () => {
      gs.addCard('w_strike');
      gs.upgradeCard('w_strike', 'feisty');
      expect(gs.deck).toContain('w_strike_u_feisty');
      expect(gs.deck).not.toContain('w_strike');
    });

    it('returns true on success', () => {
      gs.addCard('w_strike');
      expect(gs.upgradeCard('w_strike', null)).toBe(true);
    });

    it('returns false when card not in deck', () => {
      expect(gs.upgradeCard('w_strike', null)).toBe(false);
    });

    it('returns false when card already upgraded (default suffix)', () => {
      gs.addCard('w_strike_u');
      expect(gs.upgradeCard('w_strike_u', null)).toBe(false);
    });

    it('returns false when card already upgraded (personality suffix)', () => {
      gs.addCard('w_strike_u_feisty');
      expect(gs.upgradeCard('w_strike_u_feisty', null)).toBe(false);
    });
  });

  // ── relic management ──────────────────────────────────────────────────────
  describe('addRelic / spendGold', () => {
    it('adds relic to list', () => {
      gs.addRelic('catnip');
      expect(gs.relics).toContain('catnip');
    });

    it('spends gold', () => {
      gs.spendGold(20);
      expect(gs.gold).toBe(30);
    });

    it('gold does not go below 0', () => {
      gs.spendGold(999);
      expect(gs.gold).toBe(0);
    });
  });

  // ── personality tracking ──────────────────────────────────────────────────
  describe('trackPersonality', () => {
    it('increments feisty on attack card plays', () => {
      gs.trackPersonality('attack');
      expect(gs.personality.feisty).toBe(1);
    });

    it('increments cozy on skill card plays', () => {
      gs.trackPersonality('skill');
      expect(gs.personality.cozy).toBe(1);
    });

    it('increments cunning on power card plays', () => {
      gs.trackPersonality('power');
      expect(gs.personality.cunning).toBe(1);
    });

    it('locks feisty mood at threshold', () => {
      for (let i = 0; i < 10; i++) gs.trackPersonality('attack');
      expect(gs.personality.mood).toBe('feisty');
    });

    it('mood does not change once locked', () => {
      for (let i = 0; i < 10; i++) gs.trackPersonality('attack');
      for (let i = 0; i < 15; i++) gs.trackPersonality('skill');
      expect(gs.personality.mood).toBe('feisty'); // locked, not cozy
    });

    it('does not track after feral lock', () => {
      gs.personality.feral = true;
      gs.trackPersonality('skill');
      expect(gs.personality.cozy).toBe(0);
    });

    it('sets feralPending at FERAL_WARNING_THRESHOLD (15 attack plays) instead of locking', () => {
      for (let i = 0; i < 15; i++) gs.trackPersonality('attack');
      expect(gs.personality.feralPending).toBe(true);
      expect(gs.personality.feral).toBe(false);
      expect(gs.personality.mood).not.toBe('feral');
    });

    it('does not auto-lock feral even at 20+ attack plays', () => {
      for (let i = 0; i < 22; i++) gs.trackPersonality('attack');
      expect(gs.personality.feral).toBe(false);
      expect(gs.personality.feralPending).toBe(true);
    });

    it('does not set feralPending if feralDeclined is true', () => {
      gs.personality.feralDeclined = true;
      for (let i = 0; i < 20; i++) gs.trackPersonality('attack');
      expect(gs.personality.feralPending).toBeFalsy();
    });

    it('locks cozy when cozy dominant at threshold', () => {
      for (let i = 0; i < 10; i++) gs.trackPersonality('skill');
      expect(gs.personality.mood).toBe('cozy');
    });

    it('locks cunning when cunning dominant at threshold', () => {
      for (let i = 0; i < 10; i++) gs.trackPersonality('power');
      expect(gs.personality.mood).toBe('cunning');
    });
  });

  // ── getDominantPersonality ────────────────────────────────────────────────
  describe('getDominantPersonality', () => {
    it('returns null with no plays', () => {
      expect(gs.getDominantPersonality()).toBeNull();
    });

    it('returns locked mood when set', () => {
      for (let i = 0; i < 10; i++) gs.trackPersonality('attack');
      expect(gs.getDominantPersonality()).toBe('feisty');
    });

    it('returns dominant unlocked mood', () => {
      gs.trackPersonality('attack');
      gs.trackPersonality('attack');
      gs.trackPersonality('skill');
      expect(gs.getDominantPersonality()).toBe('feisty');
    });
  });

  // ── localStorage persistence ──────────────────────────────────────────────
  describe('save / load', () => {
    it('save stores state in localStorage', () => {
      gs.save();
      expect(localStorage.getItem('purrogue_save')).not.toBeNull();
    });

    it('load restores saved run', () => {
      gs.addCard('w_strike');
      gs.save();
      const loaded = GameState.load();
      expect(loaded).not.toBeNull();
      expect(loaded.deck).toContain('w_strike');
    });

    it('load returns null when no save exists', () => {
      localStorage.clear();
      expect(GameState.load()).toBeNull();
    });

    it('endRun clears save and sets inRun false', () => {
      gs.save();
      gs.endRun();
      expect(gs.inRun).toBe(false);
      expect(localStorage.getItem('purrogue_save')).toBeNull();
    });
  });

  // ── pendingEnergyBonus ────────────────────────────────────────────────────
  describe('pendingEnergyBonus', () => {
    it('starts at 0', () => {
      expect(gs.pendingEnergyBonus).toBe(0);
    });
  });
});
