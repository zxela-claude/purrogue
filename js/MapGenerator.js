import { NODE_TYPES } from './constants.js';
import { SeededRandom } from './SeededRandom.js';

const FLOOR_NODES = 3;
const FLOORS_PER_ACT = 7;

// Node weights per floor (not boss floor)
const WEIGHTS = {
  [NODE_TYPES.COMBAT]: 40,
  [NODE_TYPES.ELITE]: 20,
  [NODE_TYPES.SHOP]: 15,
  [NODE_TYPES.EVENT]: 15,
  [NODE_TYPES.REST]: 10
};

// Side-path types used for Act 2 branch nodes (no combat on optional detours)
const SIDE_PATH_TYPES = [NODE_TYPES.REST, NODE_TYPES.SHOP, NODE_TYPES.EVENT];

function pickNodeType(floor, rng) {
  if (floor === FLOORS_PER_ACT - 1) return NODE_TYPES.BOSS;
  if (floor === 0) return NODE_TYPES.COMBAT; // always start with combat
  const roll = rng.next() * 100;
  let cumulative = 0;
  for (const [type, weight] of Object.entries(WEIGHTS)) {
    cumulative += weight;
    if (roll < cumulative) return type;
  }
  return NODE_TYPES.COMBAT;
}

function pickSidePathType(rng) {
  return SIDE_PATH_TYPES[Math.floor(rng.next() * SIDE_PATH_TYPES.length)];
}

/**
 * For Act 2, select 1–2 "wide" floors from the eligible middle floors
 * (floors 2–4). Wide floors get an extra 4th node that is always a
 * side-path type (rest/shop/event) — WFC-inspired branch variety.
 * Uses a dedicated child RNG so it doesn't affect per-floor generation.
 */
function buildAct2WideFloors(rng) {
  const eligible = [2, 3, 4];
  // Shuffle in-place (Fisher-Yates) then take 1 or 2
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }
  const count = 1 + Math.floor(rng.next() * 2); // 1 or 2
  return new Set(eligible.slice(0, count));
}

export class MapGenerator {
  /**
   * Generate a floor map for the given act.
   *
   * NAN-203: FRandomStream child-seed pattern — a root SeededRandom is
   * created from `seed`, then each floor receives its own child RNG
   * (root.child(floor+1)) so floors are independent and the full map
   * is deterministic given the same seed.  Connection wiring and the
   * petite modifier each get their own child index range too.
   *
   * @param {number} act  - Act number (1–3)
   * @param {object} [options] - { petite: bool }
   * @param {number|string} [seed] - Seed for deterministic generation.
   *   Omit for a random (non-reproducible) run.
   */
  static generate(act, options = {}, seed) {
    const rootSeed = seed !== undefined
      ? seed
      : (Math.random() * 0xFFFFFFFF | 0) || 1;
    const root = new SeededRandom(rootSeed);

    // Child index 0: act-level decisions (wide floor selection for Act 2)
    const actRng = root.child(0);
    // NAN-173: Act 2 gets 1–2 wide floors with an extra side-path branch node
    const wideFloors = act === 2 ? buildAct2WideFloors(actRng) : new Set();

    const floors = [];
    for (let f = 0; f < FLOORS_PER_ACT; f++) {
      // Child indices 1–FLOORS_PER_ACT: one child RNG per floor for node types.
      // Changing a floor's seed doesn't affect any other floor's sequence.
      const floorRng = root.child(f + 1);

      const floor = [];
      const isBossFloor = f === FLOORS_PER_ACT - 1;
      const nodeCount = isBossFloor ? 1 : (wideFloors.has(f) ? FLOOR_NODES + 1 : FLOOR_NODES);

      for (let n = 0; n < nodeCount; n++) {
        const isExtraNode = wideFloors.has(f) && n === nodeCount - 1;
        floor.push({
          id: `${act}-${f}-${n}`,
          type: isExtraNode ? pickSidePathType(floorRng) : pickNodeType(f, floorRng),
          floor: f,
          node: n,
          completed: false,
          connections: [], // filled below
          isSidePath: isExtraNode // optional detour — UI can style differently
        });
      }
      floors.push(floor);
    }

    // Connect nodes: each node on floor f connects to 1-2 random nodes on floor f+1.
    // Child indices FLOORS_PER_ACT+1 … 2*FLOORS_PER_ACT: one per inter-floor connection pass.
    for (let f = 0; f < FLOORS_PER_ACT - 1; f++) {
      const connRng = root.child(FLOORS_PER_ACT + 1 + f);
      const curr = floors[f];
      const next = floors[f + 1];
      curr.forEach(node => {
        const targets = new Set();
        targets.add(Math.floor(connRng.next() * next.length));
        if (connRng.next() > 0.5 && next.length > 1) {
          targets.add(Math.floor(connRng.next() * next.length));
        }
        node.connections = [...targets].map(i => next[i].id);
      });
    }

    // Post-generation fixup: ensure every path to the boss has at least one
    // shop and one rest site. Walk all paths and force a node type if missing.
    MapGenerator._ensureShopAndRest(floors);

    // NAN-125 Petite modifier: replace ~20% of COMBAT nodes (not floor 0 or boss floor) with EVENT
    if (options.petite) {
      const petiteRng = root.child(FLOORS_PER_ACT * 2 + 1);
      for (let f = 1; f < FLOORS_PER_ACT - 1; f++) {
        for (const node of floors[f]) {
          if (node.type === NODE_TYPES.COMBAT && petiteRng.next() < 0.2) {
            node.type = NODE_TYPES.EVENT;
          }
        }
      }
    }

    return { act, floors, currentFloor: 0, currentNode: null, wideFloors: [...wideFloors], seed: rootSeed };
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
