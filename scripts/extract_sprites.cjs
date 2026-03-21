#!/usr/bin/env node
// extract_sprites.cjs
// Usage: node scripts/extract_sprites.cjs
// Reads TILESHEET_MAP and extracts sprites from each tilesheet using jimp.
// Each sprite is cropped from a uniform grid and resized to 128x128.
//
// TILESHEET LAYOUTS (all coordinates are in % of image, actual px vary):
//   heroes.png  — 3 cols × 3 rows (warrior/mage/rogue × idle/attack/hurt)
//   enemies.png — 4 cols × 2 rows (guard_dog, yarn_golem, squirrel, moth_swarm / vacuum, laser, boss_dog, boss_vacuum)
//   mapnodes.png — 3 cols × 2 rows (combat, elite, shop / event, rest, boss)
//   ui.png      — 4 cols × 2 rows (card_attack, card_skill, card_power, energy_orb / block_shield, mood_feisty, mood_cozy, relic_slot)

const { Jimp, ResizeStrategy } = require('jimp');
const path = require('path');
const fs = require('fs');

const ASSETS = '/tmp/purrogue/assets';

const TILESHEET_MAP = [
  {
    file: `${ASSETS}/tilesheets/heroes.png`,
    cols: 3,
    rows: 3,
    sprites: [
      `${ASSETS}/heroes/warrior_idle.png`,
      `${ASSETS}/heroes/warrior_attack.png`,
      `${ASSETS}/heroes/warrior_hurt.png`,
      `${ASSETS}/heroes/mage_idle.png`,
      `${ASSETS}/heroes/mage_attack.png`,
      `${ASSETS}/heroes/mage_hurt.png`,
      `${ASSETS}/heroes/rogue_idle.png`,
      `${ASSETS}/heroes/rogue_attack.png`,
      `${ASSETS}/heroes/rogue_hurt.png`,
    ],
  },
  {
    file: `${ASSETS}/tilesheets/enemies.png`,
    cols: 4,
    rows: 2,
    sprites: [
      `${ASSETS}/enemies/guard_dog.png`,
      `${ASSETS}/enemies/yarn_golem.png`,
      `${ASSETS}/enemies/squirrel.png`,
      `${ASSETS}/enemies/moth_swarm.png`,
      `${ASSETS}/enemies/vacuum_monster.png`,
      `${ASSETS}/enemies/laser_sprite.png`,
      `${ASSETS}/enemies/boss_dog.png`,
      `${ASSETS}/enemies/boss_vacuum.png`,
    ],
  },
  {
    file: `${ASSETS}/tilesheets/mapnodes.png`,
    cols: 3,
    rows: 2,
    sprites: [
      `${ASSETS}/mapnodes/node_combat.png`,
      `${ASSETS}/mapnodes/node_elite.png`,
      `${ASSETS}/mapnodes/node_shop.png`,
      `${ASSETS}/mapnodes/node_event.png`,
      `${ASSETS}/mapnodes/node_rest.png`,
      `${ASSETS}/mapnodes/node_boss.png`,
    ],
  },
  {
    file: `${ASSETS}/tilesheets/ui.png`,
    cols: 4,
    rows: 2,
    sprites: [
      `${ASSETS}/ui/card_attack.png`,
      `${ASSETS}/ui/card_skill.png`,
      `${ASSETS}/ui/card_power.png`,
      `${ASSETS}/ui/energy_orb.png`,
      `${ASSETS}/ui/block_shield.png`,
      `${ASSETS}/ui/mood_feisty.png`,
      `${ASSETS}/ui/mood_cozy.png`,
      `${ASSETS}/ui/relic_slot.png`,
    ],
  },
];

async function extractSheet(sheet) {
  const img = await Jimp.read(sheet.file);
  const W = img.bitmap.width;
  const H = img.bitmap.height;
  const cellW = Math.floor(W / sheet.cols);
  const cellH = Math.floor(H / sheet.rows);

  console.log(`[EXTRACT] ${path.basename(sheet.file)} — ${W}×${H}, cells ${cellW}×${cellH}`);

  for (let i = 0; i < sheet.sprites.length; i++) {
    const row = Math.floor(i / sheet.cols);
    const col = i % sheet.cols;
    const x = col * cellW;
    const y = row * cellH;

    const sprite = img.clone()
      .crop({ x, y, w: cellW, h: cellH })
      .resize({ w: 128, h: 128 });

    const outPath = sheet.sprites[i];
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await sprite.write(outPath);
    console.log(`  [OK] ${path.basename(outPath)} ← (${x},${y}) ${cellW}×${cellH}`);
  }
}

async function main() {
  for (const sheet of TILESHEET_MAP) {
    if (!fs.existsSync(sheet.file)) {
      console.warn(`[SKIP] ${sheet.file} not found`);
      continue;
    }
    await extractSheet(sheet);
  }
  console.log('\nAll sprites extracted.');
}

main().catch(err => { console.error(err); process.exit(1); });
