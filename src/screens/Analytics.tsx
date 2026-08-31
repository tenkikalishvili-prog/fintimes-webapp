import { compact, money } from '../lib/format'
import { useAnalytics } from '../lib/queries'
import { SkeletonBlock, ErrorState, EmptyState } from '../components/States'

const PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)']

export function Analytics() {
  const { data, isPending, isError, refetch } = useAnalytics()

  return (
    <>
      <header className="apphead">
        <div className="mo">Аналитика</div>
      </header>

      {isPending ? (
        <SkeletonBlock rows={4} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : data.slices.length === 0 ? (
        <div className="block">
          <EmptyState emoji="📊" title="Нет расходов за месяц" sub="Добавь операции — здесь появится структура трат" />
        </div>
      ) : (
        <AnalyticsChart total={data.total} slices={data.slices} />
      )}
    </>
  )
}

function AnalyticsChart({
  total,
  slices,
}: {
  total: number
  slices: { name: string; value: number }[]
}) {
  let acc = 0
  const stops = slices
    .map((s, i) => {
      const from = total > 0 ? (acc / total) * 100 : 0
      acc += s.value
      const to = total > 0 ? (acc / total) * 100 : 0
      return `${PALETTE[i % PALETTE.length]} ${from}% ${to}%`
    })
    .join(',')

  return (
    <div className="block">
      <h3 style={{ marginBottom: 4 }}>Расходы за месяц</h3>
      <div className="an-total">{money(total)}</div>
      <div className="donut-wrap" style={{ marginTop: 12 }}>
        <div className="donut" style={{ background: `conic-gradient(${stops})` }}>
          <div className="tot">
            <b>{compact(total)}</b>
            <s>всего</s>
          </div>
        </div>
        <div className="lg">
          {slices.map((s, i) => {
            const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
            return (
              <div className="li" key={s.name}>
                <span className="dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span className="nm">{s.name}</span>
                <span className="val">{compact(s.value)} · {pct}%</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
