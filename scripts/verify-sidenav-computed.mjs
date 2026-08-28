// scripts/verify-sidenav-computed.mjs
// Dump computed colors for SideNav + section labels. Pure observability, no pass/fail.

import { chromium } from 'playwright';

const URL = process.env.SITE_URL || 'https://hansendong.top';
const browser = await chromium.launch();
try {
  for (const [label, vp] of [['mobile', { width: 390, height: 844, dsf: 2 }], ['desktop', { width: 1440, height: 900, dsf: 1 }]]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    for (const theme of ['light', 'dark']) {
      await page.evaluate((t) => {
        localStorage.setItem('theme', t);
        document.documentElement.setAttribute('data-theme', t);
      }, theme);
      await page.waitForTimeout(200);

      const checks = await page.evaluate(() => {
        const out = {};
        const probes = [
          ['.skills__label', 'Skills sub-label'],
          ['.sidenav__btn', 'SideNav dot'],
          ['.section__eyebrow', 'Section eyebrow (TOOLBOX)'],
        ];
        for (const [sel, name] of probes) {
          const el = document.querySelector(sel);
          if (el) {
            const s = getComputedStyle(el);
            out[name] = s.color;
          } else {
            out[name] = '(not in viewport)';
          }
        }
        // sidenav__label tooltip — only check if any exists in DOM (hidden by default)
        const lbl = document.querySelector('.sidenav__label');
        if (lbl) {
          const s = getComputedStyle(lbl);
          out['SideNav tooltip bg'] = s.backgroundColor;
          out['SideNav tooltip border'] = s.borderColor;
        }
        return out;
      });
      console.log(`\n=== ${label} / ${theme} ===`);
      for (const [k, v] of Object.entries(checks)) console.log(`  ${k}: ${v}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
