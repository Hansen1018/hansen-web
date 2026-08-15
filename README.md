# Hansen Web · Personal Site

> [English](./README.md) · [中文](./README.zh-CN.md)

Luminous personal portfolio built with **Next.js 14 App Router + React 18 + TypeScript**. Glassmorphism design, aurora ambience, scroll-spy navigation, typewriter hero, and a blog feed synced build-time from the Hugo blog.

**Live**: https://hansendong.top

---

## Preview

| Desktop | Mobile |
| --- | --- |
| ![Desktop full page](./screenshots/desktop-full.png) | ![Mobile full page](./screenshots/mobile-full.png) |

Desktop hero (above the fold):

![Desktop hero](./screenshots/desktop-hero.png)

Mobile menu drawer:

![Mobile menu open](./screenshots/mobile-menu-open.png)

---

## Features

- **Next.js 14 App Router** with `output: 'export'` — pure static site, zero runtime cost
- **React 18** server components by default; only 5 of 13 components ship client JS
- **TypeScript strict** — full type safety on data, hooks, components
- **Glassmorphism + aurora background** — three drifting radial blobs, grain noise overlay, glass cards with `backdrop-filter`
- **Scroll-spy** — single `IntersectionObserver` powers both `SideNav` (desktop) and `MobileMenu` (mobile) via `NavController`
- **Hero typewriter** — `type → pause → delete` state machine with `prefers-reduced-motion` guard
- **Blog feed sync** — `scripts/fetch-blog-feed.mjs` fetches Hugo blog at build time → `public/blog-feed.json`
- **Open Graph + JSON-LD** — full metadata API: `Person` + `WebSite` + `WebPage` structured data
- **Mobile-first responsive** — breakpoints at 640 / 720 / 900 / 1180 px

## Tech Stack

| Layer | Tool | Version |
|---|---|---|
| Framework | Next.js (App Router, `output: 'export'`) | 14.2.18 |
| UI | React + react-dom | 18.3.1 |
| Language | TypeScript (strict) | 5.5.3 |
| Styling | Vanilla CSS · BEM naming | — |
| Image generation | `sharp` (SVG → PNG for `og.png`) | 0.33.5 |
| Blog feed | Hugo blog → JSON (build-time fetch) | — |
| Deploy | `rsync` → `/var/www/hansen-web/` | — |

## Quick Start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs to out/
```

`npm run build` runs two prebuild steps first:

```
prebuild
├── scripts/gen-og.mjs          # public/og.svg → public/og.png (1200×630)
└── scripts/fetch-blog-feed.mjs # blog.hansendong.top/index.json → public/blog-feed.json
```

## Project Structure

```
hansen-web-next/
├── package.json
├── next.config.mjs        # output: 'export' + images.unoptimized
├── tsconfig.json          # strict mode, @/* path alias
├── deploy.sh              # atomic replace + rsync
├── public/                # favicon, og.svg, blog-feed.json (post-build)
├── scripts/
│   ├── gen-og.mjs         # SVG → PNG
│   ├── fetch-blog-feed.mjs # Hugo blog → JSON
│   └── capture-previews.mjs
└── src/
    ├── app/
    │   ├── layout.tsx     # metadata + JSON-LD
    │   ├── page.tsx       # composes all sections
    │   └── globals.css    # CSS variables + reset
    ├── components/
    │   ├── NavController.tsx       # client — scroll-spy hub
    │   ├── SideNav.tsx             # server — presentational
    │   ├── MobileMenu.tsx          # client — drawer + body scroll lock
    │   ├── SectionShell.tsx        # client — IntersectionObserver fade-in
    │   ├── BackgroundLayer.tsx     # server — pure CSS animation
    │   ├── HeroSection.tsx         # client — typewriter
    │   ├── AboutSection.tsx        # server — presentational
    │   ├── ProjectsSection.tsx     # client — onError handler
    │   ├── SkillsSection.tsx       # server — presentational
    │   ├── BlogSection.tsx         # client — fetch on mount
    │   ├── TimelineSection.tsx     # server — presentational
    │   ├── SideHustleSection.tsx   # server — presentational
    │   ├── ContactSection.tsx      # server — presentational
    │   └── socialIcons.ts          # shared SVG paths
    ├── data/
    │   └── profile.ts              # all content, single typed source
    ├── hooks/
    │   └── useActiveSection.ts     # scroll-spy state machine
    └── styles/
        └── components.css          # ~1100 lines, all component styles
```

## Architecture

### Server vs client components

App Router uses React Server Components by default. The site is interactive only where it needs to be:

| Component | Type | Why |
|---|---|---|
| `BackgroundLayer` | Server | Pure CSS animation, zero JS |
| `AboutSection` | Server | Pure presentational |
| `ProjectsSection` | Client | `<img onError>` handler |
| `SkillsSection` | Server | Pure presentational |
| `BlogSection` | Client | Fetches `/blog-feed.json` on mount |
| `TimelineSection` | Server | Pure presentational |
| `SideHustleSection` | Server | Pure presentational |
| `ContactSection` | Server | Pure presentational |
| `HeroSection` | Client | Typewriter state machine |
| `SectionShell` | Client | IntersectionObserver fade-in |
| `SideNav` | Server | Presentational, receives props |
| `MobileMenu` | Client | Open/close state, body scroll lock |
| `NavController` | Client | Wraps scroll-spy for SideNav + MobileMenu |

Seven of the eight section components ship as pure HTML. The interactivity layer (scroll-spy, typewriter, mobile drawer, blog fetch) is the only client JS.

### Scroll-spy

`useActiveSection` in `src/hooks/useActiveSection.ts` ports the Vue composable 1:1:

1. Pick section with `rect.top <= 0.3 × innerHeight` and largest `rect.top`
2. Last-section fallback: if last section fully fits inside viewport, force-pick it
3. Top fallback: if nothing matched, pick the closest one below the trigger line

`NavController` calls this hook once and feeds `active` + `scrollTo` to both `SideNav` (desktop) and `MobileMenu` (mobile) — single observer instance, no duplication.

### CSS

All styles consolidated in `src/styles/components.css` (~1100 lines). Class names follow BEM (`block__element--modifier`). No CSS Modules, no styled-components — direct global CSS since Next.js compiles it once and class names are namespaced enough.

Vue version used `<style scoped>` which appended `[data-v-xxx]` attributes for specificity. In Next.js global CSS, the dual selector pattern (`.card--feature .card__thumb-logo--cover, .card__thumb-logo--cover`) replicates the specificity boost that Vue's data attribute provided.

## Deploy

```bash
# Atomic replace on remote (prevents nested dir bug:
# mv tmp target on existing target creates target/tmp/)
rm -rf /var/www/hansen-web.tmp
mkdir -p /var/www/hansen-web.tmp
rsync -avz --delete out/ /var/www/hansen-web.tmp/
rm -rf /var/www/hansen-web
mv /var/www/hansen-web.tmp /var/www/hansen-web
```

`deploy.sh` wraps this. Caching: CSS and JS chunks are immutable (hashed filenames); HTML revalidates hourly. Cloudflare sits in front via NPM.

## Bundle Stats

| Route | Page chunk | First Load JS |
|---|---|---|
| `/` | 7.96 kB | 95.1 kB |
| `/_not-found` | 873 B | 88.1 kB |
| Shared chunks | — | 87.2 kB |

Breakdown of the 87.2 kB shared baseline:
- `framework-*.js`: 53.6 kB (React runtime)
- `117-*.js`: 31.7 kB (Next.js router + head)
- Other cached chunks: 1.86 kB

Page-specific additions: hero typewriter (`HeroSection`) + scroll-spy (`useActiveSection`) + mobile drawer (`MobileMenu`) + blog fetch (`BlogSection`) add ~7.8 kB on top of the shared baseline. Static sections (About, Skills, Timeline, SideHustle, Contact) add 0 kB.

## Migration from Vue 3

Original Vue 3 + Vite + vite-ssg source backed up at `hansen-web-vue-bak/` during the cutover and deleted post-deploy. Available in commit history.

| | Vue 3 + vite-ssg | Next.js 14 App Router |
|---|---|---|
| Bundle (gz) | ~33 kB | ~95 kB First Load JS |
| Build | `vite-ssg` | `next build` |
| SSG model | Vite SSR at build time | RSC + static export |
| State mgmt | `ref` / `computed` | `useState` / `useMemo` |
| Routing | None (single page) | None (single page) |
| Styling | `<style scoped>` | Global CSS, BEM |
| Build dir | `dist/` | `out/` |

### Key decisions

- **Next.js App Router** over Vite + React for first-class SSR/RSC, future-proofing
- **Static export** (`output: 'export'`) preserves the static-site deployment model
- **Server components by default** — only 5 of 13 components need `'use client'`
- **BEM class names preserved** — same CSS ported 1:1, zero visual changes
- **Dual selector fix** — featured project cover images needed `.card--feature .card__thumb-logo--cover` to match Vue's scoped-CSS specificity

### Gotchas encountered

- `write` tool writes to host workspace, not the sandbox — needed `cp -r` to bridge during porting
- `sed` ate `\n` in replacement string — switch to Python `str.replace()` for exact-string edits
- `mv tmp target` on an existing target creates `target/tmp/` (nested) — always `rm -rf target` before `mv`
- Vue scoped CSS `[data-v-xxx]` specificity bump doesn't exist in global CSS — dual selector pattern needed

## License

MIT
