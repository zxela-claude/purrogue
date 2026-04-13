import { NODE_TYPES } from './constants.js';
import { SeededRandom } from './SeededRandom.js';
import { TEMPLATES, FLOOR_SCHEDULE } from './RoomTemplates.js';

const FLOOR_NODES = 3;
const FLOORS_PER_ACT = 7;

// Node weights per floor (used for non-guaranteed slots on STANDARD floors)
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
 * For Act 2, select 1–2 "wide" floors from the eligible middle floors.
 * Wide floors get an extra 4th node that is always a side-path type
 * (rest/shop/event) — WFC-inspired branch variety.
 *
 * DungeonRules constraint (NAN-202): only floors whose scheduled template is
 * STANDARD are eligible for widening — guaranteed-type floors (MERCHANT,
 * RESPITE) are excluded so their shop/rest slot is never clobbered.
 *
 * Uses a dedicated child RNG so it doesn't affect per-floor generation.
 *
 * @param {string[]} schedule - FLOOR_SCHEDULE array for this act
 * @param {SeededRandom} rng
 */
function buildAct2WideFloors(schedule, rng) {
  // Candidate floors: middle range (floors 2–4) that are STANDARD in the schedule
  const eligible = [2, 3, 4].filter(f => schedule[f] === 'STANDARD');
  if (eligible.length === 0) return new Set();
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
   * NAN-202: DungeonRules floor-schedule — each floor is assigned a named
   * RoomTemplate (COMBAT_START, STANDARD, MERCHANT, RESPITE, WIDE, BOSS_ROOM).
   * Templates with a guaranteedSlot lock one node index to a fixed type so
   * shops and rests appear on a deterministic schedule rather than via
   * post-hoc fixup.  The returned map includes a `floorTemplates` array
   * (template id per floor) for downstream use (UI, tests, analytics).
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

    // NAN-202: DungeonRules — resolve template schedule for this act.
    const schedule = FLOOR_SCHEDULE[act] || FLOOR_SCHEDULE[1];

    // Child index 0: act-level decisions (wide floor selection for Act 2).
    // NAN-173: Act 2 gets 1–2 wide floors from STANDARD-scheduled slots only
    // (DungeonRules: guaranteed-type floors are excluded from widening).
    const actRng = root.child(0);
    const wideFloors = act === 2 ? buildAct2WideFloors(schedule, actRng) : new Set();

    // Wide floors override their STANDARD slot with WIDE template.
    // All other floors follow the schedule directly.
    const resolvedTemplates = schedule.map((key, f) => {
      if (wideFloors.has(f)) return TEMPLATES.WIDE; // only STANDARD slots are eligible
      return TEMPLATES[key] || TEMPLATES.STANDARD;
    });

    const floors = [];
    for (let f = 0; f < FLOORS_PER_ACT; f++) {
      // Child indices 1–FLOORS_PER_ACT: one child RNG per floor for node types.
      // Changing a floor's seed doesn't affect any other floor's sequence.
      const floorRng = root.child(f + 1);
      const template = resolvedTemplates[f];
      const nodeCount = template.nodeCount;

      const floor = [];
      for (let n = 0; n < nodeCount; n++) {
        const isExtraNode = template.hasSidePath && n === nodeCount - 1;

        // DungeonRules guaranteed slot: if this template reserves nodeIndex n
        // for a specific type, use it directly without consuming an RNG value.
        const slot = template.guaranteedSlot;
        const isGuaranteed = slot !== null && slot.nodeIndex === n;

        let type;
        if (isGuaranteed) {
          type = slot.type;
        } else if (isExtraNode) {
          type = pickSidePathType(floorRng);
        } else {
          type = pickNodeType(f, floorRng);
        }

        floor.push({
          id: `${act}-${f}-${n}`,
          type,
          floor: f,
          node: n,
          completed: false,
          connections: [], // filled below
          isSidePath: isExtraNode,
          template: template.id
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

    // Lightweight safety net: ensure every path has at least one shop and
    // one rest. With DungeonRules templates in place this rarely fires, but
    // it guards against edge cases on STANDARD floors that roll no shops/rests.
    // Guaranteed-slot nodes are never reassigned by this pass.
    MapGenerator._ensureShopAndRest(floors, resolvedTemplates);

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

    return {
      act,
      floors,
      currentFloor: 0,
      currentNode: null,
      wideFloors: [...wideFloors],
      floorTemplates: resolvedTemplates.map(t => t.id),
      seed: rootSeed
    };
  }

  /**
   * Ensure every path from floor 0 to the boss has at least one shop and one
   * rest.  Guaranteed-slot nodes (those whose type is locked by a template)
   * are never reassigned so DungeonRules guarantees are never clobbered.
   *
   * @param {Array[]} floors           - the generated floor arrays
   * @param {object[]} resolvedTemplates - TEMPLATES objects parallel to floors
   */
  static _ensureShopAndRest(floors, resolvedTemplates = []) {
    // Build a set of node ids that are locked by a template guaranteedSlot
    const lockedIds = new Set();
    floors.forEach((floor, f) => {
      const tpl = resolvedTemplates[f];
      if (tpl && tpl.guaranteedSlot !== null) {
        const idx = tpl.guaranteedSlot.nodeIndex;
        if (floor[idx]) lockedIds.add(floor[idx].id);
      }
    });

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
        const candidates = path.filter(n =>
          n.floor > 0 &&
          n.type !== NODE_TYPES.SHOP &&
          n.type !== NODE_TYPES.REST &&
          n.type !== NODE_TYPES.BOSS &&
          !lockedIds.has(n.id)
        );
        if (candidates.length > 0) {
          candidates[0].type = NODE_TYPES.SHOP;
        }
      }

      if (!hasRest) {
        const candidates = path.filter(n =>
          n.floor > 0 &&
          n.type !== NODE_TYPES.SHOP &&
          n.type !== NODE_TYPES.REST &&
          n.type !== NODE_TYPES.BOSS &&
          !lockedIds.has(n.id)
        );
        if (candidates.length > 0) {
          candidates[0].type = NODE_TYPES.REST;
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
