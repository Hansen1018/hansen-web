'use client'

import { useActiveSection } from '@/hooks/useActiveSection'
import { navSections } from '@/data/profile'
import SideNav from './SideNav'
import MobileMenu from './MobileMenu'

// navSections is a stable const; derive ids at module top to avoid per-render allocation.
const SECTION_IDS = navSections.map((s) => s.id)

/**
 * NavController — scroll-spy state hub.
 * Calls useActiveSection once, feeds active + scrollTo to both SideNav / MobileMenu,
 * avoiding two components each running their own IntersectionObserver / scroll listener.
 */
export default function NavController() {
  const { active, scrollTo } = useActiveSection(SECTION_IDS)
  return (
    <>
      <SideNav active={active} onJump={scrollTo} />
      <MobileMenu active={active} onJump={scrollTo} />
    </>
  )
}
