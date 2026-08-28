'use client'

import { useEffect, useRef, useState } from 'react'

interface SectionShellProps {
  id: string
  index: string
  eyebrow: string
  title: string
  children: React.ReactNode
}

/**
 * SectionShell — shared chrome for every page section: index number, eyebrow
 * label, title, and a thin underline. Mounts an IntersectionObserver to fade
 * the section in once it's within ~85% of the viewport.
 *
 * Visibility is driven by `setVisible(boolean)` via `requestAnimationFrame`
 * (debounced) so rapid scroll doesn't spam React updates. All rAF/setTimeout
 * handles are tracked and cleaned up on unmount.
 */
export default function SectionShell({ id, index, eyebrow, title, children }: SectionShellProps) {
  const rootRef = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    let rafId: number | null = null
    let timerId: ReturnType<typeof setTimeout> | null = null

    const apply = (value: boolean) => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => setVisible(value))
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // IntersectionObserver delivers at least one entry by spec, but
        // noUncheckedIndexedAccess makes entries[0] typed as T | undefined.
        const target = entries[0]?.isIntersecting ?? false
        if (timerId) clearTimeout(timerId)
        timerId = setTimeout(() => apply(target), 150)
      },
      { threshold: 0.1, rootMargin: '0px 0px -10% 0px' },
    )
    observer.observe(el)

    return () => {
      if (timerId) clearTimeout(timerId)
      if (rafId !== null) cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [])

  return (
    <section
      id={id}
      ref={rootRef}
      className={`section${visible ? ' is-visible' : ''}`}
    >
      <header className="section__head">
        <div className="section__meta">
          <span className="section__index">{index}</span>
          <span className="section__eyebrow">{eyebrow}</span>
        </div>
        <h2 className="section__title">{title}</h2>
        <span className="section__rule" aria-hidden="true"></span>
      </header>
      <div className="section__body">{children}</div>
    </section>
  )
}
