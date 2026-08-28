/**
 * ============================================================
 *  Personal profile — aggregator
 *  Original src/data/profile.ts (211 lines) split into:
 *    ./about, ./projects, ./skills, ./side-hustles,
 *    ./blog, ./timeline
 *  This file holds:
 *    - All interface declarations
 *    - Top-level identity fields (name, role, tagline, ...)
 *    - socials[] (small, kept inline)
 *    - navSections[] + NavSectionId type
 *    - Final aggregated `profile` export
 *
 *  Imports remain unchanged for callers:
 *    import { profile } from '@/data/profile'
 *  resolves to this index.ts.
 * ============================================================
 */

import { profileAbout } from './about'
import { profileProjects } from './projects'
import { profileSkills } from './skills'
import { profileSideHustles } from './side-hustles'
import { profileBlog } from './blog'
import { profileTimeline } from './timeline'

// ============================================================
//  Interfaces
// ============================================================

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

// ============================================================
//  Top-level identity + socials (small, kept inline)
// ============================================================

const profileIdentity = {
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
    { label: 'Telegram', url: 'https://t.me/Hansen1018',              icon: 'telegram' },
    { label: 'Email',    url: 'mailto:hansendong1018@gmail.com',      icon: 'email' },
    { label: 'Blog',     url: 'https://blog.hansendong.top/',          icon: 'blog' },
  ],
}

// ============================================================
//  Aggregator — assemble the final `profile`
// ============================================================

export const profile: Profile = {
  ...profileIdentity,
  about:       profileAbout,
  projects:    profileProjects,
  skills:      profileSkills,
  sideHustles: profileSideHustles,
  blog:        profileBlog,
  timeline:    profileTimeline,
}

// ============================================================
//  Navigation
// ============================================================

export const navSections = [
  { id: 'hero',     label: '首页' },
  { id: 'about',    label: '关于' },
  { id: 'projects', label: '作品' },
  { id: 'skills',   label: '技能' },
  { id: 'blog',     label: '博客' },
  { id: 'timeline', label: '经历' },
  { id: 'side',     label: '副业' },
  { id: 'contact',  label: '联系' },
] as const

export type NavSectionId = typeof navSections[number]['id']
