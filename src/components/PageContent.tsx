'use client'

import { useEffect, useState } from 'react'
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
 */
export default function PageContent() {
  const [scrollFaded, setScrollFaded] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrollFaded(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
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
