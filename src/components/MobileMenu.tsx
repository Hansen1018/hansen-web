'use client'

import { useEffect, useState } from 'react'
import { navSections } from '@/data/profile'

interface MobileMenuProps {
  active: string
  onJump: (id: string) => void
}

/**
 * MobileMenu — mobile hamburger menu + drawer + backdrop.
 * Uses CSS class toggling instead of Vue's <Transition>, with matching effects.
 * body scroll lock: overflow:hidden when open, restored on close/unmount.
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
