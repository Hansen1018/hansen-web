# Hansen Web · Personal Site

> [English](./README.md) · [中文](./README.zh-CN.md)

Luminous personal portfolio built with **Next.js App Router + React + TypeScript**. Glassmorphism design, aurora ambience, scroll-spy navigation, typewriter hero, and a blog feed synced build-time from the Hugo blog.

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

- **Next.js App Router** with `output: 'export'` — pure static site, zero runtime cost
- **React** server components by default; only 7 of 14 components ship client JS
- **TypeScript strict** — full type safety on data, hooks, components
- **Glassmorphism + aurora background** — three drifting radial blobs, grain noise overlay, glass cards with `backdrop-filter`
- **Scroll-spy** — single `IntersectionObserver` powers both `SideNav` (desktop) and `MobileMenu` (mobile) via `NavController`
- **Hero typewriter** — `type → pause → delete` state machine with `prefers-reduced-motion` guard
- **Live blog feed** — client-side `fetch()` to `https://blog.hansendong.top/index.json` with `cache: "no-store"`; 5 min poll + `visibilitychange` refresh. No build-time sync.
- **Open Graph + JSON-LD** — full metadata API: `Person` + `WebSite` + `WebPage` structured data
- **Mobile-first responsive** — breakpoints at 640 / 720 / 900 / 1180 px

## Tech Stack

| Layer | Tool | Version |
|---|---|---|
| Framework | Next.js (App Router, `output: 'export'`) | — |
| UI | React + react-dom | — |
| Language | TypeScript (strict) | — |
| Styling | Vanilla CSS · BEM naming | — |
| Image generation | `sharp` (SVG → PNG for `og.png`) | — |
| Blog feed | Hugo `index.json` (live fetch, CORS-enabled) | — |
| Deploy | `rsync` → `/var/www/hansen-web/` | — |

## Quick Start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs to out/
```

`npm run build` runs one prebuild step first:

```
prebuild
└── scripts/gen-og.mjs          # public/og.svg → public/og.png (1200×630)
```

## Project Structure

```
hansen-web-next/
├── package.json
├── next.config.mjs        # output: 'export' + images.unoptimized + CSP/XFO headers
├── tsconfig.json          # strict mode, @/* path alias
├── deploy.sh              # atomic replace + rsync + post-deploy healthcheck
├── public/                # favicon, og.svg (post-build)
├── screenshots/           # README preview images (desktop / mobile)
├── scripts/
│   ├── gen-og.mjs         # SVG → PNG
│   ├── capture-previews.mjs
│   ├── audit-cyan-light.mjs   # WCAG cyan-contrast audit
│   └── verify-*.mjs       # sidenav + computed-style verification
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
    │   ├── ThemeToggle.tsx         # client — data-theme + localStorage
    │   └── socialIcons.ts          # shared SVG paths
    ├── data/
    │   └── profile/                # all content, split into per-section files
    │       ├── index.ts            # Profile interface + top-level fields + socials + navSections + aggregator
    │       ├── about.ts            # {intro, paragraphs, highlights}
    │       ├── projects.ts         # Project[]
    │       ├── skills.ts           # SkillGroup[]
    │       ├── side-hustles.ts     # SideHustle[]
    │       ├── blog.ts             # BlogConfig
    │       └── timeline.ts         # TimelineEntry[]
    ├── hooks/
    │   └── useActiveSection.ts     # scroll-spy state machine
    └── styles/
        ├── background-layer.css            # BackgroundLayer + aurora
        ├── side-nav.css                    # SideNav
        ├── mobile-menu.css                 # MobileMenu
        ├── section-shell.css               # SectionShell
        ├── about-section.css               # AboutSection
        ├── hero-section.css                # HeroSection
        ├── projects-section.css            # ProjectsSection
        ├── skills-section.css              # SkillsSection
        ├── blog-section.css                # BlogSection
        ├── timeline-section.css            # TimelineSection
        ├── side-hustle-section.css         # SideHustleSection
        ├── contact-section.css             # ContactSection
        ├── theme-toggle.css                # ThemeToggle
        └── utilities.css                   # Page wrapper
                                          # Imported individually in layout.tsx
                                          # (Turbopack doesn't resolve CSS @import)
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
| `BlogSection` | Client | Fetches live Hugo `index.json` on mount + 5 min poll + visibilitychange refresh |
| `TimelineSection` | Server | Pure presentational |
| `SideHustleSection` | Server | Pure presentational |
| `ContactSection` | Server | Pure presentational |
| `HeroSection` | Client | Typewriter state machine |
| `SectionShell` | Client | IntersectionObserver fade-in |
| `SideNav` | Server | Presentational, receives props |
| `MobileMenu` | Client | Open/close state, body scroll lock |
| `NavController` | Client | Wraps scroll-spy for SideNav + MobileMenu |
| `ThemeToggle` | Client | data-theme + localStorage sync, mount-aware disable |

Five of the eight section components ship as pure HTML. The interactivity layer (scroll-spy, typewriter, mobile drawer, blog fetch) is the only client JS.

### Scroll-spy

`useActiveSection` in `src/hooks/useActiveSection.ts` ports the Vue composable 1:1:

1. Pick section with `rect.top <= 0.3 × innerHeight` and largest `rect.top`
2. Last-section fallback: if last section fully fits inside viewport, force-pick it
3. Top fallback: if nothing matched, pick the closest one below the trigger line

`NavController` calls this hook once and feeds `active` + `scrollTo` to both `SideNav` (desktop) and `MobileMenu` (mobile) — single observer instance, no duplication.

### CSS

Styles split across 14 per-section files under `src/styles/`, each imported individually in `src/app/layout.tsx`. Class names follow BEM (`block__element--modifier`). No CSS Modules, no styled-components — direct global CSS since Next.js compiles each file once and class names are namespaced enough.

Why individual imports and not an `@import` aggregator: Next.js 16's default bundler (Turbopack) does not resolve CSS `@import` statements, so a single aggregator file with `@import` lines would ship empty to production. Individual imports avoid the issue and preserve per-file ownership.

Vue version used `<style scoped>` which appended `[data-v-xxx]` attributes for specificity. In Next.js global CSS, the dual selector pattern (`.card--feature .card__thumb-logo--cover, .card__thumb-logo--cover`) replicates the specificity boost that Vue's data attribute provided.

## Deploy

```bash
# Atomic replace on remote (prevents nested dir bug:
# mv tmp target on existing target creates target/tmp/)
rm -rf /var/www/hansen-web.tmp
mkdir -p /var/www/hansen-web.tmp
rsync -a --delete out/ /var/www/hansen-web.tmp/
rm -rf /var/www/hansen-web
mv /var/www/hansen-web.tmp /var/www/hansen-web
curl -fsSI https://hansendong.top/   # post-deploy healthcheck
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


## License

MIT — see [LICENSE](./LICENSE).
