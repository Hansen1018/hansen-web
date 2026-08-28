'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

const hasNativeScrollEnd = typeof window !== 'undefined' && 'onscrollend' in window

/**
 * Scroll-spy: tracks the active state of a set of sections.
 *
 * Algorithm (top-based):
 *   1. Pick the section where "rect.top <= triggerY(0.3*innerHeight) && rect.top is the largest"
 *   2. Last-section fallback: force-pick the last section when it's fully in viewport
 *   3. Top fallback: nearest below the trigger line
 *
 * Instant lock (on scrollTo):
 *   During smooth-scroll animation, the algorithm picks the wrong section by ratio.
 *   On scrollTo, immediately lock active to the target id; don't recompute during scroll;
 *   Unlock via the native `scrollend` event (Chromium 114+, Firefox 109+).
 *   When scrollend isn't supported, fall back to a 3s timer.
 *
 * @param ids list of section ids (for DOM lookup)
 * @returns { active, scrollTo }
 */
export function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0] ?? '')
  const lockedIdRef = useRef<string | null>(null)
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onScrollEndRef = useRef<(() => void) | null>(null)

  const pickActive = useCallback(() => {
    if (lockedIdRef.current) return

    const triggerY = window.innerHeight * 0.3
    let best: string | null = null
    let bestTop = -Infinity

    for (const id of ids) {
      const el = document.getElementById(id)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (rect.top <= triggerY && rect.top > bestTop) {
        bestTop = rect.top
        best = id
      }
    }

    const lastId = ids[ids.length - 1]
    const lastEl = lastId ? document.getElementById(lastId) : null
    // lastId is structurally guaranteed truthy here (lastEl derived from it),
    // but noUncheckedIndexedAccess widens ids[i] to string | undefined, so
    // explicit narrowing is required for the assignment below.
    if (lastEl && lastId) {
      const r = lastEl.getBoundingClientRect()
      if (r.top >= 0 && r.bottom <= window.innerHeight) {
        best = lastId
      }
    }

    if (!best) {
      let closest = Infinity
      for (const id of ids) {
        const el = document.getElementById(id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top > triggerY && rect.top < closest) {
          closest = rect.top
          best = id
        }
      }
      if (!best) best = ids[0] ?? ''
    }

    setActive(best ?? '')
  }, [ids])

  const unlock = useCallback(() => {
    if (unlockTimerRef.current) {
      clearTimeout(unlockTimerRef.current)
      unlockTimerRef.current = null
    }
    lockedIdRef.current = null
    pickActive()
  }, [pickActive])

  const scrollTo = useCallback(
    (id: string) => {
      const el = document.getElementById(id)
      if (!el) return

      setActive(id)
      lockedIdRef.current = id

      el.scrollIntoView({ behavior: 'smooth', block: 'start' })

      // Rapid double-click: drop the previous scrollend listener before registering a new one.
      if (onScrollEndRef.current) {
        window.removeEventListener('scrollend', onScrollEndRef.current)
        onScrollEndRef.current = null
      }

      const onScrollEnd = () => {
        window.removeEventListener('scrollend', onScrollEnd)
        onScrollEndRef.current = null
        unlock()
      }
      onScrollEndRef.current = onScrollEnd
      window.addEventListener('scrollend', onScrollEnd, { once: true })

      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current)
      // Fallback timer only when scrollend isn't natively supported.
      if (!hasNativeScrollEnd) {
        unlockTimerRef.current = setTimeout(() => {
          window.removeEventListener('scrollend', onScrollEnd)
          onScrollEndRef.current = null
          unlock()
        }, 3000)
      }
    },
    [unlock],
  )

  useEffect(() => {
    pickActive()
    const onScroll = () => {
      if (lockedIdRef.current) return
      pickActive()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', pickActive)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', pickActive)
      if (onScrollEndRef.current) {
        window.removeEventListener('scrollend', onScrollEndRef.current)
        onScrollEndRef.current = null
      }
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current)
    }
  }, [pickActive])

  return { active, scrollTo }
}
