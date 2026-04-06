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

// Side-path weights for Act 2 branch nodes — no combat/elite, favour rest/shop/event
const BRANCH_WEIGHTS = {
  [NODE_TYPES.REST]: 40,
  [NODE_TYPES.SHOP]: 35,
  [NODE_TYPES.EVENT]: 25
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

function pickBranchNodeType() {
  const total = Object.values(BRANCH_WEIGHTS).reduce((a, b) => a + b, 0);
  const roll = Math.random() * total;
  let cumulative = 0;
  for (const [type, weight] of Object.entries(BRANCH_WEIGHTS)) {
    cumulative += weight;
    if (roll < cumulative) return type;
  }
  return NODE_TYPES.REST;
}

// Pick 1-2 distinct floor indices from the middle section [2, FLOORS_PER_ACT-3]
// to serve as branch floors (extra node with a side-path flavour).
function chooseBranchFloors() {
  const eligible = [];
  for (let f = 2; f <= FLOORS_PER_ACT - 3; f++) eligible.push(f);
  // Shuffle first two eligible slots
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }
  const count = Math.random() < 0.5 ? 1 : 2;
  return new Set(eligible.slice(0, count));
}

export class MapGenerator {
  static generate(act, options = {}) {
    // Act 2 gets 1-2 branch floors with an extra side-path node
    const branchFloors = act === 2 ? chooseBranchFloors() : new Set();

    const floors = [];
    for (let f = 0; f < FLOORS_PER_ACT; f++) {
      const isBossFloor = f === FLOORS_PER_ACT - 1;
      const nodeCount = isBossFloor ? 1 : FLOOR_NODES + (branchFloors.has(f) ? 1 : 0);
      const floor = [];
      for (let n = 0; n < nodeCount; n++) {
        const isBranchNode = branchFloors.has(f) && n === nodeCount - 1;
        floor.push({
          id: `${act}-${f}-${n}`,
          type: isBranchNode ? pickBranchNodeType() : pickNodeType(f),
          floor: f,
          node: n,
          completed: false,
          connections: [], // filled below
          ...(isBranchNode && { branch: true })
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

    // Post-generation fixup: ensure every path to the boss has at least one
    // shop and one rest site. Walk all paths and force a node type if missing.
    MapGenerator._ensureShopAndRest(floors);

    // NAN-125 Petite modifier: replace ~20% of COMBAT nodes (not floor 0 or boss floor) with EVENT
    if (options.petite) {
      for (let f = 1; f < FLOORS_PER_ACT - 1; f++) {
        for (const node of floors[f]) {
          if (node.type === NODE_TYPES.COMBAT && Math.random() < 0.2) {
            node.type = NODE_TYPES.EVENT;
          }
        }
      }
    }

    return { act, floors, currentFloor: 0, currentNode: null };
  }

  static _ensureShopAndRest(floors) {
    // Collect all paths from floor 0 to the boss (last floor).
    const bossFloor = floors.length - 1;
    const paths = [];

    function walk(floorIdx, nodeId, path) {
      const node = floors[floorIdx].find(n => n.id === nodeId);
      if (!node) return;
      const newPath = [...path, node];
      if (floorIdx === bossFloor) {
        paths.push(newPath);
        return;
      }
      for (const connId of node.connections) {
        walk(floorIdx + 1, connId, newPath);
      }
    }

    for (const startNode of floors[0]) {
      walk(0, startNode.id, []);
    }

    for (const path of paths) {
      const hasShop = path.some(n => n.type === NODE_TYPES.SHOP);
      const hasRest = path.some(n => n.type === NODE_TYPES.REST);

      if (!hasShop) {
        // Pick the node closest to the boss (highest floor index) that is
        // not already a shop, rest, or boss — and isn't floor 0 (always combat).
        const candidates = path.filter(n =>
          n.floor > 0 &&
          n.type !== NODE_TYPES.SHOP &&
          n.type !== NODE_TYPES.REST &&
          n.type !== NODE_TYPES.BOSS
        );
        if (candidates.length > 0) {
          candidates[candidates.length - 1].type = NODE_TYPES.SHOP;
        }
      }

      if (!hasRest) {
        const candidates = path.filter(n =>
          n.floor > 0 &&
          n.type !== NODE_TYPES.SHOP &&
          n.type !== NODE_TYPES.REST &&
          n.type !== NODE_TYPES.BOSS
        );
        if (candidates.length > 0) {
          candidates[candidates.length - 1].type = NODE_TYPES.REST;
        }
      }
    }
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
