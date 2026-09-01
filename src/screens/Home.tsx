import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserName, haptic } from '../lib/telegram'
import { compact, money, budgetStatus, fillClass, formatTxDate } from '../lib/format'
import { useMe, useOverview, useTransactions, useDeleteTransaction } from '../lib/queries'
import { SkeletonBlock, ErrorState, EmptyState } from '../components/States'
import type { Article } from '../types'

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

function monthTitle(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

const RECENT_LIMIT = 6
const CURRENCY_SIGN: Record<string, string> = { RUB: '₽', USD: '$', EUR: '€', GEL: '₾' }

type Filter = 'all' | Article

export function Home() {
  const navigate = useNavigate()
  const me = useMe()
  const { data, isPending, isError, refetch } = useOverview()
  const tx = useTransactions()
  const del = useDeleteTransaction()
  const [filter, setFilter] = useState<Filter>('all')
  const name = me.data?.name?.split(' ')[0] || getUserName()
  const sign = CURRENCY_SIGN[me.data?.currency ?? 'RUB'] ?? '₽'

  const shown = (tx.data ?? [])
    .filter((t) => (filter === 'all' ? true : t.article === filter))
    .slice(0, RECENT_LIMIT)

  return (
    <>
      <header className="apphead">
        <div>
          <div className="hi">Привет, {name} 👋</div>
          <div className="mo">{data ? monthTitle(data.month) : ' '}</div>
        </div>
        <div className="avatar">{name[0]?.toUpperCase() ?? 'Т'}</div>
      </header>

      {isPending ? (
        <>
          <div className="hero">
            <div className="lbl">Можно потратить сегодня</div>
            <div className="sk sk-line" style={{ width: 150, height: 38, marginTop: 8, background: 'rgba(26,22,38,.12)' }} />
          </div>
          <SkeletonBlock rows={3} />
        </>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <>
          {/* Жёлтая карточка-баланс (сигнатура UNFIN) */}
          <div className="hero">
            <span className="flag"><i>{sign}</i> {me.data?.currency === 'RUB' || !me.data ? 'Рубли' : me.data.currency}</span>
            <div className="lbl">Можно потратить сегодня</div>
            <div className="big">
              {Math.round(data.dailyLimit).toLocaleString('ru-RU').replace(/,/g, ' ')} <small>{sign}</small>
            </div>
            {data.hasBudget ? (
              <div className="brow">
                <span><span className="k">Остаток месяца</span><br /><b>{compact(data.remaining)} {sign}</b></span>
                <span style={{ textAlign: 'right' }}><span className="k">Дней</span><br /><b>{data.daysLeft}</b></span>
              </div>
            ) : (
              <div className="meta">Задай бюджет «Траты», чтобы видеть дневной лимит</div>
            )}
          </div>

          {/* Быстрые действия */}
          <div className="qa">
            <button className="qi" onClick={() => { haptic('light'); navigate('/add') }}>
              <span className="qic">＋</span>Добавить
            </button>
            <button className="qi" onClick={() => { haptic('light'); navigate('/analytics') }}>
              <span className="qic">◔</span>Аналитика
            </button>
            <button className="qi" onClick={() => { haptic('light'); navigate('/budget') }}>
              <span className="qic">▤</span>Бюджет
            </button>
            <button className="qi" onClick={() => { haptic('light'); navigate('/more') }}>
              <span className="qic">☰</span>Ещё
            </button>
          </div>

          {(me.data?.plannedIncome || me.data?.plannedSpending) && (
            <div className="promo">
              <span className="pe">🎯</span>
              <span>
                План на месяц:
                {me.data?.plannedIncome ? <> доход <b>{compact(me.data.plannedIncome)} {sign}</b></> : null}
                {me.data?.plannedIncome && me.data?.plannedSpending ? ' ·' : ''}
                {me.data?.plannedSpending ? <> траты <b>{compact(me.data.plannedSpending)} {sign}</b></> : null}
              </span>
            </div>
          )}

          <div className="block">
            <h3>Топ трат <span>потрачено / бюджет</span></h3>
            {data.topSpend.length === 0 ? (
              <EmptyState emoji="🧾" title="Пока нет трат" sub="Добавь операцию по кнопке ＋" />
            ) : (
              data.topSpend.map((line) => {
                const st = budgetStatus(line.spent, line.limit)
                const pct = line.limit > 0 ? Math.min(100, Math.round((line.spent / line.limit) * 100)) : 0
                return (
                  <div key={line.subcategoryId}>
                    <div className="catrow">
                      <span className="ic">{line.emoji}</span>
                      <span className="nm">{line.name}</span>
                      <span className="am"><b>{compact(line.spent)}</b> / {compact(line.limit)}</span>
                    </div>
                    <div className="bar">
                      <i className={fillClass[st]} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="block">
            <h3>
              Операции
              <button className="seeall" onClick={() => { haptic('light'); navigate('/history') }}>
                Все →
              </button>
            </h3>
            <div className="pills">
              <button className={`pill${filter === 'all' ? ' on' : ''}`} onClick={() => { haptic('light'); setFilter('all') }}>Все</button>
              <button className={`pill${filter === 'expense' ? ' on' : ''}`} onClick={() => { haptic('light'); setFilter('expense') }}>Расход</button>
              <button className={`pill${filter === 'income' ? ' on' : ''}`} onClick={() => { haptic('light'); setFilter('income') }}>Доход</button>
            </div>
            {tx.isPending ? (
              <SkeletonBlock rows={3} />
            ) : tx.isError ? (
              <ErrorState onRetry={tx.refetch} />
            ) : shown.length === 0 ? (
              <EmptyState emoji="🗒️" title="Пока нет операций" sub="Добавь первую по кнопке ＋ или через бота" />
            ) : (
              shown.map((t) => (
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
        </>
      )}
    </>
  )
}
