/**
 * ============================================================
 *  个人资料 — 全部文案集中在这里，方便维护
 *  Ported from Vue (src/data/profile.js) → Next.js (src/data/profile.ts)
 * ============================================================
 */

export interface SocialLink {
  label: string
  url: string
  icon: string
}

export interface AboutHighlight {
  label: string
  value: string
}

export interface Project {
  title: string
  desc: string
  tags: string[]
  link: string
  repo: string
  logo?: string
  logoFit?: 'cover' | 'contain'
  homepage?: string
  year: number
  featured: boolean
}

export interface SkillGroup {
  group: string
  items: string[]
}

export interface SideHustle {
  title: string
  desc: string
  status: string
  link: string
  probe?: string
  tags: string[]
}

export interface BlogConfig {
  feed: string
  limit: number
  base: string
  moreUrl: string
}

export interface TimelineEntry {
  year: string
  title: string
  org: string
  desc: string
}

export interface Profile {
  name: string
  initials: string
  avatar: string
  role: string
  tagline: string
  location: string
  status: string
  availability: string
  email: string
  socials: SocialLink[]
  about: {
    intro: string
    paragraphs: string[]
    highlights: AboutHighlight[]
  }
  projects: Project[]
  skills: SkillGroup[]
  sideHustles: SideHustle[]
  blog: BlogConfig
  timeline: TimelineEntry[]
}

export const profile: Profile = {
  name: 'Hansen',
  initials: 'H',
  avatar: 'https://avatars.githubusercontent.com/u/61605071?v=4&s=460',
  role: 'Blogger · Vibe Coding 工程师',
  tagline: '闷骚的完美主义者，偶尔幻想，常常言出必行。',
  location: '深圳 📍',
  status: 'Home 🏠',
  availability: '开放闲聊 · 约稿',

  email: 'hansendong1018@gmail.com',
  socials: [
    { label: 'GitHub',   url: 'https://github.com/Hansen1018',        icon: 'github' },
    { label: 'X',        url: 'https://x.com/Hansen1018',            icon: 'twitter' },
    { label: 'Telegram', url: 'https://t.me/Hansen1018',              icon: 'link' },
    { label: 'Email',    url: 'mailto:hansendong1018@gmail.com',      icon: 'email' },
    { label: 'Blog',     url: 'https://blog.hansendong.top/',          icon: 'blog' }
  ],

  about: {
    intro: '1989 年生，闷骚的完美主义小青年。资深 Blogger、网民，娱乐吃瓜一级选手。',
    paragraphs: [
      '我是 Hansen，一个长期混迹网络的博主。爱电影、爱音乐、爱综艺，也爱看娱乐圈的热闹。相信细节决定一切，常常为一个像素较真半天——所以朋友都说我有点强迫症。',
      '乐观、友善、有点理智，爱静也爱动，内外向结合型。我时常口出"狂言"，不一定对自己百分百负责，但对自己说过的话一定负责。理想主义加完美主义，常常幻想一些不切实际的事——但正是这些幻想，让我觉得活着挺有意思。'
    ],
    highlights: [
      { label: 'Born',   value: '1989'           },
      { label: 'Status', value: 'Home 🏠'    },
      { label: 'Vibe',   value: '完美主义'        },
      { label: 'Trade',  value: '客制外设经销'    },
      { label: 'Craft',  value: '工程师'          },
      { label: 'Brew',   value: '美式 ☕'        }
    ]
  },

  projects: [
    {
      title:    'hugo-theme-lumenveil',
      desc:     'A luminous Hugo theme with glass surfaces, aurora ambience, light and dark modes, search, taxonomies, and a reading-first experience.',
      tags:     ['Hugo', 'Theme', 'CSS', 'Glassmorphism', 'GPL-3.0'],
      link:     'https://github.com/Hansen1018/hugo-theme-lumenveil',
      repo:     'https://github.com/Hansen1018/hugo-theme-lumenveil',
      logo:     'https://raw.githubusercontent.com/Hansen1018/hugo-theme-lumenveil/main/docs/screenshots/home-219.png',
      logoFit:  'cover',
      homepage: 'https://blog.hansendong.top/',
      year:     2026,
      featured: true
    },
    {
      title:    'hansen-web',
      desc:     '你正在浏览的网站。Vue 3 + Vite SSG，Glassmorphism 设计，完整 SEO 与 AI agents 优化。',
      tags:     ['Vue', 'Vite SSG', 'CSS', 'MIT'],
      link:     'https://github.com/Hansen1018/hansen-web',
      repo:     'https://github.com/Hansen1018/hansen-web',
      logo:     'https://raw.githubusercontent.com/Hansen1018/hansen-web/main/public/og.png',
      logoFit:  'cover',
      year:     2026,
      featured: true
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
      featured: false
    }
  ],

  skills: [
    { group: '主语言', items: ['Go', 'TypeScript', 'Vue'] },
    { group: '前端',   items: ['HTML', 'CSS', 'JavaScript', 'Vue 3', 'Vite 8', 'vite-ssg'] },
    { group: '脚本与工具', items: ['Shell (bash/zsh)', 'Python', 'Makefile', 'Git', 'Playwright'] },
    { group: '构建与部署', items: ['Hugo', 'nginx', 'GitHub Actions', 'Docker'] }
  ],

  sideHustles: [
    {
      title:  'PT 刷流',
      desc:   '长期挂机刷 PT 流量，用于兑换各类资源。',
      status: '在跑',
      link:   'mailto:hansendong1018@gmail.com?subject=PT%20刷流咨询',
      probe:  'https://status.hansendong.top',
      tags:   ['PT', 'Seedbox', '流量']
    },
    {
      title:  '服务器租用',
      desc:   'NETCUP VPS、独立服务器租用。纯租不刷也接，可按需配置。',
      status: '在跑',
      link:   'mailto:hansendong1018@gmail.com?subject=服务器租用咨询',
      tags:   ['NETCUP', 'VPS', 'Dedicated']
    }
  ],

  blog: {
    feed:    '/blog-feed.json',
    limit:   3,
    base:    'https://blog.hansendong.top',
    moreUrl: 'https://blog.hansendong.top/'
  },

  timeline: [
    { year: '1989',          title: '出生', org: '中国', desc: '闷骚的完美主义小青年，正式上线。' },
    { year: '2004',          title: '触网', org: '互联网', desc: '从 BBS 到论坛，从 QQ 到微博，一头扎进数字世界，从此资深网民身份再未脱下。' },
    { year: '2008 — 2024',   title: '淘宝店主', org: '淘宝', desc: '2008 年开店，先做衣服、包、鞋的服装分销；2015 年起转向美国电竞客制化键盘、鼠标垫，与 SOHO 同步运营，一干就是十六年。' },
    { year: '2013',          title: '开始写博客', org: '个人博客', desc: 'Blogger 上线，记录生活、吐槽、偶尔幻想。' },
    { year: '2015 — 2024',   title: '个人 SOHO', org: '美国电竞客制化键盘、鼠标垫经销', desc: '从美国渠道引进客制化键盘与电竞鼠标垫，在家办公做分销零售，一做就是十年。' },
    { year: '2026 · 01',     title: 'Fork · nofx', org: 'GitHub', desc: '提交 commit 到开源 AI 交易操作系统，加入社区。' },
    { year: '2026 · 01 — 至今', title: 'Vibe Coding 工程师', org: '自我定位', desc: '让 AI 写代码，我负责 vibe、验收和较真——完美主义依然在线。' },
    { year: '2026 · 08 — 至今', title: 'Hugo 主题 Lumenveil', org: 'Hugo · 开源 GPL-3.0', desc: '从零设计并开发 Hugo 博客主题 Lumenveil，主打玻璃质感 + 极光背景 + 长文阅读体验。' }
  ]
}

export const navSections = [
  { id: 'hero',     label: '首页' },
  { id: 'about',    label: '关于' },
  { id: 'projects', label: '作品' },
  { id: 'skills',   label: '技能' },
  { id: 'blog',     label: '博客' },
  { id: 'timeline', label: '经历' },
  { id: 'side',     label: '副业' },
  { id: 'contact',  label: '联系' }
] as const

export type NavSectionId = typeof navSections[number]['id']
