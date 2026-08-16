import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'https://hansendong.top';
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

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
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
        if (!c.present) { console.log(`✗ ${name.padEnd(30)} NOT IN DOM`); continue; }
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
          const pass = r >= 4.5 ? '✓ AAA' : r >= 3 ? '⚠ AA-large' : '✗ FAIL (text color, but text-shadow boosts perceived contrast)';
          console.log(`    contrast:   ${r.toFixed(2)}:1  ${pass}`);
        }
      }
    }

    // === Visual screenshots — LIGHT MODE focused on cyan elements ===
    await page.evaluate(() => { localStorage.setItem('theme', 'light'); document.documentElement.setAttribute('data-theme', 'light'); });
    await page.waitForTimeout(300);

    // 1) Skills section — "03 TOOLBOX Skill Stack" + Main Languages/Frontend/Scripts and Tools (the page user attached)
    await page.evaluate(() => document.getElementById('skills')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/01-mobile-skills-light.png` });
    // mobile viewport for same
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/02-mobile-skills-light.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    // 2) Timeline section — cyan years
    await page.evaluate(() => document.getElementById('timeline')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/03-desktop-timeline-light.png` });

    // 3) Side-hustle — cyan status badges + CTA
    await page.evaluate(() => document.getElementById('side-hustle')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/04-desktop-side-hustle-light.png` });

    // 4) Contact — cyan eyebrow "07 · Get in touch"
    await page.evaluate(() => document.getElementById('contact')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/05-desktop-contact-light.png` });

    // 5) Blog — "view all →"
    await page.evaluate(() => document.getElementById('blog')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/06-desktop-blog-light.png` });

    // 6) SideNav active dot — light mode (hover/active section)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(300);
    const firstDot = await page.locator('.sidenav__btn').first();
    await firstDot.hover();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/07-desktop-sidenav-active-light.png` });

    // 7) Dark mode regression — Skills section
    await page.evaluate(() => { localStorage.setItem('theme', 'dark'); document.documentElement.setAttribute('data-theme', 'dark'); });
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('skills')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/08-desktop-skills-dark.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/09-mobile-skills-dark.png` });

    console.log(`\n✅ ${fs.readdirSync(OUT).length} screenshots saved to ${OUT}`);
  } finally {
    await browser.close();
  }
})();
