import { useNavigate } from 'react-router-dom'
import { useMe } from '../lib/queries'
import { isTelegram, haptic } from '../lib/telegram'

export function More() {
  const navigate = useNavigate()
  const me = useMe()

  return (
    <>
      <header className="apphead">
        <div className="mo">Ещё</div>
      </header>

      <button
        className="field"
        onClick={() => {
          haptic('light')
          navigate('/history')
        }}
        style={{ marginBottom: 12 }}
      >
        <span>🧾 История операций</span>
        <span className="val">Смотреть ›</span>
      </button>

      <button
        className="field"
        onClick={() => {
          haptic('light')
          navigate('/debts')
        }}
        style={{ marginBottom: 12 }}
      >
        <span>🤝 Долги</span>
        <span className="val">Вести ›</span>
      </button>

      <button
        className="field"
        onClick={() => {
          haptic('light')
          navigate('/payments')
        }}
        style={{ marginBottom: 12 }}
      >
        <span>📅 Платежи</span>
        <span className="val">Календарь ›</span>
      </button>

      <button
        className="field"
        onClick={() => {
          haptic('light')
          navigate('/goals')
        }}
        style={{ marginBottom: 12 }}
      >
        <span>🎯 Цели</span>
        <span className="val">Копить ›</span>
      </button>

      <button
        className="field"
        onClick={() => {
          haptic('light')
          navigate('/settings')
        }}
        style={{ marginBottom: 12 }}
      >
        <span>🔔 Уведомления</span>
        <span className="val">Настроить ›</span>
      </button>

      <div className="block muted" style={{ fontSize: 12.5 }}>
        {me.data ? (
          <>
            Пользователь: <b style={{ color: 'var(--text)' }}>{me.data.name}</b> · {me.data.currency}
            <br />
          </>
        ) : null}
        Режим: <b style={{ color: 'var(--text)' }}>{isTelegram ? 'Telegram Mini App' : 'Браузер (dev)'}</b>
        <br />
        Категории, экспорт, светлая тема — появятся здесь.
      </div>
    </>
  )
}
