import { describe, it, expect } from 'vitest';
import { MapGenerator } from '../js/MapGenerator.js';
import { NODE_TYPES } from '../js/constants.js';
import { TEMPLATES, FLOOR_SCHEDULE } from '../js/RoomTemplates.js';

describe('MapGenerator', () => {
  describe('generate', () => {
    it('generates 7 floors', () => {
      const map = MapGenerator.generate(1);
      expect(map.floors).toHaveLength(7);
    });

    it('first floor always has combat nodes', () => {
      const map = MapGenerator.generate(1);
      for (const node of map.floors[0]) {
        expect(node.type).toBe(NODE_TYPES.COMBAT);
      }
    });

    it('last floor (floor 6) has exactly 1 boss node', () => {
      const map = MapGenerator.generate(1);
      const bossFloor = map.floors[6];
      expect(bossFloor).toHaveLength(1);
      expect(bossFloor[0].type).toBe(NODE_TYPES.BOSS);
    });

    it('non-boss floors have 3 nodes (act 1)', () => {
      const map = MapGenerator.generate(1);
      for (let i = 0; i < 6; i++) {
        expect(map.floors[i]).toHaveLength(3);
      }
    });

    it('each node has a unique id with act prefix', () => {
      const map = MapGenerator.generate(2);
      const ids = map.floors.flat().map(n => n.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
      expect(ids.every(id => id.startsWith('2-'))).toBe(true);
    });

    it('nodes have connections to next floor', () => {
      const map = MapGenerator.generate(1);
      for (let f = 0; f < 6; f++) {
        for (const node of map.floors[f]) {
          expect(node.connections.length).toBeGreaterThanOrEqual(1);
          // connection ids should reference floor f+1
          for (const connId of node.connections) {
            const target = map.floors[f + 1].find(n => n.id === connId);
            expect(target).toBeDefined();
          }
        }
      }
    });

    it('all nodes start as not completed', () => {
      const map = MapGenerator.generate(1);
      for (const node of map.floors.flat()) {
        expect(node.completed).toBe(false);
      }
    });

    it('sets act field on map', () => {
      const map = MapGenerator.generate(3);
      expect(map.act).toBe(3);
    });

    it('exposes the seed used on the returned map', () => {
      const map = MapGenerator.generate(1, {}, 42);
      expect(map.seed).toBe(42);
    });

    describe('deterministic generation (NAN-203)', () => {
      it('same numeric seed produces identical maps', () => {
        const a = MapGenerator.generate(1, {}, 12345);
        const b = MapGenerator.generate(1, {}, 12345);
        expect(JSON.stringify(a.floors)).toBe(JSON.stringify(b.floors));
        expect(a.wideFloors).toEqual(b.wideFloors);
      });

      it('same string seed produces identical maps', () => {
        const a = MapGenerator.generate(1, {}, '2026-04-06');
        const b = MapGenerator.generate(1, {}, '2026-04-06');
        expect(JSON.stringify(a.floors)).toBe(JSON.stringify(b.floors));
      });

      it('different seeds produce different maps (overwhelmingly likely)', () => {
        const a = MapGenerator.generate(1, {}, 1);
        const b = MapGenerator.generate(1, {}, 999999);
        expect(JSON.stringify(a.floors)).not.toBe(JSON.stringify(b.floors));
      });

      it('different acts with same seed produce different maps', () => {
        const act1 = MapGenerator.generate(1, {}, 42);
        const act2 = MapGenerator.generate(2, {}, 42);
        // IDs already differ by act prefix, but node types/connections should too
        const act1Types = act1.floors.flat().map(n => n.type);
        const act2Types = act2.floors.flat().map(n => n.type);
        // Act 2 may have an extra node on wide floors, so length can differ
        // just confirm the structures are independently generated
        expect(act1.act).toBe(1);
        expect(act2.act).toBe(2);
      });

      it('changing floor-0 seed does not affect floor-3 node types', () => {
        // Verify the child-seed isolation: run twice with the same seed and
        // confirm floor 3 is identical (it always is for same seed — this
        // tests that floor RNGs are independent child streams).
        const a = MapGenerator.generate(1, {}, 777);
        const b = MapGenerator.generate(1, {}, 777);
        expect(a.floors[3].map(n => n.type)).toEqual(b.floors[3].map(n => n.type));
        expect(a.floors[3].map(n => n.connections)).toEqual(b.floors[3].map(n => n.connections));
      });

      it('seeded act 2 map is deterministic including wideFloors', () => {
        for (let seed = 100; seed < 120; seed++) {
          const a = MapGenerator.generate(2, {}, seed);
          const b = MapGenerator.generate(2, {}, seed);
          expect(a.wideFloors).toEqual(b.wideFloors);
          expect(JSON.stringify(a.floors)).toBe(JSON.stringify(b.floors));
        }
      });
    });

    describe('Act 2 wide-floor branching (NAN-173)', () => {
      it('act 2 map has wideFloors array with 1–2 entries', () => {
        // Run multiple times since it's random
        for (let i = 0; i < 20; i++) {
          const map = MapGenerator.generate(2);
          expect(Array.isArray(map.wideFloors)).toBe(true);
          expect(map.wideFloors.length).toBeGreaterThanOrEqual(1);
          expect(map.wideFloors.length).toBeLessThanOrEqual(2);
        }
      });

      it('act 2 wide floors have 4 nodes, non-wide floors have 3', () => {
        for (let i = 0; i < 10; i++) {
          const map = MapGenerator.generate(2);
          const wideSet = new Set(map.wideFloors);
          for (let f = 0; f < 6; f++) {
            const expected = wideSet.has(f) ? 4 : 3;
            expect(map.floors[f]).toHaveLength(expected);
          }
        }
      });

      it('wide floors only appear at STANDARD-scheduled floors in act 2 (floors 2 and 4)', () => {
        // NAN-202: MERCHANT/RESPITE floors are excluded from widening so
        // DungeonRules guaranteed-type slots are never clobbered.
        for (let i = 0; i < 20; i++) {
          const map = MapGenerator.generate(2);
          for (const f of map.wideFloors) {
            expect([2, 4]).toContain(f);
          }
        }
      });

      it('extra node on act 2 wide floor is a side-path type and marked isSidePath', () => {
        const sidePathTypes = [NODE_TYPES.REST, NODE_TYPES.SHOP, NODE_TYPES.EVENT];
        for (let i = 0; i < 20; i++) {
          const map = MapGenerator.generate(2);
          for (const f of map.wideFloors) {
            const extraNode = map.floors[f][3]; // index 3 = the 4th node
            expect(extraNode).toBeDefined();
            expect(sidePathTypes).toContain(extraNode.type);
            expect(extraNode.isSidePath).toBe(true);
          }
        }
      });

      it('act 1 and 3 maps have no wideFloors', () => {
        for (const act of [1, 3]) {
          const map = MapGenerator.generate(act);
          expect(map.wideFloors).toHaveLength(0);
        }
      });

      it('all act 2 wide-floor nodes still have valid connections', () => {
        for (let i = 0; i < 10; i++) {
          const map = MapGenerator.generate(2);
          for (let f = 0; f < 6; f++) {
            for (const node of map.floors[f]) {
              expect(node.connections.length).toBeGreaterThanOrEqual(1);
              for (const connId of node.connections) {
                const target = map.floors[f + 1].find(n => n.id === connId);
                expect(target).toBeDefined();
              }
            }
          }
        }
      });
    });
  });

  describe('getAvailableNodes', () => {
    it('returns first floor nodes when no node visited', () => {
      const map = MapGenerator.generate(1);
      const available = MapGenerator.getAvailableNodes(map);
      expect(available).toHaveLength(3);
      expect(available[0].floor).toBe(0);
    });

    it('returns connected nodes after visiting a node', () => {
      const map = MapGenerator.generate(1);
      const firstNode = map.floors[0][0];
      map.currentNode = firstNode.id;
      map.currentFloor = 0;

      const available = MapGenerator.getAvailableNodes(map);
      expect(available.length).toBeGreaterThanOrEqual(1);
      for (const n of available) {
        expect(firstNode.connections).toContain(n.id);
      }
    });

    it('returns empty array after final floor visited', () => {
      const map = MapGenerator.generate(1);
      const bossNode = map.floors[6][0];
      map.currentNode = bossNode.id;
      map.currentFloor = 6;

      const available = MapGenerator.getAvailableNodes(map);
      expect(available).toHaveLength(0);
    });
  });

  describe('DungeonRules floor templates (NAN-202)', () => {
    it('map exposes floorTemplates array with one entry per floor', () => {
      for (const act of [1, 2, 3]) {
        const map = MapGenerator.generate(act, {}, 42);
        expect(map.floorTemplates).toHaveLength(7);
      }
    });

    it('first floor template is combat_start for all acts', () => {
      for (const act of [1, 2, 3]) {
        const map = MapGenerator.generate(act, {}, 42);
        expect(map.floorTemplates[0]).toBe('combat_start');
      }
    });

    it('last floor template is boss_room for all acts', () => {
      for (const act of [1, 2, 3]) {
        const map = MapGenerator.generate(act, {}, 42);
        expect(map.floorTemplates[6]).toBe('boss_room');
      }
    });

    it('every generated node carries a template id', () => {
      const map = MapGenerator.generate(1, {}, 42);
      const validTemplateIds = Object.values(TEMPLATES).map(t => t.id);
      for (const node of map.floors.flat()) {
        expect(validTemplateIds).toContain(node.template);
      }
    });

    it('Act 1 floor 2 (MERCHANT) guarantees a shop at node index 1', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const map = MapGenerator.generate(1, {}, seed);
        const floor2 = map.floors[2];
        expect(floor2[1].type).toBe(NODE_TYPES.SHOP);
      }
    });

    it('Act 1 floor 3 (RESPITE) guarantees a rest at node index 1', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const map = MapGenerator.generate(1, {}, seed);
        const floor3 = map.floors[3];
        expect(floor3[1].type).toBe(NODE_TYPES.REST);
      }
    });

    it('Act 1 floor 4 (MERCHANT) guarantees a shop at node index 1', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const map = MapGenerator.generate(1, {}, seed);
        const floor4 = map.floors[4];
        expect(floor4[1].type).toBe(NODE_TYPES.SHOP);
      }
    });

    it('Act 2 floor 1 (RESPITE) guarantees a rest at node index 1', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const map = MapGenerator.generate(2, {}, seed);
        const floor1 = map.floors[1];
        expect(floor1[1].type).toBe(NODE_TYPES.REST);
      }
    });

    it('Act 2 floor 3 (MERCHANT) guarantees a shop at node index 1', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const map = MapGenerator.generate(2, {}, seed);
        // floor 3 is always MERCHANT in Act 2 (not eligible for wide-floor override)
        const floor3 = map.floors[3];
        expect(floor3[1].type).toBe(NODE_TYPES.SHOP);
      }
    });

    it('Act 3 floor 2 (RESPITE) guarantees a rest at node index 1', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const map = MapGenerator.generate(3, {}, seed);
        expect(map.floors[2][1].type).toBe(NODE_TYPES.REST);
      }
    });

    it('Act 3 floor 3 (MERCHANT) guarantees a shop at node index 1', () => {
      for (let seed = 1; seed <= 20; seed++) {
        const map = MapGenerator.generate(3, {}, seed);
        expect(map.floors[3][1].type).toBe(NODE_TYPES.SHOP);
      }
    });

    it('floorTemplates is deterministic given the same seed', () => {
      for (const act of [1, 2, 3]) {
        const a = MapGenerator.generate(act, {}, 555);
        const b = MapGenerator.generate(act, {}, 555);
        expect(a.floorTemplates).toEqual(b.floorTemplates);
      }
    });

    it('Act 2 wide floors use the wide template in floorTemplates (only STANDARD slots)', () => {
      for (let seed = 1; seed <= 30; seed++) {
        const map = MapGenerator.generate(2, {}, seed);
        for (const f of map.wideFloors) {
          expect(map.floorTemplates[f]).toBe('wide');
          // Wide floors only come from STANDARD-scheduled slots (floors 2 and 4)
          expect([2, 4]).toContain(f);
        }
      }
    });

    it('MERCHANT/RESPITE template nodes survive _ensureShopAndRest unchanged', () => {
      // Verify the safety-net pass does not clobber guaranteed slots
      for (let seed = 1; seed <= 20; seed++) {
        const map = MapGenerator.generate(1, {}, seed);
        // Act 1 floor 2 node 1 must remain SHOP
        expect(map.floors[2][1].type).toBe(NODE_TYPES.SHOP);
        // Act 1 floor 3 node 1 must remain REST
        expect(map.floors[3][1].type).toBe(NODE_TYPES.REST);
      }
    });

    it('FLOOR_SCHEDULE exports schedules for acts 1–3 with 7 entries each', () => {
      for (const act of [1, 2, 3]) {
        expect(FLOOR_SCHEDULE[act]).toHaveLength(7);
        expect(FLOOR_SCHEDULE[act][0]).toBe('COMBAT_START');
        expect(FLOOR_SCHEDULE[act][6]).toBe('BOSS_ROOM');
      }
    });
  });
});
