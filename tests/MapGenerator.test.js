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

    it('non-boss floors have 3 nodes', () => {
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
  });

  describe('Act 2 branch floors', () => {
    it('Act 2 has 1-2 branch floors with 4 nodes', () => {
      // Run many times to account for randomness
      let found4 = false;
      for (let i = 0; i < 20; i++) {
        const map = MapGenerator.generate(2);
        const branchFloors = map.floors.slice(0, -1).filter(f => f.length === 4);
        expect(branchFloors.length).toBeGreaterThanOrEqual(1);
        expect(branchFloors.length).toBeLessThanOrEqual(2);
        found4 = true;
      }
      expect(found4).toBe(true);
    });

    it('branch nodes appear only on floors 2-4', () => {
      for (let i = 0; i < 10; i++) {
        const map = MapGenerator.generate(2);
        for (let f = 0; f < map.floors.length - 1; f++) {
          const floor = map.floors[f];
          if (floor.length === 4) {
            expect(f).toBeGreaterThanOrEqual(2);
            expect(f).toBeLessThanOrEqual(4);
          }
        }
      }
    });

    it('branch nodes (4th node on branch floor) are rest, shop, or event', () => {
      const sidepathTypes = new Set([NODE_TYPES.REST, NODE_TYPES.SHOP, NODE_TYPES.EVENT]);
      for (let i = 0; i < 20; i++) {
        const map = MapGenerator.generate(2);
        for (const floor of map.floors) {
          if (floor.length === 4) {
            const branchNode = floor[3]; // 4th node is the branch node
            expect(sidepathTypes.has(branchNode.type)).toBe(true);
            expect(branchNode.branch).toBe(true);
          }
        }
      }
    });

    it('Act 1 and Act 3 never have branch floors', () => {
      for (let act of [1, 3]) {
        for (let i = 0; i < 10; i++) {
          const map = MapGenerator.generate(act);
          for (let f = 0; f < map.floors.length - 1; f++) {
            expect(map.floors[f].length).toBe(3);
          }
        }
      }
    });

    it('branch floors still have valid connections', () => {
      for (let i = 0; i < 10; i++) {
        const map = MapGenerator.generate(2);
        for (let f = 0; f < map.floors.length - 1; f++) {
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
