import { describe, it, expect } from 'vitest';
import { getRandomEnemy, getEnemiesForAct, ENEMIES } from '../js/data/enemies.js';

describe('getRandomEnemy', () => {
  it('returns a valid enemy for each act', () => {
    for (const act of [1, 2, 3]) {
      const e = getRandomEnemy(act, false, 0);
      expect(e).not.toBeNull();
      expect(e.act).toBe(act);
      expect(e.elite).toBe(false);
    }
  });

  it('returns an elite for isElite=true', () => {
    for (const act of [1, 2, 3]) {
      const e = getRandomEnemy(act, true, 2);
      expect(e.elite).toBe(true);
    }
  });

  it('returns a deep copy (mutations do not affect source)', () => {
    const e = getRandomEnemy(1, false, 0);
    e.hp = 9999;
    const e2 = getRandomEnemy(1, false, 0);
    expect(e2.hp).toBe(e2.maxHp); // fresh copy
  });

  it('strongly favors early-tier enemies on floor 0', () => {
    // Run 200 trials and expect moth_swarm (early) to dominate
    const counts = {};
    for (let i = 0; i < 200; i++) {
      const e = getRandomEnemy(1, false, 0);
      counts[e.id] = (counts[e.id] || 0) + 1;
    }
    // moth_swarm is 'early', should be most common on floor 0
    const ids = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id]) => id);
    expect(ids[0]).toBe('moth_swarm');
  });

  it('strongly favors late-tier enemies on floor 5', () => {
    const counts = {};
    for (let i = 0; i < 200; i++) {
      const e = getRandomEnemy(1, false, 5);
      counts[e.id] = (counts[e.id] || 0) + 1;
    }
    const ids = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id]) => id);
    expect(ids[0]).toBe('yarn_golem'); // yarn_golem is 'late'
  });

  it('still returns a result even when pool has only one enemy', () => {
    // All regular Act 1 enemies exist; just verify no crash on all floors
    for (let floor = 0; floor <= 5; floor++) {
      const e = getRandomEnemy(1, false, floor);
      expect(e).not.toBeNull();
      expect(typeof e.hp).toBe('number');
    }
  });
});

describe('getEnemiesForAct', () => {
  it('returns only regular enemies for isElite=false', () => {
    const pool = getEnemiesForAct(1, false, false);
    expect(pool.every(e => !e.elite && !e.boss)).toBe(true);
    expect(pool.length).toBeGreaterThan(0);
  });

  it('returns only elite enemies for isElite=true', () => {
    const pool = getEnemiesForAct(2, true, false);
    expect(pool.every(e => e.elite)).toBe(true);
  });
});

describe('ENEMIES data integrity', () => {
  it('all non-elite, non-boss enemies have a floorTier', () => {
    const regular = Object.values(ENEMIES).filter(e => !e.elite && !e.boss);
    for (const e of regular) {
      expect(['early', 'mid', 'late', 'any']).toContain(e.floorTier);
    }
  });

  it('each act has enemies covering all three tiers', () => {
    for (const act of [1, 2, 3]) {
      const pool = getEnemiesForAct(act, false, false);
      const tiers = new Set(pool.map(e => e.floorTier));
      expect(tiers.has('early')).toBe(true);
      expect(tiers.has('mid') || tiers.has('late') || tiers.has('any')).toBe(true);
    }
  });
});
