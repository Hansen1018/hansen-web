import BackgroundLayer from '@/components/BackgroundLayer'
import NavController from '@/components/NavController'
import HeroSection from '@/components/HeroSection'
import AboutSection from '@/components/AboutSection'
import ProjectsSection from '@/components/ProjectsSection'
import SkillsSection from '@/components/SkillsSection'
import BlogSection from '@/components/BlogSection'
import TimelineSection from '@/components/TimelineSection'
import SideHustleSection from '@/components/SideHustleSection'
import ContactSection from '@/components/ContactSection'

export default function HomePage() {
  return (
    <>
      <BackgroundLayer />
      <NavController />
      <main className="page">
        <HeroSection />
        <AboutSection />
        <ProjectsSection />
        <SkillsSection />
        <BlogSection />
        <TimelineSection />
        <SideHustleSection />
        <ContactSection />
      </main>
    </>
  )
}
