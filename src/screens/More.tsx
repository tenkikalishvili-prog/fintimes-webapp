import { useNavigate } from 'react-router-dom'
import { money, formatTxDate } from '../lib/format'
import { useMe, useTransactions, useDeleteTransaction } from '../lib/queries'
import { SkeletonBlock, ErrorState, EmptyState } from '../components/States'
import { isTelegram, haptic } from '../lib/telegram'

export function More() {
  const navigate = useNavigate()
  const me = useMe()
  const { data, isPending, isError, refetch } = useTransactions()
  const del = useDeleteTransaction()

  return (
    <>
      <header className="apphead">
        <div className="mo">Ещё</div>
      </header>

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

      <div className="block">
        <h3>Последние операции</h3>
        {isPending ? (
          <SkeletonBlock rows={4} />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : data.length === 0 ? (
          <EmptyState emoji="🗒️" title="Пока нет операций" sub="Добавь первую по кнопке ➕ или через бота" />
        ) : (
          data.map((t) => (
            <div className="txrow" key={t.id}>
              <div className="tic">{t.emoji ?? '💸'}</div>
              <div className="tmid">
                <div className="tname">{t.subcategoryName}</div>
                <div className="tmeta">
                  {t.categoryName}
                  {t.comment ? ` · ${t.comment}` : ''} · {formatTxDate(t.date)}
                </div>
              </div>
              <div className={`tamt${t.article === 'income' ? ' plus' : ''}`}>
                {t.article === 'income' ? '+' : '−'}
                {money(t.amount).replace('−', '')}
              </div>
              <button
                className="tx-del"
                aria-label="Удалить"
                onClick={() => {
                  haptic('medium')
                  if (confirm(`Удалить «${t.subcategoryName} ${money(t.amount)}»?`)) del.mutate(t.id)
                }}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

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
