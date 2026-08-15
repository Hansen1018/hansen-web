// scripts/fetch-blog-feed.mjs
// Build-time fetch of the Hugo blog feed → public/blog-feed.json
// so the browser can fetch same-origin /blog-feed.json (avoids CORS).
// Runs in `npm run prebuild` before vite-ssg build.

import fs from 'node:fs/promises'
import path from 'node:path'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const FEED_URL = process.env.BLOG_FEED_URL || 'https://blog.hansendong.top/index.json'
const OUT = path.join(__dirname, '..', 'public', 'blog-feed.json')

try {
  const res = await fetch(FEED_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${FEED_URL}`)
  const data = await res.text()
  const parsed = JSON.parse(data)
  if (!Array.isArray(parsed)) throw new Error('Feed is not a JSON array')

  await fs.writeFile(OUT, JSON.stringify(parsed, null, 2) + '\n', 'utf-8')
  const stat = await fs.stat(OUT)
  console.log(`✓ blog-feed.json fetched (${parsed.length} posts, ${(stat.size / 1024).toFixed(1)} KB)`)
} catch (err) {
  console.error(`✗ fetch-blog-feed failed: ${err.message}`)
  // Non-fatal: site still builds, BlogSection shows its client-side error UI.
  // To make build fail on missing feed, uncomment: throw err
}