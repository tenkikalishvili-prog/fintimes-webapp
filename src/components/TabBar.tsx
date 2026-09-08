import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { haptic } from '../lib/telegram'

// Монохромная шестерёнка в стиле остальных иконок таббара: наследует currentColor,
// значит тускнеет/подсвечивается активным цветом так же, как глифы ◉ ◔ ▤.
const GearIcon = (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true" style={{ display: 'block' }}>
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
  </svg>
)

// UNFIN: 4 вкладки + скрытый центральный слот под плавающую «＋» (её рисует Layout).
const TABS: { to: string; icon: ReactNode; label: string; end: boolean }[] = [
  { to: '/', icon: '◉', label: 'Главная', end: true },
  { to: '/analytics', icon: '◔', label: 'Аналитика', end: false },
  { to: '/budget', icon: '▤', label: 'Бюджет', end: false },
  { to: '/settings', icon: GearIcon, label: 'Настройки', end: false },
]

export function TabBar() {
  return (
    <nav className="tabbar">
      <TabLink tab={TABS[0]} />
      <TabLink tab={TABS[1]} />
      <span className="t slot" aria-hidden="true">
        <span className="i">＋</span>·
      </span>
      <TabLink tab={TABS[2]} />
      <TabLink tab={TABS[3]} />
    </nav>
  )
}

function TabLink({ tab }: { tab: (typeof TABS)[number] }) {
  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      onClick={() => haptic('light')}
      className={({ isActive }) => `t${isActive ? ' on' : ''}`}
    >
      <span className="i">{tab.icon}</span>
      {tab.label}
    </NavLink>
  )
}
