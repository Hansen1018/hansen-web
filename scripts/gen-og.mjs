// scripts/gen-og.mjs
// SVG → PNG conversion for the social share card (1200×630).
// Runs automatically before `npm run build` via the `prebuild` script.

import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, '..', 'public', 'og.svg');
const outPath = path.join(__dirname, '..', 'public', 'og.png');

try {
  const svg = await fs.readFile(svgPath, 'utf-8');
  // compressionLevel 6 — flat-color illustrations compress well at level 6,
  // level 9 adds 3-4× encode time for ~5-10% size.
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 6 })
    .toFile(outPath);

  const stat = await fs.stat(outPath);
  console.log(`✓ og.png generated (${(stat.size / 1024).toFixed(1)} KB)`);
} catch (err) {
  console.error('✗ gen-og failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
