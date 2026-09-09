import BackgroundLayer from '@/components/BackgroundLayer'
import NavController from '@/components/NavController'
import ThemeToggle from '@/components/ThemeToggle'
import PageContent from '@/components/PageContent'

export default function HomePage() {
  return (
    <>
      <BackgroundLayer />
      <NavController />
      <ThemeToggle />
      <main className="page">
        <PageContent />
      </main>
    </>
  )
}
