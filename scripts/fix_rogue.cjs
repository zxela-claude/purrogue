const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

const ASSETS = '/workspace/group/purrogue/assets';
const ROGUE_CARDS = [
  'r_shiv', 'r_dodge', 'r_backstab', 'r_poison_dart',
  'r_sprint', 'r_blade_dance', 'r_caltrops', 'r_predator',
  'r_acrobatics', 'r_calculated_gamble', 'r_flechettes', 'r_masterful_stab',
  'r_concentrate', 'r_noxious_fumes', 'r_sucker_punch', 'r_infiltrate',
  'r_terror', 'r_bullet_time', 'r_storm_of_steel', 'r_wraith_form',
];

async function main() {
  const img = await Jimp.read(`${ASSETS}/tilesheets/cards_rogue.png`);
  const W = img.bitmap.width, H = img.bitmap.height;
  console.log(`Rogue sheet: ${W}×${H}`);
  
  const cols = 4, rows = 5;
  const cellW = Math.floor(W / cols);
  const cellH = Math.floor(H / rows);
  console.log(`Cell size: ${cellW}×${cellH}`);
  
  let count = 0;
  for (let i = 0; i < ROGUE_CARDS.length; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const x = col * cellW, y = row * cellH;
    const outPath = `${ASSETS}/cards/${ROGUE_CARDS[i]}.png`;
    const cropped = img.clone().crop({ x, y, w: cellW, h: cellH }).resize({ w: 90, h: 68 });
    await cropped.write(outPath);
    count++;
  }
  console.log(`✓ Re-extracted ${count} rogue card sprites`);
}
main().catch(console.error);
