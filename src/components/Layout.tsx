import { Outlet, useNavigate } from 'react-router-dom'
import { TabBar } from './TabBar'
import { haptic } from '../lib/telegram'

/** Оболочка с таб-навигацией и FAB. Используется на основных экранах. */
export function Layout() {
  const navigate = useNavigate()
  return (
    <div className="app-shell">
      <div className="app-body">
        <Outlet />
      </div>
      <button
        className="fab"
        aria-label="Добавить операцию"
        onClick={() => {
          haptic('medium')
          navigate('/add')
        }}
      >
        +
      </button>
      <TabBar />
    </div>
  )
}
