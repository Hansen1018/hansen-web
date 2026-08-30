import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import HeroSection from '@/components/HeroSection'

function mockReducedMotion(matches: boolean) {
  const mediaQuery = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }
  const matchMedia = vi.fn().mockReturnValue({
    ...mediaQuery,
  })
  vi.stubGlobal('matchMedia', matchMedia)
  return { matchMedia, mediaQuery }
}

describe('HeroSection reduced-motion behavior', () => {
  it('renders the complete name once and does not animate it when motion is reduced', () => {
    vi.useFakeTimers()
    const { matchMedia } = mockReducedMotion(true)
    const { container } = render(<HeroSection />)
    const name = container.querySelector('.hero__name-text')

    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
    expect(name).toHaveTextContent('Hansen.')

    act(() => vi.advanceTimersByTime(10_000))
    expect(name).toHaveTextContent('Hansen.')
  })

  it('retains the typewriter path when reduced motion is not requested', () => {
    vi.useFakeTimers()
    mockReducedMotion(false)
    const { container } = render(<HeroSection />)
    const name = container.querySelector('.hero__name-text')

    expect(name).toHaveTextContent('H.')
    expect(name).not.toHaveTextContent('Hansen.')

    act(() => vi.advanceTimersByTime(550))
    expect(name).toHaveTextContent('Hansen.')
  })

  it('stops the typewriter when reduced motion becomes enabled', () => {
    vi.useFakeTimers()
    const { mediaQuery } = mockReducedMotion(false)
    const { container, unmount } = render(<HeroSection />)
    const name = container.querySelector('.hero__name-text')
    const listener = mediaQuery.addEventListener.mock.calls[0]?.[1] as
      | ((event: MediaQueryListEvent) => void)
      | undefined

    expect(listener).toBeDefined()
    act(() => listener?.({ matches: true } as MediaQueryListEvent))
    expect(name).toHaveTextContent('Hansen.')

    act(() => vi.advanceTimersByTime(10_000))
    expect(name).toHaveTextContent('Hansen.')

    unmount()
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', listener)
  })
})
