// scripts/verify-cyan-fixed.mjs
// Computed-style verification for cyan-fix regressions. Exits 1 on FAIL.

import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const URL = process.env.SITE_URL || 'https://hansendong.top';
const OUT = '/workspace/hansen-web-next/screenshots/cyan-fixed';

function relLum(rgb) {
  const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const la = relLum(a), lb = relLum(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
function parseRgb(s) { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; return m[1].split(',').slice(0,3).map(v => parseFloat(v.trim())); }

let failures = 0;

(async () => {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    for (const theme of ['light', 'dark']) {
      await page.evaluate((t) => {
        localStorage.setItem('theme', t);
        document.documentElement.setAttribute('data-theme', t);
      }, theme);
      await page.waitForTimeout(300);

      // ensure all sections rendered
      for (const id of ['hero', 'about', 'projects', 'skills', 'side-hustle', 'timeline', 'contact', 'blog']) {
        await page.evaluate((id) => document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' }), id);
        await page.waitForTimeout(150);
      }

      // === Computed style check ===
      const checks = await page.evaluate(() => {
        const probes = [
          ['.section__index', '03 number'],
          ['.timeline__year', 'timeline year'],
          ['.contact__eyebrow', 'contact eyebrow'],
          ['.blog-loading a', 'blog loading link'],
          ['.blog-more', 'blog more (view all)'],
          ['.hustle__cta', 'hustle cta'],
          ['.hustle__status', 'hustle status badge'],
          ['.sidenav__item.is-active .sidenav__dot', 'SideNav active dot'],
        ];
        const out = {};
        for (const [sel, name] of probes) {
          const el = document.querySelector(sel);
          if (!el) { out[name] = { present: false }; continue; }
          const s = getComputedStyle(el);
          let p = el;
          let bg = 'n/a';
          for (let i = 0; i < 10; i++) { p = p.parentElement; if (!p) break; const cs = getComputedStyle(p); if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') { bg = cs.backgroundColor; break; } }
          out[name] = {
            present: true,
            color: s.color,
            weight: s.fontWeight,
            textShadow: s.textShadow === 'none' ? null : s.textShadow,
            boxShadow: s.boxShadow === 'none' ? null : s.boxShadow,
            bg,
          };
        }
        return out;
      });

      console.log(`\n========== ${theme.toUpperCase()} MODE — POST-FIX ==========`);
      for (const [name, c] of Object.entries(checks)) {
        if (!c.present) { console.log(`✗ ${name.padEnd(30)} NOT IN DOM`); failures++; continue; }
        console.log(`✓ ${name}`);
        console.log(`    color:      ${c.color}`);
        console.log(`    weight:     ${c.weight}`);
        if (c.textShadow) console.log(`    text-shadow: ${c.textShadow}`);
        if (c.boxShadow) console.log(`    box-shadow:  ${c.boxShadow}`);
        console.log(`    parent bg:  ${c.bg}`);
        const fg = parseRgb(c.color);
        const bg = parseRgb(c.bg);
        if (fg && bg) {
          const r = contrast(fg, bg);
          if (r < 3) {
            console.log(`    contrast:   ${r.toFixed(2)}:1  ✗ FAIL`);
            failures++;
          } else if (r < 4.5) {
            console.log(`    contrast:   ${r.toFixed(2)}:1  ⚠ AA-large`);
          } else {
            console.log(`    contrast:   ${r.toFixed(2)}:1  ✓ AAA`);
          }
        }
      }
    }

    // === Visual screenshots — LIGHT MODE focused on cyan elements ===
    await page.evaluate(() => { localStorage.setItem('theme', 'light'); document.documentElement.setAttribute('data-theme', 'light'); });
    await page.waitForTimeout(300);

    await page.evaluate(() => document.getElementById('skills')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/01-mobile-skills-light.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/02-mobile-skills-light.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    await page.evaluate(() => document.getElementById('timeline')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/03-desktop-timeline-light.png` });

    await page.evaluate(() => document.getElementById('side-hustle')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/04-desktop-side-hustle-light.png` });

    await page.evaluate(() => document.getElementById('contact')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/05-desktop-contact-light.png` });

    await page.evaluate(() => document.getElementById('blog')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/06-desktop-blog-light.png` });

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(300);
    const firstDot = page.locator('.sidenav__btn').first();
    await firstDot.hover();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/07-desktop-sidenav-active-light.png` });

    await page.evaluate(() => { localStorage.setItem('theme', 'dark'); document.documentElement.setAttribute('data-theme', 'dark'); });
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('skills')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/08-desktop-skills-dark.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/09-mobile-skills-dark.png` });

    const files = await fs.readdir(OUT);
    console.log(`\n✅ ${files.length} screenshots saved to ${OUT}`);

    if (failures > 0) {
      console.log(`\n✗ ${failures} contrast failure(s)`);
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
})();
