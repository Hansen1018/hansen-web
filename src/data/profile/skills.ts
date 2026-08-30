/**
 * ============================================================
 *  Skills section data
 *  Export: profileSkills — SkillGroup[]
 *  Types: imported from ./index (type-only)
 * ============================================================
 */

export const profileSkills = [
  // "Vue" intentionally listed in BOTH 主语言 and 前端: it's the only stack
  // used end-to-end across the Hugo blog + this site, so it earns both a
  // primary-language slot AND a frontend-stack mention. Remove the 前端 entry
  // if you'd rather not surface the same chip twice.
  { group: '主语言', items: ['Go', 'TypeScript', 'Vue'] },
  { group: '前端',   items: ['HTML', 'CSS', 'JavaScript', 'Vue', 'Vite', 'vite-ssg', 'Next.js', 'React'] },
  { group: '脚本与工具', items: ['Shell (bash/zsh)', 'Python', 'Makefile', 'Git', 'Playwright'] },
  { group: '构建与部署', items: ['Hugo', 'nginx', 'GitHub Actions', 'Docker'] },
  { group: 'AI 工具', items: ['OpenCode', 'OpenClaw'] },
]
