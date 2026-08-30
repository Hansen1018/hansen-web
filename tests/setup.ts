import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

class NoopIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = '0px'
  readonly thresholds = [0]

  disconnect() {}
  observe() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
  unobserve() {}
}

vi.stubGlobal('IntersectionObserver', NoopIntersectionObserver)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.stubGlobal('IntersectionObserver', NoopIntersectionObserver)
})
