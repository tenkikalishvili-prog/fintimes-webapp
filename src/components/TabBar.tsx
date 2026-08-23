import { NavLink } from 'react-router-dom'
import { haptic } from '../lib/telegram'

const TABS = [
  { to: '/', icon: '🏠', label: 'Главная', end: true },
  { to: '/analytics', icon: '📊', label: 'Аналитика', end: false },
  { to: '/budget', icon: '🎯', label: 'Бюджет', end: false },
  { to: '/more', icon: '⚙️', label: 'Ещё', end: false },
]

export function TabBar() {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          onClick={() => haptic('light')}
          className={({ isActive }) => `t${isActive ? ' on' : ''}`}
        >
          <span className="i">{t.icon}</span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
