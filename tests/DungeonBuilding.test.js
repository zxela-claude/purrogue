import { describe, it, expect } from 'vitest';
import { getBiome, getBiomeNodeColor, getBiomeNodeLabel, BIOMES } from '../js/DungeonBuilding.js';
import { NODE_TYPES } from '../js/constants.js';

describe('DungeonBuilding', () => {
  describe('getBiome', () => {
    it('returns a biome for act 1', () => {
      const biome = getBiome(1);
      expect(biome).toBeDefined();
      expect(biome.name).toBe('The House');
    });

    it('returns a biome for act 2', () => {
      const biome = getBiome(2);
      expect(biome.name).toBe('The Neighbourhood');
    });

    it('returns a biome for act 3', () => {
      const biome = getBiome(3);
      expect(biome.name).toBe('The Rooftop');
    });

    it('falls back to act-1 biome for unknown acts', () => {
      expect(getBiome(0)).toEqual(getBiome(1));
      expect(getBiome(99)).toEqual(getBiome(1));
    });

    it('each biome has required fields', () => {
      for (const act of [1, 2, 3]) {
        const b = getBiome(act);
        expect(typeof b.name).toBe('string');
        expect(typeof b.headerSuffix).toBe('string');
        expect(typeof b.accentColor).toBe('number');
        expect(typeof b.fogColor).toBe('number');
        expect(b.nodeColors).toBeDefined();
        expect(b.nodeLabels).toBeDefined();
      }
    });

    it('each biome has colours for all node types', () => {
      const allTypes = Object.values(NODE_TYPES);
      for (const act of [1, 2, 3]) {
        const { nodeColors } = getBiome(act);
        for (const type of allTypes) {
          expect(typeof nodeColors[type]).toBe('number');
        }
      }
    });

    it('each biome has labels for all node types', () => {
      const allTypes = Object.values(NODE_TYPES);
      for (const act of [1, 2, 3]) {
        const { nodeLabels } = getBiome(act);
        for (const type of allTypes) {
          expect(typeof nodeLabels[type]).toBe('string');
          expect(nodeLabels[type].length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('getBiomeNodeColor', () => {
    it('returns a number for valid act + type', () => {
      const color = getBiomeNodeColor(1, NODE_TYPES.COMBAT);
      expect(typeof color).toBe('number');
    });

    it('returns 0x888888 for unknown node type', () => {
      expect(getBiomeNodeColor(1, 'unknown_type')).toBe(0x888888);
    });

    it('act-2 rest colour differs from act-1 rest colour', () => {
      const act1Rest = getBiomeNodeColor(1, NODE_TYPES.REST);
      const act2Rest = getBiomeNodeColor(2, NODE_TYPES.REST);
      expect(act1Rest).not.toBe(act2Rest);
    });
  });

  describe('getBiomeNodeLabel', () => {
    it('returns a string for valid act + type', () => {
      const label = getBiomeNodeLabel(2, NODE_TYPES.SHOP);
      expect(label).toBe('Trash Market');
    });

    it('returns node type string for unknown type', () => {
      expect(getBiomeNodeLabel(1, 'mystery')).toBe('mystery');
    });

    it('act-3 boss label is FINAL BOSS', () => {
      expect(getBiomeNodeLabel(3, NODE_TYPES.BOSS)).toBe('FINAL BOSS');
    });
  });

  describe('biome uniqueness', () => {
    it('all three biomes have distinct accent colours', () => {
      const accents = [1, 2, 3].map(a => getBiome(a).accentColor);
      const unique = new Set(accents);
      expect(unique.size).toBe(3);
    });

    it('all three biomes have distinct fog colours', () => {
      const fogs = [1, 2, 3].map(a => getBiome(a).fogColor);
      const unique = new Set(fogs);
      expect(unique.size).toBe(3);
    });
  });
});
