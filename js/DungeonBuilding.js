import { NODE_TYPES } from './constants.js';

/**
 * DungeonBuilding.js — NAN-215: Data Asset-driven biome variant support.
 *
 * Each act maps to a named biome that drives the visual and thematic identity
 * of all dungeon scenes (map, combat, event).  Scenes import getBiome(act)
 * instead of hard-coding act-specific colours or labels.
 *
 * Biome fields
 * ────────────
 * name          string   display name shown in the act header
 * nodeColors    object   NODE_TYPES → Phaser hex int, overrides flat defaults
 * nodeLabels    object   NODE_TYPES → string,  flavour label on the map node
 * fogColor      number   dark overlay tint applied to the scene background
 * accentColor   number   primary UI accent (progress bars, highlights)
 * headerSuffix  string   short subtitle appended to the "ACT N" header
 */
const BIOMES = {
  /** Act 1 — The House: cosy indoor dungeon, warm purples and reds */
  1: {
    name: 'The House',
    headerSuffix: 'THE HOUSE',
    accentColor: 0xe94560,
    fogColor: 0x1a1a2e,
    nodeColors: {
      [NODE_TYPES.COMBAT]: 0xe94560,
      [NODE_TYPES.ELITE]:  0x9b59b6,
      [NODE_TYPES.SHOP]:   0xffd700,
      [NODE_TYPES.EVENT]:  0x4fc3f7,
      [NODE_TYPES.REST]:   0x4caf50,
      [NODE_TYPES.BOSS]:   0xff4400
    },
    nodeLabels: {
      [NODE_TYPES.COMBAT]: 'Scuffle',
      [NODE_TYPES.ELITE]:  'Guard Dog',
      [NODE_TYPES.SHOP]:   'Treat Stash',
      [NODE_TYPES.EVENT]:  'Curious Spot',
      [NODE_TYPES.REST]:   'Nap Nook',
      [NODE_TYPES.BOSS]:   'BOSS'
    }
  },

  /** Act 2 — The Neighbourhood: outdoor garden paths, earthy greens */
  2: {
    name: 'The Neighbourhood',
    headerSuffix: 'THE NEIGHBOURHOOD',
    accentColor: 0x4caf50,
    fogColor: 0x080f08,
    nodeColors: {
      [NODE_TYPES.COMBAT]: 0xcc4422,
      [NODE_TYPES.ELITE]:  0x667722,
      [NODE_TYPES.SHOP]:   0xffaa00,
      [NODE_TYPES.EVENT]:  0x22aaaa,
      [NODE_TYPES.REST]:   0x228855,
      [NODE_TYPES.BOSS]:   0xff4400
    },
    nodeLabels: {
      [NODE_TYPES.COMBAT]: 'Scuffle',
      [NODE_TYPES.ELITE]:  'Stray Dog',
      [NODE_TYPES.SHOP]:   'Trash Market',
      [NODE_TYPES.EVENT]:  'Strange Scent',
      [NODE_TYPES.REST]:   'Sunny Patch',
      [NODE_TYPES.BOSS]:   'TOP DOG'
    }
  },

  /** Act 3 — The Rooftop: high-altitude drama, fiery oranges and magentas */
  3: {
    name: 'The Rooftop',
    headerSuffix: 'THE ROOFTOP',
    accentColor: 0xff6600,
    fogColor: 0x120800,
    nodeColors: {
      [NODE_TYPES.COMBAT]: 0xff3300,
      [NODE_TYPES.ELITE]:  0xaa22aa,
      [NODE_TYPES.SHOP]:   0xffdd00,
      [NODE_TYPES.EVENT]:  0x00aacc,
      [NODE_TYPES.REST]:   0x00bb77,
      [NODE_TYPES.BOSS]:   0xff2200
    },
    nodeLabels: {
      [NODE_TYPES.COMBAT]: 'Brawl',
      [NODE_TYPES.ELITE]:  'Bouncer',
      [NODE_TYPES.SHOP]:   'Black Market',
      [NODE_TYPES.EVENT]:  'Strange Wind',
      [NODE_TYPES.REST]:   'Hidden Ledge',
      [NODE_TYPES.BOSS]:   'FINAL BOSS'
    }
  }
};

/** Fallback biome used when act is out of range. */
const FALLBACK_BIOME = BIOMES[1];

/**
 * Return the biome config for the given act number.
 * Clamps gracefully — acts outside 1–3 return the Act-1 biome.
 *
 * @param {number} act
 * @returns {{ name, headerSuffix, accentColor, fogColor, nodeColors, nodeLabels }}
 */
export function getBiome(act) {
  return BIOMES[act] || FALLBACK_BIOME;
}

/**
 * Convenience: return the node colour for a given type within an act's biome.
 *
 * @param {number} act
 * @param {string} nodeType  - one of NODE_TYPES values
 * @returns {number} Phaser-compatible hex integer
 */
export function getBiomeNodeColor(act, nodeType) {
  return getBiome(act).nodeColors[nodeType] ?? 0x888888;
}

/**
 * Convenience: return the node label for a given type within an act's biome.
 *
 * @param {number} act
 * @param {string} nodeType
 * @returns {string}
 */
export function getBiomeNodeLabel(act, nodeType) {
  return getBiome(act).nodeLabels[nodeType] ?? nodeType;
}

export { BIOMES };
