import { getUserName } from '../lib/telegram'
import { compact, budgetStatus, fillClass } from '../lib/format'
import { useMe, useOverview } from '../lib/queries'
import { SkeletonBlock, ErrorState, EmptyState } from '../components/States'

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

function monthTitle(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

export function Home() {
  const me = useMe()
  const { data, isPending, isError, refetch } = useOverview()
  const name = me.data?.name?.split(' ')[0] || getUserName()

  return (
    <>
      <header className="apphead">
        <div>
          <div className="hi">Привет, {name} 👋</div>
          <div className="mo">{data ? monthTitle(data.month) : ' '}</div>
        </div>
        <div className="avatar">{name[0]?.toUpperCase() ?? 'Т'}</div>
      </header>

      {isPending ? (
        <>
          <div className="hero">
            <div className="lbl">Можно потратить сегодня</div>
            <div className="sk sk-line" style={{ width: 140, height: 34, marginTop: 6 }} />
          </div>
          <SkeletonBlock rows={3} />
        </>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <>
          <div className="hero">
            <div className="lbl">Можно потратить сегодня</div>
            <div className="big">
              {Math.round(data.dailyLimit).toLocaleString('ru-RU').replace(/,/g, ' ')} <small>₽</small>
            </div>
            <div className="meta">
              {data.hasBudget
                ? `До конца месяца · ${data.daysLeft} дн. · по плану`
                : 'Задай бюджет «Траты», чтобы видеть лимит'}
            </div>
          </div>

          <div className="row3">
            <div className="mini">
              <div className="k">Доход</div>
              <div className="v g">{compact(data.income)}</div>
            </div>
            <div className="mini">
              <div className="k">Расход</div>
              <div className="v">{compact(data.expense)}</div>
            </div>
            <div className="mini">
              <div className="k">Осталось</div>
              <div className={`v ${data.remaining < 0 ? 'r' : 'a'}`}>{compact(data.remaining)}</div>
            </div>
          </div>

          {(me.data?.plannedIncome || me.data?.plannedSpending) && (
            <div className="plan-note">
              💡 План на месяц:
              {me.data?.plannedIncome ? ` доход ${compact(me.data.plannedIncome)} ₽` : ''}
              {me.data?.plannedIncome && me.data?.plannedSpending ? ' ·' : ''}
              {me.data?.plannedSpending ? ` траты ${compact(me.data.plannedSpending)} ₽` : ''}
            </div>
          )}

          <div className="block">
            <h3>
              Топ трат <span>потрачено / бюджет</span>
            </h3>
            {data.topSpend.length === 0 ? (
              <EmptyState emoji="🧾" title="Пока нет трат" sub="Добавь операцию по кнопке ➕" />
            ) : (
              data.topSpend.map((line) => {
                const st = budgetStatus(line.spent, line.limit)
                const pct = line.limit > 0 ? Math.min(100, Math.round((line.spent / line.limit) * 100)) : 0
                return (
                  <div key={line.subcategoryId}>
                    <div className="catrow">
                      <span className="ic">{line.emoji}</span>
                      <span className="nm">{line.name}</span>
                      <span className="am">
                        {compact(line.spent)} / {compact(line.limit)}
                      </span>
                    </div>
                    <div className="bar">
                      <i className={fillClass[st]} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </>
  )
}
