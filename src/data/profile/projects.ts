/**
 * ============================================================
 *  Projects section data
 *  Export: profileProjects — Project[]
 *  Types: imported from ./index (type-only)
 * ============================================================
 */

import type { Project } from './index'

export const profileProjects: Project[] = [
  {
    title:    'hugo-theme-lumenveil',
    desc:     'A luminous Hugo theme with glass surfaces, aurora ambience, light and dark modes, search, taxonomies, and a reading-first experience.',
    tags:     ['Hugo', 'Theme', 'CSS', 'Glassmorphism', 'GPL-3.0'],
    link:     'https://github.com/Hansen1018/hugo-theme-lumenveil',
    repo:     'https://github.com/Hansen1018/hugo-theme-lumenveil',
    logo:     'https://raw.githubusercontent.com/Hansen1018/hugo-theme-lumenveil/main/docs/screenshots/home-219.png',
    logoFit:  'cover',
    year:     2026,
    featured: true,
  },
  {
    // This entry describes the currently-deployed personal site (the
    // Next.js codebase in this repo, served at https://hansendong.top).
    // The earlier "hansen-web" Vue 3 + Vite SSG codebase has been
    // retired; this site is its Next.js successor.
    title:    'hansen-web',
    desc:     '本站源码 · 你正在浏览的网站。Next.js 16 App Router + React + TypeScript，Glassmorphism 设计、极光氛围背景、scroll-spy 导航、打字机 hero、live Hugo 博客 feed、完整 SEO + JSON-LD 结构化数据、SSR/SSG 静态导出零运行时成本。',
    tags:     ['Next.js', 'React', 'TypeScript', 'Glassmorphism', 'MIT'],
    link:     'https://github.com/Hansen1018/hansen-web-next',
    repo:     'https://github.com/Hansen1018/hansen-web-next',
    logo:     'https://hansendong.top/og.png',
    logoFit:  'cover',
    year:     2026,
    featured: true,
  },
  {
    title:    'nofx',
    desc:     '开源 AI 交易操作系统 · 市场数据 → AI 推理 → 交易执行 · 自托管多交易所支持',
    tags:     ['Go', 'TypeScript', 'Shell', 'Python', 'AGPL-3.0'],
    link:     'https://github.com/Hansen1018/nofx',
    repo:     'https://github.com/Hansen1018/nofx',
    logo:     'https://raw.githubusercontent.com/Hansen1018/nofx/Individual/screenshots/dashboard-page.png',
    logoFit:  'cover',
    year:     2026,
    featured: false,
  },
]
