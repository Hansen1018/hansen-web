import { chromium } from 'playwright';

const URL = 'https://hansendong.top';
const OUT = '/workspace/hansen-web-next/screenshots/cyan-audit';
const browser = await chromium.launch();

// WCAG luminance helpers
function relLum(rgb) {
  const [r, g, b] = rgb.map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const la = relLum(a), lb = relLum(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
function parseRgb(s) {
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  return m[1].split(',').slice(0, 3).map(v => parseFloat(v.trim()));
}

(async () => {
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    // force light
    await page.evaluate(() => {
      localStorage.setItem('theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await page.waitForTimeout(300);

    // Scroll to each section to ensure they're in DOM
    const sections = ['hero', 'about', 'projects', 'skills', 'side-hustle', 'timeline', 'contact', 'blog'];
    for (const id of sections) {
      await page.evaluate((id) => document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' }), id);
      await page.waitForTimeout(200);
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(300);

    const report = await page.evaluate(() => {
      const probes = [
        ['.section__index', 'section__index (03 number)'],
        ['.timeline__year', 'timeline__year'],
        ['.contact__link', 'contact__link'],
        ['.blog-more', 'blog-more (view all link)'],
        ['.blog-loading a', 'blog-loading link'],
        ['.hustle__price', 'hustle__price'],
        ['.sidenav__item.is-active .sidenav__dot', 'SideNav active dot (gradient endpoint)'],
        ['.aurora__blob--cyan', 'aurora blob cyan (decorative)'],
      ];
      const out = [];
      for (const [sel, name] of probes) {
        const els = document.querySelectorAll(sel);
        if (!els.length) {
          out.push({ name, sel, present: false });
          continue;
        }
        const el = els[0];
        const s = getComputedStyle(el);
        const props = {
          color: s.color,
          fontWeight: s.fontWeight,
          textShadow: s.textShadow,
          filter: s.filter,
        };
        if (sel.includes('aurora') || sel.includes('dot')) {
          props.background = s.backgroundColor || s.backgroundImage;
          props.boxShadow = s.boxShadow;
        }
        // measure bg of nearest parent section
        let p = el;
        let bg = 'n/a';
        for (let i = 0; i < 10; i++) {
          p = p.parentElement;
          if (!p) break;
          const cs = getComputedStyle(p);
          if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
            bg = cs.backgroundColor;
            break;
          }
        }
        out.push({ name, sel, present: true, props, bg });
      }
      return out;
    });

    console.log('\n========== CYAN AUDIT (light mode) ==========\n');
    for (const r of report) {
      if (!r.present) {
        console.log(`✗ ${r.name.padEnd(40)} NOT IN DOM`);
        continue;
      }
      console.log(`✓ ${r.name}`);
      console.log(`    color:  ${r.props.color}`);
      console.log(`    weight: ${r.props.fontWeight}`);
      if (r.props.textShadow !== 'none') console.log(`    text-shadow: ${r.props.textShadow}`);
      if (r.props.background) console.log(`    bg:     ${r.props.background}`);
      if (r.props.boxShadow && r.props.boxShadow !== 'none') console.log(`    box-shadow: ${r.props.boxShadow}`);
      if (r.props.filter && r.props.filter !== 'none') console.log(`    filter:  ${r.props.filter}`);
      console.log(`    parent bg: ${r.bg}`);
      const fg = parseRgb(r.props.color || r.props.background || 'rgb(0,0,0)');
      const bg = parseRgb(r.bg);
      if (fg && bg) {
        const c = contrast(fg, bg);
        const pass = c >= 4.5 ? '✓ AAA' : c >= 3 ? '⚠ AA-large/UI' : '✗ FAIL';
        console.log(`    contrast: ${c.toFixed(2)}:1  ${pass}`);
      }
      console.log('');
    }
  } finally {
    await browser.close();
  }
})();
