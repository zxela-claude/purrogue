import { describe, it, expect } from 'vitest';
import { MapGenerator } from '../js/MapGenerator.js';
import { NODE_TYPES } from '../js/constants.js';

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

      it('wide floors only appear at floors 2, 3, or 4 in act 2', () => {
        for (let i = 0; i < 20; i++) {
          const map = MapGenerator.generate(2);
          for (const f of map.wideFloors) {
            expect([2, 3, 4]).toContain(f);
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
});
