import { NODE_TYPES } from './constants.js';

/**
 * RoomTemplates.js — ProceduralDungeon-inspired floor layout templates.
 *
 * NAN-202: Replaces hand-coded _ensureShopAndRest post-fixup with an upfront
 * DungeonRules schedule.  Each floor in an act is assigned a named template
 * that may reserve one node index as a guaranteed type (shop / rest / boss).
 * Because the schedule is deterministic and seed-independent, the same seed
 * always produces the same template selection AND the same node layout.
 *
 * Template fields
 * ───────────────
 * id             string   identifier stored on every generated node
 * nodeCount      number   how many nodes this floor produces
 * guaranteedSlot object|null   { nodeIndex, type } — one slot with a fixed type
 * hasSidePath    bool     last node is an Act-2-style optional detour
 * description    string   human-readable label
 */
export const TEMPLATES = {
  COMBAT_START: {
    id: 'combat_start',
    nodeCount: 3,
    guaranteedSlot: null,
    hasSidePath: false,
    description: 'Opening floor — all nodes are combat encounters'
  },
  STANDARD: {
    id: 'standard',
    nodeCount: 3,
    guaranteedSlot: null,
    hasSidePath: false,
    description: 'Three paths drawn from the full weighted type pool'
  },
  MERCHANT: {
    id: 'merchant',
    nodeCount: 3,
    guaranteedSlot: { nodeIndex: 1, type: NODE_TYPES.SHOP },
    hasSidePath: false,
    description: 'Centre node is always a shop (DungeonRules: one shop/floor)'
  },
  RESPITE: {
    id: 'respite',
    nodeCount: 3,
    guaranteedSlot: { nodeIndex: 1, type: NODE_TYPES.REST },
    hasSidePath: false,
    description: 'Centre node is always a rest site (DungeonRules: one rest per 2 floors)'
  },
  WIDE: {
    id: 'wide',
    nodeCount: 4,
    guaranteedSlot: null,
    hasSidePath: true,
    description: 'Four paths, the last is an off-path side detour (Act 2 WFC variant)'
  },
  BOSS_ROOM: {
    id: 'boss_room',
    nodeCount: 1,
    guaranteedSlot: { nodeIndex: 0, type: NODE_TYPES.BOSS },
    hasSidePath: false,
    description: 'Single node — the act boss'
  }
};

/**
 * Per-act DungeonRules floor schedule.
 * Maps each floor index (0–6) to a TEMPLATES key.
 *
 * Guarantees without post-hoc fixup:
 *   Act 1 — shop on floors 2 & 4, rest on floors 3 & 5
 *   Act 2 — rest on floors 1 & 5, shop on floor 3 (wide floors may enhance)
 *   Act 3 — rest on floors 2 & 5, shop on floor 3
 *
 * Act 2 STANDARD slots at floors 2 & 4 may be upgraded to WIDE at runtime
 * by MapGenerator when the WFC wide-floor selector picks them.
 */
export const FLOOR_SCHEDULE = {
  1: [
    'COMBAT_START', // 0 — always start fighting
    'STANDARD',     // 1
    'MERCHANT',     // 2 — shop guaranteed
    'RESPITE',      // 3 — rest guaranteed
    'MERCHANT',     // 4 — shop guaranteed
    'STANDARD',     // 5
    'BOSS_ROOM'     // 6
  ],
  2: [
    'COMBAT_START', // 0
    'RESPITE',      // 1 — rest guaranteed
    'STANDARD',     // 2 (may be widened by WFC system → WIDE template)
    'MERCHANT',     // 3 — shop guaranteed
    'STANDARD',     // 4 (may be widened)
    'RESPITE',      // 5 — rest guaranteed
    'BOSS_ROOM'     // 6
  ],
  3: [
    'COMBAT_START', // 0
    'STANDARD',     // 1
    'RESPITE',      // 2 — rest guaranteed
    'MERCHANT',     // 3 — shop guaranteed
    'STANDARD',     // 4
    'RESPITE',      // 5 — rest guaranteed
    'BOSS_ROOM'     // 6
  ]
};
