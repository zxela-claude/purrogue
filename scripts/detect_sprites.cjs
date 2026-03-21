#!/usr/bin/env node
// detect_sprites.cjs
// Analyzes tilesheets and outputs pixel-exact bounding boxes for each sprite cell.
// Run: node scripts/detect_sprites.cjs
//
// Uses a row/column projection approach:
//   1. Detect background color from image corners
//   2. For each row/column, count non-background pixels
//   3. Find contiguous bands of content (>= MIN_BAND_PX pixels tall/wide, >= FILL_RATIO content)
//   4. Print bounding boxes for each detected cell (row × col)
//
// Copy the output into extract_sprites.cjs TILESHEET_MAP to update extraction coords.

const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

const ASSETS = path.resolve(__dirname, '..', 'assets');
const MIN_BAND_PX = 80;   // minimum band size to count as content (filters out grid lines)
const FILL_RATIO = 0.04;  // min fraction of row/col that must be non-background

const TILESHEETS = [
  `${ASSETS}/tilesheets/heroes.png`,
  `${ASSETS}/tilesheets/enemies.png`,
  `${ASSETS}/tilesheets/mapnodes.png`,
  `${ASSETS}/tilesheets/ui.png`,
];

function sampleBackground(img, W, H) {
  // Average 3×3 patches at all 4 corners
  let r = 0, g = 0, b = 0, n = 0;
  for (const [cx, cy] of [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]]) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const hex = img.getPixelColor(cx + dx, cy + dy);
        r += (hex >>> 24) & 0xff;
        g += (hex >>> 16) & 0xff;
        b += (hex >>> 8) & 0xff;
        n++;
      }
    }
  }
  return { r: r / n, g: g / n, b: b / n };
}

function isBackground(r, g, b, bg, thresh = 50) {
  return Math.abs(r - bg.r) < thresh && Math.abs(g - bg.g) < thresh && Math.abs(b - bg.b) < thresh;
}

function findBands(fillArr, limit, ratio, minSize) {
  const threshold = limit * ratio;
  const bands = [];
  let inFill = fillArr[0] > threshold;
  let start = 0;
  for (let i = 1; i < fillArr.length; i++) {
    const f = fillArr[i] > threshold;
    if (f !== inFill) {
      if (inFill && (i - 1 - start + 1) >= minSize) {
        bands.push({ from: start, to: i - 1 });
      }
      inFill = f;
      start = i;
    }
  }
  if (inFill && (fillArr.length - 1 - start + 1) >= minSize) {
    bands.push({ from: start, to: fillArr.length - 1 });
  }
  return bands;
}

async function analyzeSheet(file) {
  if (!fs.existsSync(file)) {
    console.warn(`[SKIP] ${file} not found`);
    return;
  }

  const img = await Jimp.read(file);
  const W = img.bitmap.width;
  const H = img.bitmap.height;
  const bg = sampleBackground(img, W, H);

  // Build row and column fill histograms
  const rowFill = new Array(H).fill(0);
  const colFill = new Array(W).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const hex = img.getPixelColor(x, y);
      const r = (hex >>> 24) & 0xff;
      const g = (hex >>> 16) & 0xff;
      const b = (hex >>> 8) & 0xff;
      if (!isBackground(r, g, b, bg)) {
        rowFill[y]++;
        colFill[x]++;
      }
    }
  }

  const rowBands = findBands(rowFill, W, FILL_RATIO, MIN_BAND_PX);
  const colBands = findBands(colFill, H, FILL_RATIO, MIN_BAND_PX);

  console.log(`\n=== ${path.basename(file)} (${W}×${H}) ===`);
  console.log(`  bg ~ rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`);
  console.log(`  Detected grid: ${rowBands.length} rows × ${colBands.length} cols = ${rowBands.length * colBands.length} cells`);
  console.log(`  Row bands: ${rowBands.map(b => `${b.from}-${b.to}(${b.to - b.from + 1}px)`).join(' | ')}`);
  console.log(`  Col bands: ${colBands.map(b => `${b.from}-${b.to}(${b.to - b.from + 1}px)`).join(' | ')}`);
  console.log('  Cell bounding boxes (copy into extract_sprites.cjs):');
  for (let r = 0; r < rowBands.length; r++) {
    for (let c = 0; c < colBands.length; c++) {
      const x = colBands[c].from;
      const y = rowBands[r].from;
      const w = colBands[c].to - colBands[c].from + 1;
      const h = rowBands[r].to - rowBands[r].from + 1;
      console.log(`    { out: 'YOUR_SPRITE.png', x: ${x}, y: ${y}, w: ${w}, h: ${h} },  // cell[${r}][${c}]`);
    }
  }
}

async function main() {
  console.log('Sprite detection via row/column projection\n');
  for (const f of TILESHEETS) await analyzeSheet(f);
  console.log('\nDone. Copy cell bounding boxes into scripts/extract_sprites.cjs');
}

main().catch(err => { console.error(err); process.exit(1); });
