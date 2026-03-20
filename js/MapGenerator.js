import { NODE_TYPES } from './constants.js';

const FLOOR_NODES = 3;
const FLOORS_PER_ACT = 7;
const ACTS = 3;

// Node weights per floor (not boss floor)
const WEIGHTS = {
  [NODE_TYPES.COMBAT]: 40,
  [NODE_TYPES.ELITE]: 20,
  [NODE_TYPES.SHOP]: 15,
  [NODE_TYPES.EVENT]: 15,
  [NODE_TYPES.REST]: 10
};

function pickNodeType(floor) {
  if (floor === FLOORS_PER_ACT - 1) return NODE_TYPES.BOSS;
  if (floor === 0) return NODE_TYPES.COMBAT; // always start with combat
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const [type, weight] of Object.entries(WEIGHTS)) {
    cumulative += weight;
    if (roll < cumulative) return type;
  }
  return NODE_TYPES.COMBAT;
}

export class MapGenerator {
  static generate(act) {
    const floors = [];
    for (let f = 0; f < FLOORS_PER_ACT; f++) {
      const floor = [];
      for (let n = 0; n < (f === FLOORS_PER_ACT - 1 ? 1 : FLOOR_NODES); n++) {
        floor.push({
          id: `${act}-${f}-${n}`,
          type: pickNodeType(f),
          floor: f,
          node: n,
          completed: false,
          connections: [] // filled below
        });
      }
      floors.push(floor);
    }

    // Connect nodes: each node on floor f connects to 1-2 random nodes on floor f+1
    for (let f = 0; f < FLOORS_PER_ACT - 1; f++) {
      const curr = floors[f];
      const next = floors[f + 1];
      curr.forEach(node => {
        // Connect to at least 1 node on next floor
        const targets = new Set();
        targets.add(Math.floor(Math.random() * next.length));
        if (Math.random() > 0.5 && next.length > 1) {
          targets.add(Math.floor(Math.random() * next.length));
        }
        node.connections = [...targets].map(i => next[i].id);
      });
    }

    return { act, floors, currentFloor: 0, currentNode: null };
  }

  static getAvailableNodes(map) {
    const { floors, currentFloor, currentNode } = map;
    if (currentNode === null) return floors[0]; // first floor, all open
    const curr = floors[currentFloor].find(n => n.id === currentNode);
    if (!curr || currentFloor + 1 >= floors.length) return [];
    return curr.connections.map(id => {
      for (const floor of floors) {
        const node = floor.find(n => n.id === id);
        if (node) return node;
      }
      return null;
    }).filter(Boolean);
  }
}
