import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useAddGoalContribution,
  useCreateGoal,
  useDeleteGoal,
  useDeleteGoalContribution,
  useGoalContributions,
  useGoals,
  useUpdateGoal,
} from '../lib/queries'
import { SkeletonBlock, ErrorState, EmptyState } from '../components/States'
import { haptic } from '../lib/telegram'
import { money, compact, formatTxDate } from '../lib/format'
import type { Goal, GoalInput, GoalUpdateInput } from '../types'

const todayISO = () => new Date().toISOString().slice(0, 10)

/** Целое число дней от сегодня до срока (может быть отрицательным — срок в прошлом). */
function daysUntil(iso: string): number {
  const d = new Date(iso + 'T00:00:00')
  const today = new Date(todayISO() + 'T00:00:00')
  return Math.round((d.getTime() - today.getTime()) / 864e5)
}

/**
 * Нужный темп накопления по остатку и сроку: сколько откладывать в месяц.
 * null — если срока нет, остатка нет или срок уже прошёл (темп не имеет смысла).
 */
function requiredPace(g: Goal): number | null {
  if (!g.deadline || g.remaining <= 0) return null
  const days = daysUntil(g.deadline)
  if (days <= 0) return null
  const months = Math.max(1, Math.round(days / 30))
  return g.remaining / months
}

/** Просрочена ли активная цель (срок в прошлом, ещё не достигнута). */
function isOverdue(g: Goal): boolean {
  return !g.isDone && !!g.deadline && daysUntil(g.deadline) < 0
}

/** Раздел «Цели» (направление D, S13): накопления с прогрессом и нужным темпом. */
export function Goals() {
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)

  // Тянем все цели (включая достигнутые) — раскладываем на активные/готовые на фронте.
  const { data, isPending, isError, refetch } = useGoals(true)

  const active = useMemo(() => (data ?? []).filter((g) => !g.isDone), [data])
  const done = useMemo(() => (data ?? []).filter((g) => g.isDone), [data])

  // Сколько всего осталось накопить по активным целям.
  const totalLeft = useMemo(() => active.reduce((s, g) => s + g.remaining, 0), [active])

  return (
    <div className="app-shell">
      <div className="app-body no-tabbar">
        <div className="modal-head">
          <div className="mo">Цели</div>
          <button className="close" onClick={() => navigate(-1)} aria-label="Закрыть">
            ✕
          </button>
        </div>

        {/* Сводка */}
        <div className="goal-sum">
          <span className="gs-cap">Осталось накопить</span>
          <span className="gs-amt">{money(totalLeft)}</span>
          {active.length > 0 && (
            <span className="gs-meta">
              {active.length} {plural(active.length, 'активная цель', 'активные цели', 'активных целей')}
            </span>
          )}
        </div>

        <button
          className="btn btn-primary"
          style={{ marginBottom: 18 }}
          onClick={() => {
            haptic('light')
            setAdding(true)
          }}
        >
          ＋ Новая цель
        </button>

        {/* Список */}
        {isPending ? (
          <SkeletonBlock rows={4} />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : active.length === 0 && done.length === 0 ? (
          <EmptyState
            emoji="🎯"
            title="Пока нет целей"
            sub="Поставьте цель кнопкой выше — и следите, как растёт прогресс"
          />
        ) : (
          <>
            {active.length > 0 && (
              <div className="block debt-list">
                {active.map((g) => (
                  <GoalRow key={g.id} goal={g} onTap={() => { haptic('light'); setEditing(g) }} />
                ))}
              </div>
            )}

            {done.length > 0 && (
              <>
                <div className="debt-closed-cap">Достигнутые ({done.length})</div>
                <div className="block debt-list">
                  {done.map((g) => (
                    <GoalRow key={g.id} goal={g} onTap={() => { haptic('light'); setEditing(g) }} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {adding && <GoalSheet onClose={() => setAdding(false)} />}
      {editing && <GoalSheet goal={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** Одна строка цели: иконка, название, срок/темп, прогресс, остаток. */
function GoalRow({ goal, onTap }: { goal: Goal; onTap: () => void }) {
  const overdue = isOverdue(goal)
  const pct = goal.targetAmount > 0
    ? Math.min(100, Math.round((goal.saved / goal.targetAmount) * 100))
    : 0

  const pace = requiredPace(goal)
  let meta = goal.note ?? ''
  if (goal.deadline) {
    const dateLbl = formatTxDate(goal.deadline)
    const due = overdue ? `срок прошёл · ${dateLbl}` : `до ${dateLbl}`
    meta = meta ? `${due} · ${meta}` : due
  }

  return (
    <button className={`debt-row${goal.isDone ? ' closed' : ''}`} onClick={onTap}>
      <div className="dr-ava">{goal.isDone ? '✓' : '🎯'}</div>
      <div className="dr-mid">
        <div className="dr-name">{goal.title}</div>
        {meta && <div className={`dr-meta${overdue ? ' overdue' : ''}`}>{meta}</div>}
        {!goal.isDone && (
          <div className="dr-prog">
            <div className="bar">
              <i className="fill-g" style={{ width: `${pct}%` }} />
            </div>
            <span className="dr-prog-lbl">{compact(goal.saved)} из {compact(goal.targetAmount)}</span>
          </div>
        )}
        {pace !== null && (
          <div className="dr-pace">≈ {money(pace)}/мес до цели</div>
        )}
      </div>
      <div className="dr-amt">{money(goal.remaining)}</div>
    </button>
  )
}

/** Bottom-sheet создания/редактирования цели. Без `goal` — режим создания. */
function GoalSheet({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const isEdit = !!goal
  const [title, setTitle] = useState(goal?.title ?? '')
  const [amount, setAmount] = useState(goal ? String(Math.round(goal.targetAmount)) : '')
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [note, setNote] = useState(goal?.note ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  const create = useCreateGoal()
  const update = useUpdateGoal()
  const del = useDeleteGoal()
  const pending = create.isPending || update.isPending || del.isPending

  const save = async () => {
    const name = title.trim()
    const amt = Number(amount || 0)
    if (!name) { setErr('Укажите, на что копите'); return }
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Сумма цели должна быть больше 0'); return }
    setErr(null)
    try {
      if (isEdit) {
        const body: GoalUpdateInput = {
          title: name,
          targetAmount: amt,
          deadline: deadline || undefined,
          note: note.trim(),
        }
        await update.mutateAsync({ id: goal!.id, body })
      } else {
        const body: GoalInput = {
          title: name,
          targetAmount: amt,
          deadline: deadline || undefined,
          note: note.trim() || undefined,
        }
        await create.mutateAsync(body)
      }
      haptic('medium')
      onClose()
    } catch {
      setErr('Не удалось сохранить')
    }
  }

  const toggleDone = async () => {
    if (!goal) return
    try {
      await update.mutateAsync({ id: goal.id, body: { isDone: !goal.isDone } })
      haptic('medium')
      onClose()
    } catch {
      setErr('Не удалось обновить статус')
    }
  }

  const remove = async () => {
    if (!goal) return
    try {
      await del.mutateAsync(goal.id)
      haptic('medium')
      onClose()
    } catch {
      setErr('Не удалось удалить')
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <h4>{isEdit ? 'Цель' : 'Новая цель'}</h4>

        <label className="sheet-label">На что копим</label>
        <input
          className="input"
          placeholder="Напр. Отпуск, подушка, техника"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <label className="sheet-label">Сумма цели, ₽</label>
        <input
          className="input"
          inputMode="numeric"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          style={{ marginBottom: 14 }}
        />

        <label className="sheet-label">Срок <span className="muted">(необязательно)</span></label>
        <input
          className="input"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <label className="sheet-label">Заметка <span className="muted">(необязательно)</span></label>
        <input
          className="input"
          placeholder="Детали"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        {err && (
          <div className="toast over" style={{ marginBottom: 12 }}>
            <span className="ti">⚠️</span>
            <span>{err}</span>
          </div>
        )}

        <button className="btn btn-primary" disabled={pending} onClick={save}>
          {pending ? 'Сохраняю…' : `Сохранить · ${money(Number(amount || 0))}`}
        </button>

        {isEdit && <ContributionsSection goal={goal!} />}

        {isEdit && (
          <button
            className="btn btn-secondary"
            style={{ marginTop: 10 }}
            disabled={pending}
            onClick={toggleDone}
          >
            {goal!.isDone ? '↩︎ Вернуть в активные' : '✓ Отметить достигнутой'}
          </button>
        )}

        {isEdit && (confirmDel ? (
          <>
            <p className="del-note">Цель и история пополнений будут удалены без возможности восстановить.</p>
            <div className="del-row">
              <button className="btn btn-ghost" disabled={pending} onClick={() => setConfirmDel(false)}>
                Отмена
              </button>
              <button className="btn btn-danger" disabled={pending} onClick={remove}>
                {del.isPending ? 'Удаляю…' : 'Удалить'}
              </button>
            </div>
          </>
        ) : (
          <button className="btn btn-ghost del-btn" disabled={pending} onClick={() => setConfirmDel(true)}>
            Удалить цель
          </button>
        ))}
      </div>
    </div>
  )
}

/** Секция «Пополнения» (S13): прогресс, запись пополнения, история. */
function ContributionsSection({ goal }: { goal: Goal }) {
  const [amount, setAmount] = useState('')
  const [payDate, setPayDate] = useState(todayISO())
  const [err, setErr] = useState<string | null>(null)

  const { data: items, isPending } = useGoalContributions(goal.id)
  const add = useAddGoalContribution(goal.id)
  const del = useDeleteGoalContribution(goal.id)
  const busy = add.isPending || del.isPending

  // Накоплено считаем по живой истории (не по возможно устаревшему goal.saved).
  const saved = useMemo(
    () => (items ?? []).reduce((s, c) => s + c.amount, 0),
    [items],
  )
  const remaining = Math.max(0, Math.round((goal.targetAmount - saved) * 100) / 100)
  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((saved / goal.targetAmount) * 100)) : 0

  const record = async () => {
    const amt = Number(amount || 0)
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Сумма пополнения должна быть больше 0'); return }
    if (amt > remaining) { setErr(`Больше остатка (${money(remaining)})`); return }
    setErr(null)
    try {
      await add.mutateAsync({ amount: amt, date: payDate || undefined })
      haptic('medium')
      setAmount('')
      setPayDate(todayISO())
    } catch {
      setErr('Не удалось записать пополнение')
    }
  }

  const removeItem = async (id: number) => {
    setErr(null)
    try {
      await del.mutateAsync(id)
      haptic('light')
    } catch {
      setErr('Не удалось удалить пополнение')
    }
  }

  return (
    <div className="pay-sec">
      <div className="pay-head">
        <span className="sheet-label" style={{ margin: 0 }}>Пополнения</span>
        <span className="pay-prog-lbl">{compact(saved)} из {compact(goal.targetAmount)}</span>
      </div>
      <div className="bar" style={{ marginBottom: 12 }}>
        <i className="fill-g" style={{ width: `${pct}%` }} />
      </div>

      {remaining > 0 ? (
        <div className="pay-add">
          <input
            className="input pay-amt"
            inputMode="numeric"
            placeholder={`Сумма (остаток ${compact(remaining)})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          />
          <input
            className="input pay-date"
            type="date"
            value={payDate}
            onChange={(e) => setPayDate(e.target.value)}
          />
          <button className="btn btn-secondary pay-go" disabled={busy || !amount} onClick={record}>
            {add.isPending ? '…' : 'Внести'}
          </button>
        </div>
      ) : (
        <p className="muted" style={{ fontSize: 12, margin: '0 0 6px' }}>Цель достигнута 🎉</p>
      )}

      {err && (
        <div className="toast over" style={{ margin: '10px 0 0' }}>
          <span className="ti">⚠️</span>
          <span>{err}</span>
        </div>
      )}

      {isPending ? null : items && items.length > 0 ? (
        <div className="pay-list">
          {items.map((c) => (
            <div key={c.id} className="pay-row">
              <span className="pay-row-date">{formatTxDate(c.date)}</span>
              <span className="pay-row-amt">{money(c.amount)}</span>
              <button
                className="pay-row-del"
                disabled={busy}
                onClick={() => removeItem(c.id)}
                aria-label="Удалить пополнение"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Русское склонение по числу. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
