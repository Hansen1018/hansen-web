// scripts/verify-sidenav.mjs
// Visual snapshot pass for SideNav dot/tooltip regressions.

import { chromium } from 'playwright';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = process.env.SITE_URL || 'https://hansendong.top';
// Output dir: env var OUT_DIR overrides, otherwise <repo>/screenshots/<script-name>.
const OUT = process.env.OUT_DIR || path.join(__dirname, '..', 'screenshots', 'sidenav-fix');

async function capture(page, name) {
  await page.waitForTimeout(400);
  const p = `${OUT}/${name}.png`;
  await page.screenshot({ path: p, fullPage: false });
  console.log(`✓ ${name}.png`);
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch();
  try {
    // ============ Mobile viewport (iPhone 13) ============
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    });
    const m = await mobileCtx.newPage();
    await m.goto(URL, { waitUntil: 'networkidle' });
    await m.waitForTimeout(800);

    // 1) mobile Skills section, light mode (primary - what user reported)
    await setTheme(m, 'light');
    await m.evaluate(() => {
      document.getElementById('skills')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await m.waitForTimeout(500);
    await capture(m, '01-mobile-skills-light');

    // 2) mobile Skills section, dark mode (regression check)
    await setTheme(m, 'dark');
    await m.evaluate(() => {
      document.getElementById('skills')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await m.waitForTimeout(500);
    await capture(m, '02-mobile-skills-dark');

    // 3) mobile hamburger drawer opened, light mode (defensive: m-menu-link)
    await setTheme(m, 'light');
    await m.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await m.waitForTimeout(300);
    // click hamburger (mobile only, <900px)
    const hb = m.locator('.m-menu-btn').first();
    if (await hb.count()) {
      await hb.click();
      await m.waitForTimeout(500);
      await capture(m, '03-mobile-drawer-open-light');
      // re-locate for close — drawer may have re-rendered
      const hb2 = m.locator('.m-menu-btn').first();
      if (await hb2.count()) {
        await hb2.click();
        await m.waitForTimeout(400);
      }
    } else {
      console.warn('⚠ no .m-menu-btn in DOM, skipping drawer capture');
    }

    // ============ Desktop viewport ============
    const desktopCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const d = await desktopCtx.newPage();
    await d.goto(URL, { waitUntil: 'networkidle' });
    await d.waitForTimeout(800);

    // 4) desktop Skills section, light mode (SideNav dots visible)
    await setTheme(d, 'light');
    await d.evaluate(() => {
      document.getElementById('skills')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await d.waitForTimeout(500);
    await capture(d, '04-desktop-skills-light');

    // 5) desktop SideNav dots + hover tooltip, light mode
    await d.evaluate(() => {
      document.getElementById('hero')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await d.waitForTimeout(400);
    const firstDot = d.locator('.sidenav__btn').first();
    if (await firstDot.count()) {
      await firstDot.hover();
      await d.waitForTimeout(400);
      await capture(d, '05-desktop-sidenav-tooltip-light');
    } else {
      console.warn('⚠ no .sidenav__btn in DOM, skipping tooltip captures');
    }

    // 6) desktop Skills section, dark mode (regression check)
    await setTheme(d, 'dark');
    await d.evaluate(() => {
      document.getElementById('skills')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await d.waitForTimeout(500);
    await capture(d, '06-desktop-skills-dark');

    // 7) desktop top + SideNav, dark mode
    await d.evaluate(() => {
      document.getElementById('hero')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await d.waitForTimeout(400);
    if (await firstDot.count()) {
      await firstDot.hover();
      await d.waitForTimeout(400);
      await capture(d, '07-desktop-sidenav-tooltip-dark');
    }

    console.log('\n✅ All captures done.');
  } finally {
    await browser.close();
  }
})();
