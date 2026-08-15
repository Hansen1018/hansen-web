'use client'

import { useActiveSection } from '@/hooks/useActiveSection'
import { navSections } from '@/data/profile'
import SideNav from './SideNav'
import MobileMenu from './MobileMenu'

/**
 * NavController — scroll-spy 状态中枢。
 * 调用 useActiveSection 一次，把 active + scrollTo 同时喂给 SideNav / MobileMenu，
 * 避免两个组件各跑一份 IntersectionObserver / scroll listener。
 */
export default function NavController() {
  const ids = navSections.map((s) => s.id)
  const { active, scrollTo } = useActiveSection(ids)
  return (
    <>
      <SideNav active={active} onJump={scrollTo} />
      <MobileMenu active={active} onJump={scrollTo} />
    </>
  )
}
