#!/usr/bin/env node
// extract_sprites.cjs
// Bespoke extraction using pixel-projection-detected bounding boxes.
// Run: node scripts/extract_sprites.cjs
//
// HOW BOUNDING BOXES WERE FOUND:
//   scripts/detect_sprites.cjs scans each row/col for non-background pixels,
//   finds contiguous content bands (>80px), and outputs exact x/y/w/h per cell.
//   Re-run detection anytime a tilesheet is regenerated to get updated coords.
//
// GRID NOTES:
//   heroes.png   → 3×3 grid, 9 sprites
//   enemies.png  → 4×2 grid, 8 sprites
//   mapnodes.png → 3×2 grid, 6 sprites
//   ui.png       → AI generated 3×3 (9 cells) for requested 4×2 (8 sprites);
//                  8 sprites mapped to first 8 cells, 9th cell skipped.

const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

const ASSETS = path.resolve(__dirname, '..', 'assets');
const OUTPUT_SIZE = 128;

// TILESHEET_MAP: explicit bounding boxes per sprite (pixel-projection detected)
// To update: run `node scripts/detect_sprites.cjs`, copy the cell coords here.
const TILESHEET_MAP = [
  {
    file: `${ASSETS}/tilesheets/heroes.png`,
    sprites: [
      // Row 0: warrior
      { out: `${ASSETS}/heroes/warrior_idle.png`,   x: 41,  y: 46,  w: 257, h: 246 },
      { out: `${ASSETS}/heroes/warrior_attack.png`, x: 363, y: 46,  w: 295, h: 246 },
      { out: `${ASSETS}/heroes/warrior_hurt.png`,   x: 728, y: 46,  w: 248, h: 246 },
      // Row 1: mage
      { out: `${ASSETS}/heroes/mage_idle.png`,      x: 41,  y: 384, w: 257, h: 248 },
      { out: `${ASSETS}/heroes/mage_attack.png`,    x: 363, y: 384, w: 295, h: 248 },
      { out: `${ASSETS}/heroes/mage_hurt.png`,      x: 728, y: 384, w: 248, h: 248 },
      // Row 2: rogue
      { out: `${ASSETS}/heroes/rogue_idle.png`,     x: 41,  y: 782, w: 257, h: 210 },
      { out: `${ASSETS}/heroes/rogue_attack.png`,   x: 363, y: 782, w: 295, h: 210 },
      { out: `${ASSETS}/heroes/rogue_hurt.png`,     x: 728, y: 782, w: 248, h: 210 },
    ],
  },
  {
    file: `${ASSETS}/tilesheets/enemies.png`,
    sprites: [
      // Row 0
      { out: `${ASSETS}/enemies/guard_dog.png`,      x: 75,  y: 103, w: 174, h: 221 },
      { out: `${ASSETS}/enemies/yarn_golem.png`,     x: 291, y: 103, w: 201, h: 221 },
      { out: `${ASSETS}/enemies/squirrel.png`,       x: 527, y: 103, w: 194, h: 221 },
      { out: `${ASSETS}/enemies/moth_swarm.png`,     x: 758, y: 103, w: 203, h: 221 },
      // Row 1
      { out: `${ASSETS}/enemies/vacuum_monster.png`, x: 75,  y: 575, w: 174, h: 222 },
      { out: `${ASSETS}/enemies/laser_sprite.png`,   x: 291, y: 575, w: 201, h: 222 },
      { out: `${ASSETS}/enemies/boss_dog.png`,       x: 527, y: 575, w: 194, h: 222 },
      { out: `${ASSETS}/enemies/boss_vacuum.png`,    x: 758, y: 575, w: 203, h: 222 },
    ],
  },
  {
    file: `${ASSETS}/tilesheets/mapnodes.png`,
    sprites: [
      // Row 0
      { out: `${ASSETS}/mapnodes/node_combat.png`, x: 111, y: 185, w: 197, h: 178 },
      { out: `${ASSETS}/mapnodes/node_elite.png`,  x: 416, y: 185, w: 207, h: 178 },
      { out: `${ASSETS}/mapnodes/node_shop.png`,   x: 732, y: 185, w: 170, h: 178 },
      // Row 1
      { out: `${ASSETS}/mapnodes/node_event.png`,  x: 111, y: 625, w: 197, h: 179 },
      { out: `${ASSETS}/mapnodes/node_rest.png`,   x: 416, y: 625, w: 207, h: 179 },
      { out: `${ASSETS}/mapnodes/node_boss.png`,   x: 732, y: 625, w: 170, h: 179 },
    ],
  },
  {
    file: `${ASSETS}/tilesheets/ui.png`,
    // AI generated 3×3; 8 sprites mapped in row-major order, 9th cell (x=700,y=686) skipped
    sprites: [
      // Row 0
      { out: `${ASSETS}/ui/card_attack.png`,  x: 130, y: 91,  w: 187, h: 202 },
      { out: `${ASSETS}/ui/card_skill.png`,   x: 423, y: 91,  w: 184, h: 202 },
      { out: `${ASSETS}/ui/card_power.png`,   x: 700, y: 91,  w: 197, h: 202 },
      // Row 1
      { out: `${ASSETS}/ui/energy_orb.png`,   x: 130, y: 390, w: 187, h: 196 },
      { out: `${ASSETS}/ui/block_shield.png`, x: 423, y: 390, w: 184, h: 196 },
      { out: `${ASSETS}/ui/mood_feisty.png`,  x: 700, y: 390, w: 197, h: 196 },
      // Row 2
      { out: `${ASSETS}/ui/mood_cozy.png`,    x: 130, y: 686, w: 187, h: 210 },
      { out: `${ASSETS}/ui/relic_slot.png`,   x: 423, y: 686, w: 184, h: 210 },
      // cell at (700,686) skipped — extra 9th cell in AI-generated 3×3
    ],
  },
];

async function extractSheet(sheet) {
  const img = await Jimp.read(sheet.file);
  console.log(`\n[EXTRACT] ${path.basename(sheet.file)} (${img.bitmap.width}×${img.bitmap.height})`);
  for (const s of sheet.sprites) {
    const sprite = img.clone()
      .crop({ x: s.x, y: s.y, w: s.w, h: s.h })
      .resize({ w: OUTPUT_SIZE, h: OUTPUT_SIZE });
    fs.mkdirSync(path.dirname(s.out), { recursive: true });
    await sprite.write(s.out);
    console.log(`  [OK] ${path.basename(s.out)} ← (${s.x},${s.y}) ${s.w}×${s.h}`);
  }
}

async function main() {
  for (const sheet of TILESHEET_MAP) {
    if (!fs.existsSync(sheet.file)) {
      console.warn(`[SKIP] ${sheet.file} not found`); continue;
    }
    await extractSheet(sheet);
  }
  console.log('\nAll sprites extracted successfully.');
}

main().catch(err => { console.error(err); process.exit(1); });
