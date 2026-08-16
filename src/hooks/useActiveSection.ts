'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

/**
 * Scroll-spy: tracks the active state of a set of sections.
 *
 * Algorithm (top-based, 1:1 ported from Vue version composables/useActiveSection.js):
 *   1. Pick the section where "rect.top <= triggerY(0.3*innerHeight) && rect.top is the largest"
 *   2. Last-section fallback: force-pick the last section when it's fully in viewport
 *   3. Top fallback
 *
 * Instant lock (on scrollTo):
 *   During smooth-scroll animation, the IO algorithm picks the wrong section by ratio.
 *   On scrollTo, immediately lock active to the target id; don't recompute during scroll;
 *   Unlock via scrollend event (browser-native), with a 3000ms fallback when scrollend isn't supported.
 *
 * @param ids list of section ids (for DOM lookup)
 * @returns { active, scrollTo }
 */
export function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0] ?? '')
  const lockedIdRef = useRef<string | null>(null)
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    if (lastEl) {
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

      const onScrollEnd = () => {
        window.removeEventListener('scrollend', onScrollEnd)
        unlock()
      }
      window.addEventListener('scrollend', onScrollEnd, { once: true })

      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current)
      unlockTimerRef.current = setTimeout(() => {
        window.removeEventListener('scrollend', onScrollEnd)
        unlock()
      }, 3000)
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
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current)
    }
  }, [pickActive])

  return { active, scrollTo }
}
