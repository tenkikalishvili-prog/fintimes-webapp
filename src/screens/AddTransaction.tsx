import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CategoryGroup, DebtDirection, Subcategory } from '../types'
import { ARTICLE_LABELS } from '../types'
import {
  useAddDebtPayment,
  useAddGoalContribution,
  useCategories,
  useCreateDebt,
  useCreateTransaction,
  useDebts,
  useGoals,
  useSmartParse,
} from '../lib/queries'
import { SkeletonBlock, ErrorState, EmptyState } from '../components/States'
import { haptic } from '../lib/telegram'
import { money, compact } from '../lib/format'

/** Тип операции в окне «+»: обычные расход/доход + движения по целям и долгам. */
type AddKind = 'expense' | 'income' | 'goal' | 'debt'
const KINDS: AddKind[] = ['expense', 'income', 'goal', 'debt']
const todayISO = () => new Date().toISOString().slice(0, 10)

/** Универсальное окно ввода: расход/доход (по категориям), пополнение цели, движение по долгу. */
export function AddTransaction() {
  const navigate = useNavigate()
  const [kind, setKind] = useState<AddKind>('expense')
  const close = () => navigate(-1)

  return (
    <div className="app-shell">
      <div className="app-body no-tabbar">
        <div className="modal-head">
          <div className="mo">Новая операция</div>
          <button className="close" onClick={close} aria-label="Закрыть">✕</button>
        </div>

        <div className="seg" style={{ marginBottom: 16 }}>
          {KINDS.map((k) => (
            <button
              key={k}
              className={`s${kind === k ? ' on' : ''}`}
              onClick={() => { haptic('light'); setKind(k) }}
            >
              {k === 'goal' ? '🎯 Цель' : k === 'debt' ? '🤝 Долг' : ARTICLE_LABELS[k]}
            </button>
          ))}
        </div>

        {kind === 'goal' ? (
          <GoalFlow onDone={close} />
        ) : kind === 'debt' ? (
          <DebtFlow onDone={close} />
        ) : (
          <CategoryFlow article={kind} onDone={close} />
        )}
      </div>
    </div>
  )
}

// ── Расход/Доход по категориям (прежний двухшаговый ввод + умный ввод) ──────
function CategoryFlow({ article, onDone }: { article: 'expense' | 'income'; onDone: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [amount, setAmount] = useState('')
  const [group, setGroup] = useState<CategoryGroup | null>(null)
  const [sub, setSub] = useState<Subcategory | null>(null)

  const [smartText, setSmartText] = useState('')
  const [smartNote, setSmartNote] = useState<string | null>(null)
  const [pendingMatch, setPendingMatch] = useState<{ group: string; subId: number } | null>(null)
  const smart = useSmartParse()

  const cats = useCategories(article)
  const create = useCreateTransaction()

  // Сброс выбора при переключении расход↔доход.
  useEffect(() => { setGroup(null); setSub(null); setStep(1) }, [article])

  useEffect(() => {
    if (!pendingMatch || cats.isPending || !cats.data) return
    const g = cats.data.find((x) => x.group === pendingMatch.group)
    const s = g?.subcategories.find((x) => x.id === pendingMatch.subId)
    if (g && s) { setGroup(g); setSub(s); setStep(2); haptic('medium') }
    setPendingMatch(null)
  }, [pendingMatch, cats.data, cats.isPending])

  const runSmart = async () => {
    const text = smartText.trim()
    if (!text || smart.isPending) return
    setSmartNote(null)
    try {
      const res = await smart.mutateAsync(text)
      if (res.amount != null) setAmount(String(res.amount))
      if (res.matched && res.categoryId != null && res.group && res.amount != null && res.article === article) {
        setPendingMatch({ group: res.group, subId: res.categoryId })
        setSmartText('')
      } else if (res.amount == null) {
        setSmartNote('Не понял сумму — впиши её вручную ниже 👇')
      } else {
        setSmartNote(`Сумму понял (${money(res.amount)}), а категорию — нет. Выбери ниже 👇`)
        setSmartText('')
      }
    } catch {
      setSmartNote('Не удалось разобрать. Попробуй ещё раз или введи вручную.')
    }
  }

  const canSave = Boolean(amount && sub) && !create.isPending
  const save = () => {
    if (!sub) return
    create.mutate(
      { categoryId: sub.id, amount: Number(amount), comment: undefined },
      { onSuccess: () => { haptic('medium'); onDone() } },
    )
  }

  if (step === 2) {
    return (
      <>
        <button className="crumbs" style={{ marginBottom: 12 }} onClick={() => setStep(1)}>
          ‹ {ARTICLE_LABELS[article]} › {group?.emoji} {group?.group}
        </button>
        <div className="mo" style={{ margin: '2px 0 14px' }}>Подкатегория</div>
        <div className="grid-cat" style={{ marginBottom: 14 }}>
          {group?.subcategories.map((s) => (
            <button
              key={s.id}
              className={`cchip${sub?.id === s.id ? ' on' : ''}`}
              onClick={() => { haptic('light'); setSub(s) }}
            >
              <span className="e">{s.emoji}</span>
              {s.name}
            </button>
          ))}
        </div>
        {create.isError && (
          <div className="toast over" style={{ marginBottom: 12 }}>
            <span className="ti">⚠️</span>
            <span>Не удалось сохранить. Попробуй ещё раз.</span>
          </div>
        )}
        <button className="btn btn-primary" disabled={!canSave} onClick={save}>
          {create.isPending ? 'Сохраняю…' : `Сохранить${amount ? ` · ${money(Number(amount))}` : ''}`}
        </button>
      </>
    )
  }

  return (
    <>
      <div className="smart-add">
        <div className="smart-row">
          <span className="smart-ico">✨</span>
          <input
            className="smart-input"
            placeholder="кофе 350, такси 420, зарплата…"
            value={smartText}
            onChange={(e) => { setSmartText(e.target.value); if (smartNote) setSmartNote(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') runSmart() }}
            enterKeyHint="done"
          />
          <button className="smart-go" onClick={runSmart} disabled={!smartText.trim() || smart.isPending} aria-label="Разобрать">
            {smart.isPending ? '…' : '→'}
          </button>
        </div>
        {smartNote && <div className="smart-note">{smartNote}</div>}
      </div>

      <AmountInput amount={amount} setAmount={setAmount} />

      <div className="fieldlbl">Категория</div>
      {cats.isPending ? (
        <SkeletonBlock rows={4} />
      ) : cats.isError ? (
        <ErrorState onRetry={cats.refetch} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cats.data.map((g) => (
            <button key={g.group} className="field" onClick={() => { haptic('light'); setGroup(g); setStep(2) }}>
              <span className="val">{g.emoji} {g.group}</span>
              <span className="faint">›</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

// ── Пополнение цели ─────────────────────────────────────────────────────────
function GoalFlow({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const { data: goals, isPending, isError, refetch } = useGoals(false)
  const [goalId, setGoalId] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [err, setErr] = useState<string | null>(null)

  const add = useAddGoalContribution(goalId ?? 0)
  const goal = (goals ?? []).find((g) => g.id === goalId) ?? null
  const remaining = goal ? Math.max(0, goal.remaining) : 0

  const save = async () => {
    const amt = Number(amount || 0)
    if (!goalId) { setErr('Выбери цель'); return }
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Сумма должна быть больше 0'); return }
    if (amt > remaining) { setErr(`Больше остатка (${money(remaining)})`); return }
    setErr(null)
    try {
      await add.mutateAsync({ amount: amt, date: date || undefined })
      haptic('medium')
      onDone()
    } catch {
      setErr('Не удалось сохранить')
    }
  }

  if (isPending) return <SkeletonBlock rows={4} />
  if (isError) return <ErrorState onRetry={refetch} />
  if ((goals ?? []).length === 0) {
    return (
      <>
        <EmptyState emoji="🎯" title="Пока нет целей" sub="Сначала создай цель — потом пополняй её здесь" />
        <button className="btn btn-primary" onClick={() => navigate('/goals')}>Перейти к целям</button>
      </>
    )
  }

  return (
    <>
      <AmountInput amount={amount} setAmount={setAmount} />

      <div className="fieldlbl">Цель</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {goals!.map((g) => (
          <button
            key={g.id}
            className={`field${goalId === g.id ? ' on' : ''}`}
            onClick={() => { haptic('light'); setGoalId(g.id) }}
          >
            <span className="val">🎯 {g.title}</span>
            <span className="faint">{compact(g.saved)} / {compact(g.targetAmount)}</span>
          </button>
        ))}
      </div>

      <label className="sheet-label">Дата</label>
      <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 14 }} />

      {err && <div className="toast over" style={{ marginBottom: 12 }}><span className="ti">⚠️</span><span>{err}</span></div>}

      <button className="btn btn-primary" disabled={add.isPending || !goalId || !amount} onClick={save}>
        {add.isPending ? 'Сохраняю…' : `Пополнить${amount ? ` · ${money(Number(amount))}` : ''}`}
      </button>
    </>
  )
}

// ── Движение по долгу: новый долг (тело) или платёж по существующему ─────────
function DebtFlow({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'new' | 'pay'>('new')

  return (
    <>
      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={`s${mode === 'new' ? ' on' : ''}`} onClick={() => { haptic('light'); setMode('new') }}>
          Новый долг
        </button>
        <button className={`s${mode === 'pay' ? ' on' : ''}`} onClick={() => { haptic('light'); setMode('pay') }}>
          Платёж
        </button>
      </div>
      {mode === 'new' ? <NewDebtForm onDone={onDone} /> : <DebtPaymentForm onDone={onDone} />}
    </>
  )
}

function NewDebtForm({ onDone }: { onDone: () => void }) {
  const [dir, setDir] = useState<DebtDirection>('owe')
  const [counterparty, setCounterparty] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [err, setErr] = useState<string | null>(null)
  const create = useCreateDebt()

  const save = async () => {
    const name = counterparty.trim()
    const amt = Number(amount || 0)
    if (!name) { setErr(dir === 'owe' ? 'У кого занял?' : 'Кому дал?'); return }
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Сумма должна быть больше 0'); return }
    setErr(null)
    try {
      await create.mutateAsync({ direction: dir, counterparty: name, amount: amt, startedOn: date || undefined })
      haptic('medium')
      onDone()
    } catch {
      setErr('Не удалось сохранить')
    }
  }

  return (
    <>
      <div className="seg" style={{ marginBottom: 16 }}>
        {(['owe', 'lent'] as DebtDirection[]).map((d) => (
          <button key={d} className={`s${dir === d ? ' on' : ''}`} onClick={() => { haptic('light'); setDir(d) }}>
            {d === 'owe' ? 'Я занял' : 'Я дал'}
          </button>
        ))}
      </div>

      <AmountInput amount={amount} setAmount={setAmount} />

      <label className="sheet-label">{dir === 'owe' ? 'У кого занял' : 'Кому дал'}</label>
      <input className="input" placeholder="Имя" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} style={{ marginBottom: 14 }} />

      <label className="sheet-label">Дата <span className="muted">(когда деньги перешли)</span></label>
      <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 14 }} />

      {err && <div className="toast over" style={{ marginBottom: 12 }}><span className="ti">⚠️</span><span>{err}</span></div>}

      <button className="btn btn-primary" disabled={create.isPending || !amount || !counterparty.trim()} onClick={save}>
        {create.isPending ? 'Сохраняю…' : `Сохранить${amount ? ` · ${money(Number(amount))}` : ''}`}
      </button>
    </>
  )
}

function DebtPaymentForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const { data: debts, isPending, isError, refetch } = useDebts(false)
  const [debtId, setDebtId] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [err, setErr] = useState<string | null>(null)

  const add = useAddDebtPayment(debtId ?? 0)
  const debt = (debts ?? []).find((d) => d.id === debtId) ?? null
  const remaining = debt ? Math.max(0, debt.remaining) : 0

  const save = async () => {
    const amt = Number(amount || 0)
    if (!debtId) { setErr('Выбери долг'); return }
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Сумма должна быть больше 0'); return }
    if (amt > remaining) { setErr(`Больше остатка (${money(remaining)})`); return }
    setErr(null)
    try {
      await add.mutateAsync({ amount: amt, date: date || undefined })
      haptic('medium')
      onDone()
    } catch {
      setErr('Не удалось сохранить')
    }
  }

  if (isPending) return <SkeletonBlock rows={4} />
  if (isError) return <ErrorState onRetry={refetch} />
  if ((debts ?? []).length === 0) {
    return (
      <>
        <EmptyState emoji="🤝" title="Нет активных долгов" sub="Заведи долг во вкладке «Новый долг» или в разделе «Долги»" />
        <button className="btn btn-secondary" onClick={() => navigate('/debts')}>Перейти к долгам</button>
      </>
    )
  }

  return (
    <>
      <AmountInput amount={amount} setAmount={setAmount} />

      <div className="fieldlbl">Долг</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {debts!.map((d) => (
          <button
            key={d.id}
            className={`field${debtId === d.id ? ' on' : ''}`}
            onClick={() => { haptic('light'); setDebtId(d.id) }}
          >
            <span className="val">🤝 {d.counterparty}</span>
            <span className="faint">{d.direction === 'owe' ? 'отдаю' : 'вернут'} · {compact(d.remaining)}</span>
          </button>
        ))}
      </div>

      <label className="sheet-label">Дата</label>
      <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginBottom: 14 }} />

      {err && <div className="toast over" style={{ marginBottom: 12 }}><span className="ti">⚠️</span><span>{err}</span></div>}

      <button className="btn btn-primary" disabled={add.isPending || !debtId || !amount} onClick={save}>
        {add.isPending ? 'Сохраняю…' : `Внести${amount ? ` · ${money(Number(amount))}` : ''}`}
      </button>
    </>
  )
}

// ── Общий ввод суммы (крупная цифра с ₽) ────────────────────────────────────
function AmountInput({ amount, setAmount }: { amount: string; setAmount: (v: string) => void }) {
  return (
    <div className="amount-in">
      <div className="a-row">
        <input
          className="a a-input"
          inputMode="numeric"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          style={{ width: `${Math.max(1, amount.length)}ch` }}
        />
        <span className="a cur">₽</span>
      </div>
      <div className="c">введите сумму</div>
    </div>
  )
}
