// scripts/gen-og.mjs
// SVG → PNG conversion, generates social share cards (1200×630)
// Auto-runs before build (npm run prebuild)

import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const svg = await fs.readFile(path.join(__dirname, '..', 'public', 'og.svg'), 'utf-8')
const out = path.join(__dirname, '..', 'public', 'og.png')

await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(out)

const stat = await fs.stat(out)
console.log(`✓ og.png generated (${(stat.size / 1024).toFixed(1)} KB)`)
