import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ContactSection from '@/components/ContactSection'

describe('ContactSection footer', () => {
  it('identifies Next.js without embedding a version that can drift', () => {
    render(<ContactSection />)

    const footer = screen.getByText('Built with Next.js').closest('footer')
    expect(footer).toHaveTextContent('Built with Next.js')
    expect(footer?.textContent).not.toMatch(/Built with Next\.js\s+\d/)
  })
})
