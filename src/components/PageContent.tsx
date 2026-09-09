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
 *   - --scroll-fade-threshold (24px) read here via getComputedStyle in
 *     the layout effect below; SCROLL_FADE_THRESHOLD_FALLBACK covers
 *     SSR + missing var.
 *   - .hero__scroll opacity .7s cubic-bezier(.22,1,.36,1) in
 *     `hero-section.css` (same curve as the transform).
 */
// SSR / missing-var fallback for the --scroll-fade-threshold read in the
// layout effect below. JSDoc above describes the single source of truth.
// IMPORTANT: keep this numeric value in sync with the --scroll-fade-threshold
// default in src/app/globals.css :root. The two diverge by design only in
// the SSR / very-old-browser path; the live runtime value always wins.
const SCROLL_FADE_THRESHOLD_FALLBACK = 24

export default function PageContent() {
  const [scrollFaded, setScrollFaded] = useState(false)

  // useLayoutEffect (not useEffect) so the initial scrollY check runs BEFORE
  // the first paint — avoids a one-frame flash on browser scroll restoration
  // or in-page anchor navigation where scrollY > threshold at mount.
  useLayoutEffect(() => {
    // Read the threshold from the CSS var so the JS follows globals.css.
    // Fall back to the SSR-safe constant if the var is missing or
    // getComputedStyle throws (very old browsers).
    const raw = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--scroll-fade-threshold'),
    )
    // getComputedStyle returns the resolved length in px (e.g. "24px"), but
    // the var could be misconfigured to "" (missing), a non-numeric token,
    // or a non-positive value (zero / negative) that has no semantic meaning
    // here. Fall back to the SSR-safe constant in those cases — see
    // SCROLL_FADE_THRESHOLD_FALLBACK jsdoc above for the cross-file sync note.
    const threshold = Number.isFinite(raw) && raw > 0 ? raw : SCROLL_FADE_THRESHOLD_FALLBACK

    // Initial state is set SYNCHRONOUSLY (no rAF) so it's committed
    // before the browser paints — the whole point of using useLayoutEffect here.
    const initial = window.scrollY > threshold
    setScrollFaded(initial)

    // Coalesce scroll events into a single rAF: rapid scrolling schedules
    // one frame at a time, and the rAF callback reads the latest
    // scrollY (not the value that was current when the event fired).
    // This stops scrollFaded from lagging behind during continuous
    // scrolling without re-rendering more than once per frame.
    let rafId: number | null = null
    const onScroll = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        setScrollFaded(window.scrollY > threshold)
      })
    }
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
