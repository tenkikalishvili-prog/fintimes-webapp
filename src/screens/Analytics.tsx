import { useState } from 'react'
import {
  budgetStatus,
  compact,
  currentMonth,
  fillClass,
  money,
  monthTitle,
  shiftMonth,
} from '../lib/format'
import { useAnalytics, useBudgetOverview, useOverview } from '../lib/queries'
import { haptic } from '../lib/telegram'
import { SkeletonBlock, ErrorState, EmptyState } from '../components/States'
import type { Article, AnalyticsSlice, BudgetGroupView, Overview } from '../types'

const PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)']

export function Analytics() {
  const [month, setMonth] = useState(currentMonth())
  const [article, setArticle] = useState<Article>('expense')
  const cur = currentMonth()

  const overview = useOverview(month)
  const analytics = useAnalytics(month, article)
  const budget = useBudgetOverview(month, 'expense')

  const switchArticle = (a: Article) => {
    if (a === article) return
    haptic('light')
    setArticle(a)
  }

  return (
    <>
      <header className="apphead">
        <div className="mo">Аналитика</div>
      </header>

      {/* ① Период */}
      <div className="hist-period">
        <button className="hp-nav" onClick={() => { haptic('light'); setMonth(shiftMonth(month, -1)) }} aria-label="Раньше">
          ‹
        </button>
        <span className="hp-lbl">{monthTitle(month)}</span>
        <button
          className="hp-nav"
          disabled={month >= cur}
          onClick={() => { haptic('light'); setMonth(shiftMonth(month, 1)) }}
          aria-label="Позже"
        >
          ›
        </button>
      </div>

      {/* ② Сводка месяца */}
      {overview.data ? <SummaryRow o={overview.data} /> : <SkeletonBlock rows={1} />}

      {/* ③ Структура: тумблер + donut + drill-down */}
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={`s${article === 'expense' ? ' on' : ''}`} onClick={() => switchArticle('expense')}>
          Расходы
        </button>
        <button className={`s${article === 'income' ? ' on' : ''}`} onClick={() => switchArticle('income')}>
          Доходы
        </button>
      </div>

      {analytics.isPending ? (
        <SkeletonBlock rows={4} />
      ) : analytics.isError ? (
        <ErrorState onRetry={analytics.refetch} />
      ) : analytics.data.slices.length === 0 ? (
        <div className="block">
          <EmptyState
            emoji={article === 'expense' ? '📊' : '💰'}
            title={article === 'expense' ? 'Нет расходов за месяц' : 'Нет доходов за месяц'}
            sub="Добавь операции — здесь появится структура"
          />
        </div>
      ) : (
        <StructureBlock total={analytics.data.total} slices={analytics.data.slices} article={article} />
      )}

      {/* ④ План vs факт (расходы) */}
      {budget.data && <BudgetVsFact groups={budget.data} />}
    </>
  )
}

function SummaryRow({ o }: { o: Overview }) {
  const diff = o.income - o.expense
  return (
    <div className="block">
      <div className="an-kpi">
        <div className="cell">
          <div className="k">Доход</div>
          <div className="v">{compact(o.income)}</div>
        </div>
        <div className="cell">
          <div className="k">Расход</div>
          <div className="v">{compact(o.expense)}</div>
        </div>
        <div className="cell">
          <div className="k">{diff >= 0 ? 'Сэкономлено' : 'Перерасход'}</div>
          <div className={`v ${diff >= 0 ? 'pos' : 'neg'}`}>
            {diff >= 0 ? '' : '−'}{compact(Math.abs(diff))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StructureBlock({
  total,
  slices,
  article,
}: {
  total: number
  slices: AnalyticsSlice[]
  article: Article
}) {
  const [open, setOpen] = useState<string | null>(null)

  let acc = 0
  const stops = slices
    .map((s, i) => {
      const from = total > 0 ? (acc / total) * 100 : 0
      acc += s.value
      const to = total > 0 ? (acc / total) * 100 : 0
      return `${PALETTE[i % PALETTE.length]} ${from}% ${to}%`
    })
    .join(',')

  const toggle = (name: string, hasSubs: boolean) => {
    if (!hasSubs) return
    haptic('light')
    setOpen((cur) => (cur === name ? null : name))
  }

  return (
    <div className="block">
      <h3 style={{ marginBottom: 4 }}>{article === 'expense' ? 'Расходы за месяц' : 'Доходы за месяц'}</h3>
      <div className="an-total">{money(total)}</div>
      <div className="donut-wrap" style={{ marginTop: 12 }}>
        <div className="donut" style={{ background: `conic-gradient(${stops})` }}>
          <div className="tot">
            <b>{compact(total)}</b>
            <s>{article === 'expense' ? 'расход' : 'доход'}</s>
          </div>
        </div>
        <div className="lg">
          {slices.map((s, i) => {
            const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
            const hasSubs = s.subcategories.length > 1
            const isOpen = open === s.name
            return (
              <div key={s.name}>
                <div className={`li${hasSubs ? ' tap' : ''}`} onClick={() => toggle(s.name, hasSubs)}>
                  <span className="dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="nm">{s.emoji ? `${s.emoji} ` : ''}{s.name}</span>
                  <span className="val">{compact(s.value)} · {pct}%</span>
                  {hasSubs && <span className={`caret${isOpen ? ' open' : ''}`}>▶</span>}
                </div>
                {isOpen && (
                  <div className="an-sub">
                    {s.subcategories.map((sub) => {
                      const sp = total > 0 ? Math.round((sub.value / total) * 100) : 0
                      return (
                        <div className="li" key={sub.name}>
                          <span className="nm">{sub.emoji ? `${sub.emoji} ` : ''}{sub.name}</span>
                          <span className="val">{compact(sub.value)} · {sp}%</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function BudgetVsFact({ groups }: { groups: BudgetGroupView[] }) {
  const withLimit = groups.filter((g) => g.limit > 0)
  if (withLimit.length === 0) return null

  return (
    <div className="block">
      <h3>План и факт <span>расходы</span></h3>
      {withLimit.map((g) => {
        const st = budgetStatus(g.spent, g.limit)
        const pct = Math.min(100, Math.round((g.spent / g.limit) * 100))
        const over = g.spent > g.limit
        return (
          <div className="pf-row" key={g.group}>
            <div className="catrow">
              <span className="ic">{g.emoji}</span>
              <span className="nm">{g.group}</span>
              <span className={`am${over ? ' over' : ''}`}>
                <b>{compact(g.spent)}</b> / {compact(g.limit)}
              </span>
            </div>
            <div className="bar">
              <i className={fillClass[st]} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
