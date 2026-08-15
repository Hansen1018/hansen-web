'use client'

import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

/**
 * ThemeToggle — 右上角悬浮按钮，切换 data-theme 并写 localStorage。
 * 默认渲染 Sun 图标（假设深色），所以 SSR / 首次 paint 也有图标可见。
 * 客户端 mount 后从 data-theme 读实际值再校正。
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute('data-theme') as Theme | null) || 'dark'
    setTheme(current)
    setMounted(true)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('theme', next)
    } catch {}
  }

  // mount 后：dark → 显示 Sun（点击去浅色）；light → 显示 Moon（点击回深色）
  // mount 前：始终 Sun（首次访问默认深色）
  const isDark = !mounted || theme === 'dark'
  const label = !mounted
    ? '主题切换'
    : theme === 'dark'
      ? '切换到浅色模式'
      : '切换到深色模式'

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      <span className="theme-toggle__icon" aria-hidden="true" suppressHydrationWarning>
        {isDark ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  )
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
