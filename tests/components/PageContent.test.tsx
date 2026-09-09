import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock the 8 sections PageContent renders so this file only exercises
// PageContent's own behaviour (scroll listener, threshold parsing, initial
// state). Real sections would re-render large subtrees + schedule their own
// effects, which is noise here.
//
// HeroSection is special-cased to expose the `scrollFaded` prop as a data
// attribute so we can assert on the parent→child contract directly.
vi.mock('@/components/HeroSection', () => ({
  default: ({ scrollFaded }: { scrollFaded?: boolean }) => (
    <div data-testid="hero" data-scroll-faded={String(Boolean(scrollFaded))} />
  ),
}))
vi.mock('@/components/AboutSection', () => ({
  default: () => <div data-testid="about" />,
}))
vi.mock('@/components/ProjectsSection', () => ({
  default: () => <div data-testid="projects" />,
}))
vi.mock('@/components/SkillsSection', () => ({
  default: () => <div data-testid="skills" />,
}))
vi.mock('@/components/BlogSection', () => ({
  default: () => <div data-testid="blog" />,
}))
vi.mock('@/components/TimelineSection', () => ({
  default: () => <div data-testid="timeline" />,
}))
vi.mock('@/components/SideHustleSection', () => ({
  default: () => <div data-testid="side-hustle" />,
}))
vi.mock('@/components/ContactSection', () => ({
  default: () => <div data-testid="contact" />,
}))

import PageContent from '@/components/PageContent'

// ——— Harness ————————————————————————————————————————————————————————

let scrollHandler: EventListener | null = null
let rafCallbacks: FrameRequestCallback[] = []
let nextRafId = 1

type ThresholdSpec = string | null

interface HarnessOptions {
  /** Value returned for `--scroll-fade-threshold`. null = missing var (""). */
  thresholdCssVar: ThresholdSpec
  /** window.scrollY at mount time (read-only getter). */
  initialScrollY: number
}

function installHarness(opts: HarnessOptions) {
  // 1. getComputedStyle → controlled threshold value
  vi.spyOn(window, 'getComputedStyle').mockImplementation(
    () =>
      ({
        getPropertyValue: (prop: string) =>
          prop === '--scroll-fade-threshold' ? opts.thresholdCssVar ?? '' : '',
      }) as unknown as CSSStyleDeclaration,
  )

  // 2. window.scrollY is read-only in jsdom; expose as a getter
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    get: () => opts.initialScrollY,
    set: () => {},
  })

  // 3. Capture the scroll listener PageContent registers
  scrollHandler = null
  const origAdd = window.addEventListener.bind(window)
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    if (type === 'scroll' && typeof listener === 'function') {
      scrollHandler = listener
    }
    return origAdd(type as any, listener as any, options as any)
  })

  // 4. requestAnimationFrame / cancelAnimationFrame — capture callbacks
  //    into an array so the test fires them deterministically.
  rafCallbacks = []
  nextRafId = 1
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCallbacks.push(cb)
    return nextRafId++
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
}

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    get: () => value,
    set: () => {},
  })
}

function fireScroll(times = 1) {
  act(() => {
    for (let i = 0; i < times; i++) scrollHandler?.(new Event('scroll'))
  })
}

function fireRaf() {
  const cbs = rafCallbacks
  rafCallbacks = []
  act(() => {
    cbs.forEach((cb) => cb(performance.now()))
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  scrollHandler = null
  rafCallbacks = []
})

// ——— Threshold parsing (CSS var + fallback) ——————————————————————

describe('PageContent — threshold parsing', () => {
  it('uses --scroll-fade-threshold when globals.css resolves it to "24px"', () => {
    installHarness({ thresholdCssVar: '24px', initialScrollY: 100 })
    const { getByTestId } = render(<PageContent />)
    // 100 > 24 → scrollFaded=true
    expect(getByTestId('hero').dataset.scrollFaded).toBe('true')
  })

  it('honours a custom threshold like "48px" without falling back', () => {
    installHarness({ thresholdCssVar: '48px', initialScrollY: 40 })
    const { getByTestId } = render(<PageContent />)
    // 40 < 48 → false (would have been true with the 24 fallback)
    expect(getByTestId('hero').dataset.scrollFaded).toBe('false')
  })

  it('falls back to SCROLL_FADE_THRESHOLD_FALLBACK when the var is empty (SSR / missing)', () => {
    installHarness({ thresholdCssVar: null, initialScrollY: 25 })
    const { getByTestId } = render(<PageContent />)
    // fallback = 24 → 25 > 24 → true
    expect(getByTestId('hero').dataset.scrollFaded).toBe('true')
  })

  it('falls back when the var is a non-numeric token', () => {
    installHarness({ thresholdCssVar: 'garbage', initialScrollY: 25 })
    const { getByTestId } = render(<PageContent />)
    expect(getByTestId('hero').dataset.scrollFaded).toBe('true')
  })

  it('falls back when the var resolves to 0 (zero-threshold has no semantic meaning)', () => {
    installHarness({ thresholdCssVar: '0px', initialScrollY: 0 })
    const { getByTestId } = render(<PageContent />)
    // fallback = 24 → 0 < 24 → false
    expect(getByTestId('hero').dataset.scrollFaded).toBe('false')
  })

  it('falls back when the var resolves to a negative number', () => {
    installHarness({ thresholdCssVar: '-5px', initialScrollY: 0 })
    const { getByTestId } = render(<PageContent />)
    expect(getByTestId('hero').dataset.scrollFaded).toBe('false')
  })
})

// ——— Initial state on mount (useLayoutEffect must commit before paint) —

describe('PageContent — initial state on mount', () => {
  it('commits scrollFaded=false synchronously when scrollY <= threshold', () => {
    installHarness({ thresholdCssVar: '24px', initialScrollY: 0 })
    const { getByTestId } = render(<PageContent />)
    expect(getByTestId('hero').dataset.scrollFaded).toBe('false')
  })

  it('commits scrollFaded=true synchronously when scrollY > threshold at mount', () => {
    installHarness({ thresholdCssVar: '24px', initialScrollY: 1000 })
    const { getByTestId } = render(<PageContent />)
    expect(getByTestId('hero').dataset.scrollFaded).toBe('true')
  })

  it('renders the below-hero wrapper with `is-lifted` only when scrollFaded is true', () => {
    installHarness({ thresholdCssVar: '24px', initialScrollY: 1000 })
    const { container } = render(<PageContent />)
    const wrapper = container.querySelector('.below-hero')
    expect(wrapper?.className).toContain('is-lifted')
  })
})

// ——— rAF coalescing ——————————————————————————————————————————————

describe('PageContent — rAF-coalesced scroll handler', () => {
  it('coalesces multiple scroll events within the same frame into one setState', () => {
    installHarness({ thresholdCssVar: '24px', initialScrollY: 0 })
    const { getByTestId } = render(<PageContent />)
    expect(getByTestId('hero').dataset.scrollFaded).toBe('false')

    setScrollY(100)
    fireScroll(5) // five rapid scroll events in the same tick

    // Only ONE rAF was scheduled; the rest short-circuited on the rafId guard.
    expect(rafCallbacks.length).toBe(1)
    // Before the rAF fires, the visible state is still the previous one.
    expect(getByTestId('hero').dataset.scrollFaded).toBe('false')

    fireRaf()
    expect(getByTestId('hero').dataset.scrollFaded).toBe('true')
  })

  it('schedules a new rAF after the previous one fires (rafId is reset)', () => {
    installHarness({ thresholdCssVar: '24px', initialScrollY: 0 })
    const { getByTestId } = render(<PageContent />)

    setScrollY(100)
    fireScroll()
    expect(rafCallbacks.length).toBe(1)
    fireRaf()
    expect(getByTestId('hero').dataset.scrollFaded).toBe('true')

    // Scroll back below threshold — should schedule a fresh rAF.
    setScrollY(0)
    fireScroll()
    expect(rafCallbacks.length).toBe(1)
    fireRaf()
    expect(getByTestId('hero').dataset.scrollFaded).toBe('false')
  })

  it('reads the latest scrollY inside the rAF (not the value at event time)', () => {
    installHarness({ thresholdCssVar: '24px', initialScrollY: 0 })
    const { getByTestId } = render(<PageContent />)

    // Event 1 fires while scrollY is still below threshold; between event and
    // rAF, scrollY climbs past the threshold. The rAF must observe the newer
    // value (this is the whole point of coalescing — single read per frame).
    scrollHandler?.(new Event('scroll'))
    expect(rafCallbacks.length).toBe(1)

    setScrollY(100)
    fireRaf()
    expect(getByTestId('hero').dataset.scrollFaded).toBe('true')
  })

  it('cancels a pending rAF on unmount', () => {
    installHarness({ thresholdCssVar: '24px', initialScrollY: 0 })
    const cancelSpy = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', cancelSpy)

    const { unmount } = render(<PageContent />)

    setScrollY(100)
    fireScroll() // schedules rAF id=1
    expect(rafCallbacks.length).toBe(1)

    unmount()
    expect(cancelSpy).toHaveBeenCalledWith(1)
  })

  it('removes the scroll listener on unmount', () => {
    installHarness({ thresholdCssVar: '24px', initialScrollY: 0 })
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = render(<PageContent />)
    unmount()

    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function))
  })
})
