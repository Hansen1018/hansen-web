'use client'

import { useMemo } from 'react'
import { useActiveSection } from '@/hooks/useActiveSection'
import { navSections } from '@/data/profile'
import SideNav from './SideNav'
import MobileMenu from './MobileMenu'

/**
 * NavController — scroll-spy state hub.
 * Calls useActiveSection once, feeds active + scrollTo to both SideNav / MobileMenu,
 * avoiding two components each running their own IntersectionObserver / scroll listener.
 */
export default function NavController() {
  const ids = useMemo(() => navSections.map((s) => s.id), [])
  const { active, scrollTo } = useActiveSection(ids)
  return (
    <>
      <SideNav active={active} onJump={scrollTo} />
      <MobileMenu active={active} onJump={scrollTo} />
    </>
  )
}
