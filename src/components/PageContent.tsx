'use client'

import { useLayoutEffect, useState } from 'react'
import HeroSection from './HeroSection'
import AboutSection from './AboutSection'
import ProjectsSection from './ProjectsSection'
import SkillsSection from './SkillsSection'
import BlogSection from './BlogSection'
import TimelineSection from './TimelineSection'
import SideHustleSection from './SideHustleSection'
import ContactSection from './ContactSection'

/**
 * PageContent — owns the single scroll listener that drives the hero pill
 * fade-out (passed down to HeroSection as `scrollFaded`) and the
 * `.below-hero.is-lifted` class that shifts AboutSection+ up by 70px so
 * its top lands at the same viewport y as the hero pill's top was at the
 * moment scrollY crossed 24. SectionShell still owns its own
 * IntersectionObserver fade-in for every section below the hero — this
 * wrapper only repositions them, never hides them.
 *
 * Cross-file geometry contract — single source of truth lives in
 * `src/app/globals.css :root`:
 *   - --scroll-pill-gap (32px) + --scroll-pill-height (38px) consumed by
 *     .hero__scroll (hero-section.css) and .below-hero.is-lifted
 *     (page-layout.css) via var().
 *   - SCROLL_FADE_THRESHOLD (this file) is a JS constant — it has to be,
 *     since it's compared against window.scrollY at runtime.
 *   - .hero__scroll opacity .7s cubic-bezier(.22,1,.36,1) in
 *     `hero-section.css` (same curve as the transform).
 */
const SCROLL_FADE_THRESHOLD = 24

export default function PageContent() {
  const [scrollFaded, setScrollFaded] = useState(false)

  // useLayoutEffect (not useEffect) so the initial scrollY check runs BEFORE
  // the first paint — avoids a one-frame flash on browser scroll restoration
  // or in-page anchor navigation where scrollY > 24 at mount.
  useLayoutEffect(() => {
    let rafId: number | null = null
    let lastFaded = false
    const apply = (faded: boolean) => {
      if (faded === lastFaded) return
      lastFaded = faded
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => setScrollFaded(faded))
    }
    const onScroll = () => apply(window.scrollY > SCROLL_FADE_THRESHOLD)
    apply(window.scrollY > SCROLL_FADE_THRESHOLD)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <>
      <HeroSection scrollFaded={scrollFaded} />
      <div className={`below-hero${scrollFaded ? ' is-lifted' : ''}`}>
        <AboutSection />
        <ProjectsSection />
        <SkillsSection />
        <BlogSection />
        <TimelineSection />
        <SideHustleSection />
        <ContactSection />
      </div>
    </>
  )
}
