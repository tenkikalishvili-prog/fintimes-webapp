import { NavLink } from 'react-router-dom'
import { haptic } from '../lib/telegram'

// UNFIN: 4 вкладки + скрытый центральный слот под плавающую «＋» (её рисует Layout).
const TABS = [
  { to: '/', icon: '◉', label: 'Главная', end: true },
  { to: '/analytics', icon: '◔', label: 'Аналитика', end: false },
  { to: '/budget', icon: '▤', label: 'Бюджет', end: false },
  { to: '/more', icon: '☰', label: 'Ещё', end: false },
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
