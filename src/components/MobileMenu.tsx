'use client'

import { useEffect, useState } from 'react'
import { navSections } from '@/data/profile'

interface MobileMenuProps {
  active: string
  onJump: (id: string) => void
}

/**
 * MobileMenu — 移动端汉堡菜单 + 抽屉 + 遮罩。
 * 用 CSS class 切换代替 Vue 的 <Transition>，效果一致。
 * body 滚动锁：open 时 overflow:hidden，close/卸载时还原。
 */
export default function MobileMenu({ active, onJump }: MobileMenuProps) {
  const [open, setOpen] = useState(false)

  const openMenu = () => {
    setOpen(true)
    document.body.style.overflow = 'hidden'
  }
  const closeMenu = () => {
    setOpen(false)
    document.body.style.overflow = ''
  }
  const toggle = () => (open ? closeMenu() : openMenu())
  const jump = (id: string) => {
    closeMenu()
    onJump(id)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) closeMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <>
      <button
        type="button"
        className="m-menu-btn"
        aria-expanded={open}
        aria-controls="mobile-menu-drawer"
        aria-label="菜单"
        onClick={toggle}
      >
        <span className={`m-menu-icon${open ? ' is-open' : ''}`}>
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      <div
        className={`m-menu-backdrop${open ? ' is-open' : ''}`}
        onClick={closeMenu}
        aria-hidden="true"
      ></div>

      <nav
        id="mobile-menu-drawer"
        className={`m-menu-drawer${open ? ' is-open' : ''}`}
        aria-label="主导航"
      >
        <ul className="m-menu-list">
          {navSections.map((s) => {
            const isActive = active === s.id
            return (
              <li key={s.id} className={`m-menu-item${isActive ? ' is-active' : ''}`}>
                <button
                  type="button"
                  className="m-menu-link"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => jump(s.id)}
                >
                  <span className="m-menu-dot" aria-hidden="true"></span>
                  <span className="m-menu-label">{s.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
