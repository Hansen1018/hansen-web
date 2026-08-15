// scripts/capture-previews.mjs
// 用 playwright（指定系统 chromium）截 https://hansendong.top 各 section 预览图
// 输出到 public/screenshots/

import { chromium } from '/usr/local/lib/node_modules/playwright/index.mjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'public', 'screenshots')
const URL = process.env.SITE_URL || 'https://hansendong.top'

const SECTIONS = [
  { sel: '#hero',     file: 'preview-hero.png'     },
  { sel: '#about',    file: 'preview-about.png'    },
  { sel: '#projects', file: 'preview-projects.png' }
]

await fs.mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/snap/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce'
})
const page = await context.newPage()

console.log(`→ 打开 ${URL}`)
const resp = await page.goto(URL, { waitUntil: 'networkidle', timeout: 30_000 })
if (!resp || !resp.ok()) {
  throw new Error(`页面返回 ${resp ? resp.status() : 'no response'}`)
}
await page.waitForTimeout(2000)

// 1) 全页
const fullPath = path.join(OUT_DIR, 'preview-full.png')
await page.screenshot({ path: fullPath, fullPage: true })
const fs1 = await fs.stat(fullPath)
console.log(`✓ preview-full.png    ${fs1.size} bytes`)

// 2) 各 section
for (const { sel, file } of SECTIONS) {
  const exists = await page.locator(sel).count()
  if (!exists) { console.warn(`⚠ ${sel} 不存在，跳过 ${file}`); continue }
  await page.locator(sel).scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  const out = path.join(OUT_DIR, file)
  await page.screenshot({ path: out, fullPage: false })
  const st = await fs.stat(out)
  console.log(`✓ ${file.padEnd(22)} ${st.size} bytes`)
}

await browser.close()
console.log('→ 完成')
