'use client'

import { useEffect, useRef, useState } from 'react'
import { navSections } from '@/data/profile'

interface MobileMenuProps {
  active: string
  onJump: (id: string) => void
}

/**
 * MobileMenu — mobile hamburger menu + drawer + backdrop.
 * Body scroll lock uses overflow:hidden when open, restored to its prior value on
 * close/unmount (preserves any other component's scroll lock).
 * Focus moves to the first drawer link on open and back to the trigger on close.
 */
export default function MobileMenu({ active, onJump }: MobileMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const prevOverflowRef = useRef<string>('')

  // Snapshot the initial body.overflow on mount so we never clobber it.
  useEffect(() => {
    prevOverflowRef.current = document.body.style.overflow
    return () => {
      document.body.style.overflow = prevOverflowRef.current
    }
  }, [])

  const openMenu = () => {
    if (open) return
    setOpen(true)
    document.body.style.overflow = 'hidden'
    // Move focus to the first drawer link after the drawer renders.
    requestAnimationFrame(() => {
      const firstLink = drawerRef.current?.querySelector<HTMLButtonElement>('.m-menu-link')
      firstLink?.focus()
    })
  }
  const closeMenu = () => {
    if (!open) return
    setOpen(false)
    document.body.style.overflow = prevOverflowRef.current
    // Restore focus to the trigger button so keyboard users don't lose their place.
    requestAnimationFrame(() => triggerRef.current?.focus())
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
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
        ref={drawerRef}
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
