import { navSections } from '@/data/profile'

interface SideNavProps {
  active: string
  onJump: (id: string) => void
}

/**
 * SideNav — right-side fixed dot navigation. Display only; state managed by NavController.
 */
export default function SideNav({ active, onJump }: SideNavProps) {
  return (
    <nav className="sidenav" aria-label="主导航">
      <ul className="sidenav__list">
        {navSections.map((s) => {
          const isActive = active === s.id
          return (
            <li key={s.id} className={`sidenav__item${isActive ? ' is-active' : ''}`}>
              <button
                type="button"
                className="sidenav__btn"
                aria-current={isActive ? 'true' : undefined}
                aria-label={s.label}
                onClick={() => onJump(s.id)}
              >
                <span className="sidenav__dot"></span>
                <span className="sidenav__label">{s.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
