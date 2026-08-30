import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SectionShell from '@/components/SectionShell'

interface ObserverHarness {
  callback: IntersectionObserverCallback
  disconnect: ReturnType<typeof vi.fn>
  observe: ReturnType<typeof vi.fn>
  options?: IntersectionObserverInit
}

function installObserverHarness(): ObserverHarness {
  const harness: ObserverHarness = {
    callback: () => {},
    disconnect: vi.fn(),
    observe: vi.fn(),
  }

  class TestIntersectionObserver {
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      harness.callback = callback
      harness.options = options
    }

    disconnect = harness.disconnect
    observe = harness.observe
    takeRecords = vi.fn(() => [])
    unobserve = vi.fn()
  }

  vi.stubGlobal('IntersectionObserver', TestIntersectionObserver)
  return harness
}

function renderShell() {
  return render(
    <SectionShell id="sample" index="01" eyebrow="Test" title="Sample">
      Body
    </SectionShell>,
  )
}

describe('SectionShell visibility observer', () => {
  it('uses a zero threshold and reveals on any intersection after the debounce', () => {
    vi.useFakeTimers()
    const harness = installObserverHarness()
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        frames.push(callback)
        return frames.length
      }),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const { container } = renderShell()
    const section = container.querySelector('#sample')

    expect(harness.options).toEqual({
      threshold: 0,
      rootMargin: '0px 0px -5% 0px',
    })
    expect(harness.observe).toHaveBeenCalledWith(section)

    act(() => {
      harness.callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
      vi.advanceTimersByTime(149)
    })
    expect(frames).toHaveLength(0)
    expect(section).not.toHaveClass('is-visible')

    act(() => {
      vi.advanceTimersByTime(1)
      frames.shift()?.(150)
    })
    expect(section).toHaveClass('is-visible')
  })

  it('debounces rapid observer changes so the latest visibility wins', () => {
    vi.useFakeTimers()
    const harness = installObserverHarness()
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const { container } = renderShell()
    const section = container.querySelector('#sample')

    act(() => {
      harness.callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
      vi.advanceTimersByTime(100)
      harness.callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
      vi.advanceTimersByTime(150)
      frames.shift()?.(250)
    })

    expect(frames).toHaveLength(0)
    expect(section).not.toHaveClass('is-visible')
  })

  it('disconnects and cancels pending work on unmount', () => {
    vi.useFakeTimers()
    const harness = installObserverHarness()
    const requestAnimationFrame = vi.fn()
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const { unmount } = renderShell()

    act(() => {
      harness.callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    unmount()
    act(() => vi.advanceTimersByTime(150))

    expect(harness.disconnect).toHaveBeenCalledOnce()
    expect(requestAnimationFrame).not.toHaveBeenCalled()
  })
})
