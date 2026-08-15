'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

/**
 * Scroll-spy: 追踪一组 section 的激活态。
 *
 * 算法（top-based，1:1 移植自 Vue 版 composables/useActiveSection.js）：
 *   1. 选「rect.top <= triggerY(0.3*innerHeight) && rect.top 最大」的 section
 *   2. 末尾节兜底：最后一节完整在视口里时强制选它
 *   3. 顶部兜底
 *
 * 即时锁（scrollTo 时）：
 *   smooth-scroll 动画期间 IO 算法会按 ratio 选错节。
 *   scrollTo 时立即锁 active 到目标 id，scroll 期间不重算；
 *   用 scrollend 事件解锁（浏览器原生），无 scrollend 支持时用 3000ms 兜底。
 *
 * @param ids section id 列表（DOM 查找用）
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
