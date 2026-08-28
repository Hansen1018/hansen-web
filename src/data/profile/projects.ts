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
    // Legacy entry — hansen-web (Vue 3 + Vite SSG) was the previous incarnation
    // of this personal site before the 2026 Next.js migration. The currently
    // deployed version (https://hansendong.top) is the Next.js app in this repo
    // (hansen-web-next), NOT this Vue codebase.
    title:    'hansen-web (legacy Vue)',
    desc:     '本站的前一版实现。Vue 3 + Vite SSG，Glassmorphism 设计，完整 SEO 与 AI agents 优化。当前线上版本已迁移至 Next.js（hansen-web-next，仓库根目录）。',
    tags:     ['Vue', 'Vite SSG', 'CSS', 'MIT'],
    link:     'https://github.com/Hansen1018/hansen-web',
    repo:     'https://github.com/Hansen1018/hansen-web',
    logo:     'https://raw.githubusercontent.com/Hansen1018/hansen-web/main/public/og.png',
    logoFit:  'cover',
    year:     2026,
    featured: false,
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
