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
import {
  useAnalytics,
  useBudgetOverview,
  useCashflowPlan,
  useOverview,
  useUpdateBill,
  useUpdateDebt,
} from '../lib/queries'
import { haptic } from '../lib/telegram'
import { SkeletonBlock, ErrorState, EmptyState } from '../components/States'
import { OverdueBlock } from '../components/OverdueBlock'
import type {
  Article,
  AnalyticsSlice,
  BudgetGroupView,
  CashflowItem,
  CashflowSegment,
  Overview,
} from '../types'

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

      {/* ① Единый степпер месяца — управляет всем экраном (календарь + сводка + структура) */}
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

      {/* ② Сводка месяца: деньги (доход/расход/остаток) · долги · свободно за месяц */}
      {overview.data ? <MonthSummary o={overview.data} /> : <SkeletonBlock rows={3} />}

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

      {/* ⓪ Платёжный календарь — перенесён под структуру трат (донат) */}
      <CashflowPlanBlock month={month} />

      {/* ④ План vs факт (расходы) */}
      {budget.data && <BudgetVsFact groups={budget.data} />}
    </>
  )
}

// ── Платёжный календарь V2 (S16.1): две плитки-половины месяца ─────────────
function CashflowPlanBlock({ month }: { month: string }) {
  const plan = useCashflowPlan(month)

  return (
    <div className="cfv-wrap">
      {plan.isPending ? (
        <SkeletonBlock rows={2} />
      ) : plan.isError ? (
        <div className="block"><ErrorState onRetry={plan.refetch} /></div>
      ) : (
        <>
          <OverdueBlock items={plan.data.overdue} />
          {plan.data.segments.map((seg) => <CashflowTile key={seg.index} seg={seg} />)}
        </>
      )}
    </div>
  )
}

function CashflowTile({ seg }: { seg: CashflowSegment }) {
  // Обе плитки свёрнуты по умолчанию — раскрываются по тапу.
  const [open, setOpen] = useState(false)
  const restPos = seg.coverage >= 0
  const emptyBoth = seg.incomes.length === 0 && seg.items.length === 0
  // Прогресс оплаты: показываем, только когда что-то уже оплачено в половине.
  const paid = seg.paidAmount
  const leftToPay = Math.max(0, seg.obligations - paid)
  const showProgress = paid > 0
  const allPaid = paid > 0 && leftToPay === 0

  return (
    <div className={`cfv-tile${open ? ' open' : ''}`}>
      <button className="cfv-top" onClick={() => { haptic('light'); setOpen(!open) }}>
        <div className="cfv-h">
          <span className="cfv-ic">{seg.index === 1 ? '💸' : '📆'}</span>
          <span className="cfv-tt">
            <b>{seg.label}</b>
            <small>{seg.index === 1 ? '1–15 числа' : 'с 16 числа'}</small>
          </span>
          <span className="cfv-chev">▾</span>
        </div>
        <div className="cfv-kpis">
          <div className="cfv-kpi">
            <div className="cfv-k">Придёт</div>
            <div className="cfv-v inc">{compact(seg.expectedIncome)}</div>
          </div>
          <div className="cfv-kpi">
            <div className="cfv-k">К оплате</div>
            <div className="cfv-v">{compact(seg.obligations)}</div>
          </div>
          <div className={`cfv-kpi rest ${restPos ? 'pos' : 'neg'}`}>
            <div className="cfv-k">Останется</div>
            <div className="cfv-v">{restPos ? '' : '−'}{compact(Math.abs(seg.coverage))}</div>
          </div>
        </div>
      </button>

      <div className="cfv-status">
        <span className={`cfv-pill ${restPos ? 'ok' : 'over'}`}>
          {restPos ? '✓ хватает' : `не хватает ${compact(Math.abs(seg.coverage))}`}
        </span>
        {showProgress && (
          <span className={`cfv-prog${allPaid ? ' done' : ''}`}>
            {allPaid
              ? `✓ оплачено ${compact(paid)}`
              : `оплачено ${compact(paid)} из ${compact(seg.obligations)} · осталось ${compact(leftToPay)}`}
          </span>
        )}
      </div>

      {open && (
        <div className="cfv-body">
          {emptyBoth ? (
            <p className="cfv-empty">Ни доходов, ни платежей в этой половине</p>
          ) : (
            <>
              {seg.incomes.length > 0 && (
                <>
                  <div className="cfv-sec">Поступления</div>
                  <div className="cfv-rows">
                    {seg.incomes.map((i, idx) => (
                      <div className="cfv-row inc" key={`inc-${idx}`}>
                        <span className="cfv-em">{i.emoji ?? '💰'}</span>
                        <span className="cfv-nm"><b>{i.name}</b><small>{i.day} числа</small></span>
                        <span className="cfv-amt">+{money(i.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="cfv-sec">К оплате</div>
              {seg.items.length === 0 ? (
                <p className="cfv-empty">Платежей нет</p>
              ) : (
                <div className="cfv-rows">
                  {seg.items.map((it) => (
                    <CashflowRow
                      key={`${it.kind}-${it.id}`}
                      item={it}
                      toSegment={seg.index === 1 ? 2 : 1}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function CashflowRow({ item, toSegment }: { item: CashflowItem; toSegment: number }) {
  const [armed, setArmed] = useState(false)
  const updateBill = useUpdateBill()
  const updateDebt = useUpdateDebt()
  const pending = updateBill.isPending || updateDebt.isPending

  const move = async () => {
    if (!armed) { setArmed(true); haptic('light'); return }
    try {
      if (item.kind === 'bill') {
        await updateBill.mutateAsync({ id: item.id, body: { segmentOverride: toSegment } })
      } else {
        await updateDebt.mutateAsync({ id: item.id, body: { segmentOverride: toSegment } })
      }
      haptic('medium')
    } catch {
      setArmed(false)
    }
  }

  return (
    <div className={`cfv-row${item.paid ? ' paid' : ''}`}>
      <span className="cfv-em">{item.emoji ?? (item.kind === 'debt' ? '🤝' : '📄')}</span>
      <span className="cfv-nm">
        <span className="cfv-nm-h">
          {item.overdue && <span className="cfv-od" aria-label="Просрочен" title="Просрочен">⚠️</span>}
          <b>
            {item.title}
            {item.overridden && !item.overdue && !item.paid && <span className="cfv-badge">перенесён</span>}
          </b>
        </span>
        <small>
          {item.paid
            ? `до ${item.day} числа · ${item.kind === 'debt' ? 'возвращён' : 'оплачено'}`
            : item.kind === 'debt' && item.paidAmount > 0
              ? `возвращено ${money(item.paidAmount)} из ${money(item.amount)}`
              : item.overdue && item.originLabel ? item.originLabel : `до ${item.day} числа`}
        </small>
      </span>
      <span className="cfv-amt">{money(item.amount)}</span>
      {item.paid ? (
        <span className="cfv-check" aria-label="Оплачено" title="Оплачено">✓</span>
      ) : (
      <button
        className={`cfv-mv${armed ? ' armed' : ''}`}
        disabled={pending}
        onClick={move}
        aria-label="Перенести в другую половину"
      >
        {armed ? (toSegment === 2 ? 'во 2-ю?' : 'в 1-ю?') : '⇄'}
      </button>
      )}
    </div>
  )
}

function MonthSummary({ o }: { o: Overview }) {
  // Три отдельные сущности, не смешиваем:
  //   «Остаток» = Доход − Расход (чистый: только заработок и траты по категориям).
  //   «Долги»   = движение по долгам за месяц (без целей) + накопительная позиция.
  //   «Свободно за месяц» = остаток − то, что долги забрали (вернул + дал − вернули мне).
  //     Заём НЕ считается доходом, поэтому не добавляет свободных денег (см. бэк: free).
  const rest = o.income - o.expense
  const debtNet = (o.debtIn ?? 0) - (o.debtOut ?? 0) // движение ДС по долгам (плитка «Долги: итог»)
  const free = o.free // «Свободно за месяц» — источник истины с бэка
  const debtImpact = rest - free // сколько долги забрали из свободного (+ забрали, − добавили)
  const showDebts =
    (o.debtIn ?? 0) > 0 || (o.debtOut ?? 0) > 0 || (o.debtIOwe ?? 0) > 0 || (o.debtOwedToMe ?? 0) > 0

  return (
    <>
      <div className="an-seclabel">Деньги за месяц</div>
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
          <div className="cell accent">
            <div className="k">Остаток</div>
            <div className={`v ${rest >= 0 ? 'pos' : 'neg'}`}>
              {rest >= 0 ? '' : '−'}{compact(Math.abs(rest))}
            </div>
          </div>
        </div>
      </div>

      {showDebts && <DebtBlock o={o} net={debtNet} />}

      <div className="an-seclabel">Итог</div>
      <div className="an-free">
        <div className="lbl">Свободно за месяц</div>
        <div className={`big ${free >= 0 ? '' : 'neg'}`}>
          {free >= 0 ? '' : '−'}{compact(Math.abs(free))} <span className="cur">₽</span>
        </div>
        <div className="exp">
          остаток {compact(rest)}{' '}
          <span className="op">{debtImpact >= 0 ? '−' : '+'}</span> долги {compact(Math.abs(debtImpact))}
        </div>
      </div>
    </>
  )
}

function DebtBlock({ o, net }: { o: Overview; net: number }) {
  const [open, setOpen] = useState(false)
  const cashIn = o.debtIn ?? 0
  const cashOut = o.debtOut ?? 0
  const iOwe = o.debtIOwe ?? 0
  const owed = o.debtOwedToMe ?? 0
  // Подписи плиток движения адаптивны: если в притоке/оттоке ровно один смысл —
  // называем его глаголом (Занял / Вернул / …); если оба — обобщаем (Пришло / Ушло).
  const borrowed = o.debtBorrowed ?? 0 // занял
  const returned = o.debtReturned ?? 0 // вернули мне
  const repaid = o.debtRepaid ?? 0 // вернул свой долг
  const lent = o.debtLent ?? 0 // дал в долг
  const inLabel = borrowed > 0 && returned > 0 ? 'Пришло' : returned > 0 ? 'Вернули мне' : 'Занял'
  const inDet = borrowed > 0 && returned > 0 ? 'занял · вернули мне' : returned > 0 ? 'вернули мне' : 'взял в долг'
  const outLabel = repaid > 0 && lent > 0 ? 'Ушло' : lent > 0 ? 'Дал в долг' : 'Вернул'
  const outDet = repaid > 0 && lent > 0 ? 'вернул · дал в долг' : lent > 0 ? 'дал в долг' : 'отдал долг'
  const hasPosition = iOwe > 0 || owed > 0
  const netSign = net > 0 ? '+' : net < 0 ? '−' : ''
  const netCls = net > 0 ? 'plus' : net < 0 ? 'minus' : 'zero'

  return (
    <>
      <div className="an-seclabel">Долги <span className="sub">· не доход и не расход</span></div>
      <div className="an-dmini">
        <div className="cell">
          <div className="k"><span className="ar">↓</span> {inLabel}</div>
          <div className="v">{compact(cashIn)}</div>
          <div className="det">{inDet}</div>
        </div>
        <div className="cell">
          <div className="k"><span className="ar out">↑</span> {outLabel}</div>
          <div className="v out">{compact(cashOut)}</div>
          <div className="det">{outDet}</div>
        </div>
      </div>
      <div className={`an-dfold${open ? ' open' : ''}`}>
        <button className="an-dfold-head" onClick={() => { haptic('light'); setOpen(!open) }}>
          <span className="lead">
            Долги: итог <span className={`amt ${netCls}`}>{netSign}{compact(Math.abs(net))}</span>
          </span>
          <span className="tail">
            <span className="hint">позиция</span>
            <span className="chev">▾</span>
          </span>
        </button>
        {open && (
          <div className="an-dfold-body">
            <div className="ttl">Долговая позиция · всего</div>
            {hasPosition ? (
              <div className="an-pos">
                <div className="cell owe">
                  <div className="k">Я должен</div>
                  <div className="v">{compact(iOwe)}</div>
                </div>
                <div className="cell owed">
                  <div className="k">Мне должны</div>
                  <div className="v">{compact(owed)}</div>
                </div>
              </div>
            ) : (
              <div className="an-pos-clean">✓ Открытых долгов нет</div>
            )}
          </div>
        )}
      </div>
    </>
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

  const sliceColor = (i: number) => PALETTE[i % PALETTE.length]

  let acc = 0
  const stops = slices
    .map((s, i) => {
      const from = total > 0 ? (acc / total) * 100 : 0
      acc += s.value
      const to = total > 0 ? (acc / total) * 100 : 0
      return `${sliceColor(i)} ${from}% ${to}%`
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
                  <span className="dot" style={{ background: sliceColor(i) }} />
                  <span className="nm">
                    {s.emoji ? `${s.emoji} ` : ''}{s.name}
                  </span>
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
