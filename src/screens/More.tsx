import { money } from '../lib/format'
import { useMe, useTransactions, useDeleteTransaction } from '../lib/queries'
import { SkeletonBlock, ErrorState, EmptyState } from '../components/States'
import { isTelegram, haptic } from '../lib/telegram'

export function More() {
  const me = useMe()
  const { data, isPending, isError, refetch } = useTransactions()
  const del = useDeleteTransaction()

  return (
    <>
      <header className="apphead">
        <div className="mo">Ещё</div>
      </header>

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
                  {t.comment ? ` · ${t.comment}` : ''} · {formatDate(t.date)}
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

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const y = new Date(today.getTime() - 864e5)
  if (sameDay(d, today)) return 'сегодня'
  if (sameDay(d, y)) return 'вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString()
}
