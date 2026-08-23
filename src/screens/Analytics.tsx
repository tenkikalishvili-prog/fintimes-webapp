import { compact } from '../lib/format'
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
      <div className="donut-wrap">
        <div className="donut" style={{ background: `conic-gradient(${stops})` }}>
          <div className="tot">
            <b>{compact(total)} ₽</b>
            <s>расходы</s>
          </div>
        </div>
        <div className="lg">
          {slices.map((s, i) => (
            <div className="li" key={s.name}>
              <span className="dot" style={{ background: PALETTE[i % PALETTE.length] }} />
              {s.name} {compact(s.value)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
