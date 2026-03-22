import { describe, it, expect } from 'vitest';
import { PersonalitySystem } from '../js/PersonalitySystem.js';
import { PERSONALITY } from '../js/constants.js';

describe('PersonalitySystem', () => {
  // ── getMoodDescription ────────────────────────────────────────────────────
  describe('getMoodDescription', () => {
    it('returns description for feisty', () => {
      const d = PersonalitySystem.getMoodDescription(PERSONALITY.FEISTY);
      expect(d).not.toBeNull();
      expect(d.name).toContain('Feisty');
    });

    it('returns description for cozy', () => {
      const d = PersonalitySystem.getMoodDescription(PERSONALITY.COZY);
      expect(d.name).toContain('Cozy');
    });

    it('returns description for cunning', () => {
      const d = PersonalitySystem.getMoodDescription(PERSONALITY.CUNNING);
      expect(d.name).toContain('Cunning');
    });

    it('returns description for feral', () => {
      const d = PersonalitySystem.getMoodDescription(PERSONALITY.FERAL);
      expect(d.name).toContain('FERAL');
    });

    it('returns null for unknown mood', () => {
      expect(PersonalitySystem.getMoodDescription('unknown')).toBeNull();
    });

    it('returns null for null mood', () => {
      expect(PersonalitySystem.getMoodDescription(null)).toBeNull();
    });
  });

  // ── getCardCost ───────────────────────────────────────────────────────────
  describe('getCardCost', () => {
    it('returns base cost for neutral mood', () => {
      const card = { cost: 2, type: 'attack' };
      expect(PersonalitySystem.getCardCost(card, null)).toBe(2);
    });

    it('feisty reduces attack card cost by 1', () => {
      const card = { cost: 2, type: 'attack' };
      expect(PersonalitySystem.getCardCost(card, PERSONALITY.FEISTY)).toBe(1);
    });

    it('feisty does not reduce skill card cost', () => {
      const card = { cost: 2, type: 'skill' };
      expect(PersonalitySystem.getCardCost(card, PERSONALITY.FEISTY)).toBe(2);
    });

    it('feisty does not reduce cost below 0', () => {
      const card = { cost: 0, type: 'attack' };
      expect(PersonalitySystem.getCardCost(card, PERSONALITY.FEISTY)).toBe(0);
    });

    it('non-feisty moods do not change cost', () => {
      const card = { cost: 1, type: 'attack' };
      expect(PersonalitySystem.getCardCost(card, PERSONALITY.COZY)).toBe(1);
      expect(PersonalitySystem.getCardCost(card, PERSONALITY.CUNNING)).toBe(1);
      expect(PersonalitySystem.getCardCost(card, PERSONALITY.FERAL)).toBe(1);
    });
  });

  // ── canHeal ───────────────────────────────────────────────────────────────
  describe('canHeal', () => {
    it('returns true for feisty', () => {
      expect(PersonalitySystem.canHeal(PERSONALITY.FEISTY)).toBe(true);
    });

    it('returns true for cozy', () => {
      expect(PersonalitySystem.canHeal(PERSONALITY.COZY)).toBe(true);
    });

    it('returns true for null', () => {
      expect(PersonalitySystem.canHeal(null)).toBe(true);
    });

    it('returns false for feral', () => {
      expect(PersonalitySystem.canHeal(PERSONALITY.FERAL)).toBe(false);
    });
  });

  // ── getUpgradeId ──────────────────────────────────────────────────────────
  describe('getUpgradeId', () => {
    const card = {
      id: 'w_strike',
      upgrades: {
        default: { effects: [{ type: 'damage', value: 9 }] },
        feisty: { effects: [{ type: 'damage', value: 10 }] }
      }
    };

    it('returns personality-suffixed id when mood upgrade exists', () => {
      expect(PersonalitySystem.getUpgradeId('w_strike', card, 'feisty'))
        .toBe('w_strike_u_feisty');
    });

    it('falls back to _u when mood has no specific upgrade', () => {
      expect(PersonalitySystem.getUpgradeId('w_strike', card, 'cozy'))
        .toBe('w_strike_u');
    });

    it('returns _u when mood is null', () => {
      expect(PersonalitySystem.getUpgradeId('w_strike', card, null))
        .toBe('w_strike_u');
    });

    it('returns _u when card has no upgrades object', () => {
      const plain = { id: 'x', cost: 1 };
      expect(PersonalitySystem.getUpgradeId('x', plain, 'feisty'))
        .toBe('x_u');
    });
  });

  // ── getUpgradePath ────────────────────────────────────────────────────────
  describe('getUpgradePath', () => {
    const baseCard = {
      id: 'w_strike', name: 'Strike', cost: 1, type: 'attack',
      upgrades: {
        default: { effects: [{ type: 'damage', value: 9 }] },
        feisty: { effects: [{ type: 'damage', value: 10 }] }
      }
    };

    it('returns mood-specific upgrade when available', () => {
      const result = PersonalitySystem.getUpgradePath(baseCard, PERSONALITY.FEISTY);
      expect(result.effects[0].value).toBe(10);
    });

    it('falls back to default when mood has no specific path', () => {
      const result = PersonalitySystem.getUpgradePath(baseCard, PERSONALITY.COZY);
      expect(result.effects[0].value).toBe(9);
    });

    it('returns base card when no upgrades', () => {
      const noUpgrades = { id: 'x', cost: 0, type: 'attack' };
      const result = PersonalitySystem.getUpgradePath(noUpgrades, PERSONALITY.FEISTY);
      expect(result).toBe(noUpgrades);
    });
  });
});
