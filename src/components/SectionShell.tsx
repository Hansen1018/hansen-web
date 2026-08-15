'use client'

import { useEffect, useRef, useState } from 'react'

interface SectionShellProps {
  id: string
  index?: string
  eyebrow?: string
  title: string
  children: React.ReactNode
}

/**
 * SectionShell — 通用 section 容器：head + 双向 fade in/out。
 * 1:1 移植自 Vue 版，移除 transform 位移 + 150ms 节流 + rAF 兜底，
 * 杜绝「滚动到顶部时精选项目卡片快速抖动」。
 */
export default function SectionShell({ id, index, eyebrow, title, children }: SectionShellProps) {
  const rootRef = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    // 初始检查：已可见就直接显示
    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight * 0.85 && rect.bottom > 0) {
      setVisible(true)
    }

    let timerId: ReturnType<typeof setTimeout> | null = null
    let rafId: number | null = null

    const apply = (value: boolean) => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => setVisible(value))
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0].isIntersecting
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
      ref={rootRef}
      id={id}
      className={`section${visible ? ' is-visible' : ''}`}
    >
      <header className="section__head">
        <div className="section__meta">
          {index && <span className="section__index">{index}</span>}
          {eyebrow && <span className="section__eyebrow">{eyebrow}</span>}
        </div>
        <h2 className="section__title">{title}</h2>
        <div className="section__rule" aria-hidden="true"></div>
      </header>
      <div className="section__body">{children}</div>
    </section>
  )
}
