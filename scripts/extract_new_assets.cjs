#!/usr/bin/env node
// Extract relics and card art from newly generated tilesheets.
// Uses pixel-projection auto-detection with uniform grid fallback.
// Run: node scripts/extract_new_assets.cjs

const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

const ASSETS = path.resolve(__dirname, '..', 'assets');

const RELIC_NAMES = [
  'laser_toy', 'catnip', 'hairball', 'yarn_ball',
  'bell_collar', 'cat_nap', 'toy_mouse', 'fish_snack',
  'sundial', 'cursed_collar', 'ancient_tome', 'lucky_paw',
  'coffee_mug', 'mirror', 'claw_sharpener', 'warm_blanket',
  'magnifying_glass', 'tuna_can', 'golden_ball', 'nine_lives',
  'power_cell',
];

const WARRIOR_CARDS = [
  'w_strike', 'w_defend', 'w_bash', 'w_cleave',
  'w_armored', 'w_headbutt', 'w_rage', 'w_pummel',
  'w_entrench', 'w_sword_boomerang', 'w_war_cry', 'w_shield_bash',
  'w_flex', 'w_double_tap', 'w_infernal_blade', 'w_spot_weakness',
  'w_bloodletting', 'w_immovable', 'w_true_grit', 'w_limit_break',
];

const MAGE_CARDS = [
  'm_zap', 'm_frost', 'm_fireball', 'm_arcane',
  'm_poison_claw', 'm_ice_barrier', 'm_thunder', 'm_mana_burn',
  'm_blizzard', 'm_study', 'm_corruption', 'm_dual_cast',
  'm_reflex', 'm_meteor', 'm_echo', 'm_slow',
  'm_adrenaline', 'm_burn_wave', 'm_barrier', 'm_static',
];

const ROGUE_CARDS = [
  'r_shiv', 'r_dodge', 'r_backstab', 'r_poison_dart',
  'r_sprint', 'r_blade_dance', 'r_caltrops', 'r_predator',
  'r_acrobatics', 'r_calculated_gamble', 'r_flechettes', 'r_masterful_stab',
  'r_concentrate', 'r_noxious_fumes', 'r_sucker_punch', 'r_infiltrate',
  'r_terror', 'r_bullet_time', 'r_storm_of_steel', 'r_wraith_form',
];

function sampleBackground(img, W, H) {
  let r = 0, g = 0, b = 0, n = 0;
  for (const [cx, cy] of [[2,2],[W-3,2],[2,H-3],[W-3,H-3]]) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const hex = img.getPixelColor(cx+dx, cy+dy);
        r += (hex >>> 24) & 0xff;
        g += (hex >>> 16) & 0xff;
        b += (hex >>> 8) & 0xff;
        n++;
      }
    }
  }
  return { r: r/n, g: g/n, b: b/n };
}

function isBackground(r, g, b, bg, thresh = 40) {
  return Math.abs(r-bg.r)<thresh && Math.abs(g-bg.g)<thresh && Math.abs(b-bg.b)<thresh;
}

function findBands(fillArr, limit, ratio, minSize) {
  const threshold = Math.max(limit * ratio, 2);
  const bands = [];
  let inFill = fillArr[0] > threshold, start = 0;
  for (let i = 1; i < fillArr.length; i++) {
    const f = fillArr[i] > threshold;
    if (f !== inFill) {
      if (inFill && (i - 1 - start + 1) >= minSize) bands.push({ from: start, to: i - 1 });
      inFill = f; start = i;
    }
  }
  if (inFill && (fillArr.length - 1 - start + 1) >= minSize) bands.push({ from: start, to: fillArr.length - 1 });
  return bands;
}

async function extractFromSheet({ sheetPath, names, outDir, cols, rows, outSize }) {
  if (!fs.existsSync(sheetPath)) {
    console.warn(`[SKIP] ${path.basename(sheetPath)} not found`);
    return 0;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const img = await Jimp.read(sheetPath);
  const W = img.bitmap.width, H = img.bitmap.height;
  const bg = sampleBackground(img, W, H);

  const rowFill = new Array(H).fill(0);
  const colFill = new Array(W).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const hex = img.getPixelColor(x, y);
      const r2 = (hex >>> 24) & 0xff, g2 = (hex >>> 16) & 0xff, b2 = (hex >>> 8) & 0xff;
      if (!isBackground(r2, g2, b2, bg)) { rowFill[y]++; colFill[x]++; }
    }
  }

  const minBand = Math.min(W, H) * 0.05;
  const rowBands = findBands(rowFill, W, 0.02, minBand);
  const colBands = findBands(colFill, H, 0.02, minBand);

  console.log(`  ${path.basename(sheetPath)} (${W}×${H}): detected ${rowBands.length}r × ${colBands.length}c`);

  let cells = [];
  if (rowBands.length >= rows * 0.8 && colBands.length >= cols * 0.8) {
    // Use detected bands
    for (let r = 0; r < rowBands.length; r++) {
      for (let c = 0; c < colBands.length; c++) {
        cells.push({
          x: colBands[c].from, y: rowBands[r].from,
          w: colBands[c].to - colBands[c].from + 1,
          h: rowBands[r].to - rowBands[r].from + 1
        });
      }
    }
  } else {
    // Uniform grid fallback
    console.log(`  → Falling back to uniform ${rows}×${cols} grid`);
    const cellW = Math.floor(W / cols);
    const cellH = Math.floor(H / rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({ x: c * cellW, y: r * cellH, w: cellW, h: cellH });
      }
    }
  }

  let extracted = 0;
  for (let i = 0; i < Math.min(cells.length, names.length); i++) {
    if (!names[i]) continue;
    const { x, y, w, h } = cells[i];
    const outPath = path.join(outDir, `${names[i]}.png`);
    const cropped = img.clone().crop({ x, y, w, h }).resize({ w: outSize.w, h: outSize.h });
    await cropped.write(outPath);
    extracted++;
  }
  console.log(`  ✓ ${extracted} sprites → ${outDir}`);
  return extracted;
}

async function main() {
  console.log('\nExtracting relic icons...');
  await extractFromSheet({
    sheetPath: `${ASSETS}/tilesheets/relics.png`,
    names: RELIC_NAMES, outDir: `${ASSETS}/relics`,
    cols: 4, rows: 6, outSize: { w: 64, h: 64 }
  });

  console.log('\nExtracting warrior card art...');
  await extractFromSheet({
    sheetPath: `${ASSETS}/tilesheets/cards_warrior.png`,
    names: WARRIOR_CARDS, outDir: `${ASSETS}/cards`,
    cols: 4, rows: 6, outSize: { w: 90, h: 68 }
  });

  console.log('\nExtracting mage card art...');
  await extractFromSheet({
    sheetPath: `${ASSETS}/tilesheets/cards_mage.png`,
    names: MAGE_CARDS, outDir: `${ASSETS}/cards`,
    cols: 4, rows: 6, outSize: { w: 90, h: 68 }
  });

  console.log('\nExtracting rogue card art...');
  await extractFromSheet({
    sheetPath: `${ASSETS}/tilesheets/cards_rogue.png`,
    names: ROGUE_CARDS, outDir: `${ASSETS}/cards`,
    cols: 4, rows: 5, outSize: { w: 90, h: 68 }
  });

  console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
