import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useAddDebtPayment,
  useCreateDebt,
  useDebtPayments,
  useDebts,
  useDeleteDebt,
  useDeleteDebtPayment,
  useUpdateDebt,
} from '../lib/queries'
import { SkeletonBlock, ErrorState, EmptyState } from '../components/States'
import { ApiError } from '../lib/api'
import { haptic } from '../lib/telegram'
import { money, compact, formatTxDate } from '../lib/format'
import { DEBT_DIRECTION_LABELS } from '../types'
import type { Debt, DebtDirection, DebtInput, DebtUpdateInput } from '../types'

const todayISO = () => new Date().toISOString().slice(0, 10)

/** Просрочен ли открытый долг (срок в прошлом). */
function isOverdue(d: Debt): boolean {
  return !d.isClosed && !!d.dueDate && d.dueDate < todayISO()
}

/** Раздел «Долги» (направление C, S8): реестр обязательств в обе стороны. */
export function Debts() {
  const navigate = useNavigate()
  const [dir, setDir] = useState<DebtDirection>('owe')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Debt | null>(null)

  // Тянем все долги (включая закрытые) — раскладываем по направлению на фронте.
  const { data, isPending, isError, refetch } = useDebts(true)

  const forDir = useMemo(
    () => (data ?? []).filter((d) => d.direction === dir),
    [data, dir],
  )
  const open = useMemo(() => forDir.filter((d) => !d.isClosed), [forDir])
  const closed = useMemo(() => forDir.filter((d) => d.isClosed), [forDir])

  // Сумма остатка по открытым долгам выбранного направления.
  const total = useMemo(() => open.reduce((s, d) => s + d.remaining, 0), [open])

  const pickDir = (d: DebtDirection) => {
    haptic('light')
    setDir(d)
  }

  return (
    <div className="app-shell">
      <div className="app-body no-tabbar">
        <div className="modal-head">
          <div className="mo">Долги</div>
          <button className="close" onClick={() => navigate(-1)} aria-label="Закрыть">
            ✕
          </button>
        </div>

        {/* Направление */}
        <div className="seg" style={{ marginBottom: 16 }}>
          {(['owe', 'lent'] as DebtDirection[]).map((d) => (
            <button key={d} className={`s${dir === d ? ' on' : ''}`} onClick={() => pickDir(d)}>
              {DEBT_DIRECTION_LABELS[d]}
            </button>
          ))}
        </div>

        {/* Сводка по направлению */}
        <div className={`debt-sum ${dir}`}>
          <span className="ds-cap">
            {dir === 'owe' ? 'Я должен всего' : 'Мне должны всего'}
          </span>
          <span className="ds-amt">{money(total)}</span>
          {open.length > 0 && (
            <span className="ds-meta">
              {open.length} {plural(open.length, 'долг', 'долга', 'долгов')}
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
          ＋ Добавить долг
        </button>

        {/* Список */}
        {isPending ? (
          <SkeletonBlock rows={4} />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : open.length === 0 && closed.length === 0 ? (
          <EmptyState
            emoji={dir === 'owe' ? '🙏' : '🤝'}
            title={dir === 'owe' ? 'Вы никому не должны' : 'Вам никто не должен'}
            sub="Добавьте долг кнопкой выше — так его не забыть"
          />
        ) : (
          <>
            {open.length > 0 && (
              <div className="block debt-list">
                {open.map((d) => (
                  <DebtRow key={d.id} debt={d} onTap={() => { haptic('light'); setEditing(d) }} />
                ))}
              </div>
            )}

            {closed.length > 0 && (
              <>
                <div className="debt-closed-cap">Закрытые ({closed.length})</div>
                <div className="block debt-list">
                  {closed.map((d) => (
                    <DebtRow key={d.id} debt={d} onTap={() => { haptic('light'); setEditing(d) }} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {adding && <DebtSheet initialDir={dir} onClose={() => setAdding(false)} />}
      {editing && <DebtSheet debt={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** Одна строка долга: инициал, имя, срок/заметка, остаток. */
function DebtRow({ debt, onTap }: { debt: Debt; onTap: () => void }) {
  const overdue = isOverdue(debt)
  const initial = debt.counterparty.trim().charAt(0).toUpperCase() || '?'

  let meta = debt.note ?? ''
  if (debt.dueDate) {
    const dateLbl = formatTxDate(debt.dueDate)
    const due = overdue ? `просрочено · ${dateLbl}` : `до ${dateLbl}`
    meta = meta ? `${due} · ${meta}` : due
  }

  // Прогресс частичного возврата — показываем только у открытых с начатыми выплатами.
  const partial = !debt.isClosed && debt.paid > 0 && debt.amount > 0
  const pct = partial ? Math.min(100, Math.round((debt.paid / debt.amount) * 100)) : 0

  return (
    <button className={`debt-row${debt.isClosed ? ' closed' : ''}`} onClick={onTap}>
      <div className="dr-ava">{debt.isClosed ? '✓' : initial}</div>
      <div className="dr-mid">
        <div className="dr-name">{debt.counterparty}</div>
        {meta && <div className={`dr-meta${overdue ? ' overdue' : ''}`}>{meta}</div>}
        {partial && (
          <div className="dr-prog">
            <div className="bar">
              <i className="fill-g" style={{ width: `${pct}%` }} />
            </div>
            <span className="dr-prog-lbl">{compact(debt.paid)} из {compact(debt.amount)}</span>
          </div>
        )}
      </div>
      <div className="dr-amt">{money(debt.remaining)}</div>
    </button>
  )
}

/** Bottom-sheet создания/редактирования долга. Без `debt` — режим создания. */
function DebtSheet({
  debt,
  initialDir = 'owe',
  onClose,
}: {
  debt?: Debt
  initialDir?: DebtDirection
  onClose: () => void
}) {
  const isEdit = !!debt
  const [dir, setDir] = useState<DebtDirection>(debt?.direction ?? initialDir)
  const [counterparty, setCounterparty] = useState(debt?.counterparty ?? '')
  const [amount, setAmount] = useState(debt ? String(Math.round(debt.amount)) : '')
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? '')
  const [note, setNote] = useState(debt?.note ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  const create = useCreateDebt()
  const update = useUpdateDebt()
  const del = useDeleteDebt()
  const pending = create.isPending || update.isPending || del.isPending

  const save = async () => {
    const name = counterparty.trim()
    const amt = Number(amount || 0)
    if (!name) { setErr('Укажите, кому или кто должен'); return }
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Сумма должна быть больше 0'); return }
    setErr(null)
    try {
      if (isEdit) {
        const body: DebtUpdateInput = {
          direction: dir,
          counterparty: name,
          amount: amt,
          dueDate: dueDate || undefined,
          note: note.trim(),
        }
        await update.mutateAsync({ id: debt!.id, body })
      } else {
        const body: DebtInput = {
          direction: dir,
          counterparty: name,
          amount: amt,
          dueDate: dueDate || undefined,
          note: note.trim() || undefined,
        }
        await create.mutateAsync(body)
      }
      haptic('medium')
      onClose()
    } catch (e) {
      setErr(e instanceof ApiError ? 'Не удалось сохранить' : 'Не удалось сохранить')
    }
  }

  const toggleClosed = async () => {
    if (!debt) return
    try {
      await update.mutateAsync({ id: debt.id, body: { isClosed: !debt.isClosed } })
      haptic('medium')
      onClose()
    } catch {
      setErr('Не удалось обновить статус')
    }
  }

  const remove = async () => {
    if (!debt) return
    try {
      await del.mutateAsync(debt.id)
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
        <h4>{isEdit ? 'Долг' : 'Новый долг'}</h4>

        <div className="seg" style={{ marginBottom: 16 }}>
          {(['owe', 'lent'] as DebtDirection[]).map((d) => (
            <button key={d} className={`s${dir === d ? ' on' : ''}`} onClick={() => setDir(d)}>
              {DEBT_DIRECTION_LABELS[d]}
            </button>
          ))}
        </div>

        <label className="sheet-label">{dir === 'owe' ? 'Кому должен' : 'Кто должен'}</label>
        <input
          className="input"
          placeholder="Имя или кому"
          value={counterparty}
          onChange={(e) => setCounterparty(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <label className="sheet-label">Сумма, ₽</label>
        <input
          className="input"
          inputMode="numeric"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          style={{ marginBottom: 14 }}
        />

        <label className="sheet-label">Срок возврата <span className="muted">(необязательно)</span></label>
        <input
          className="input"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <label className="sheet-label">Заметка <span className="muted">(необязательно)</span></label>
        <input
          className="input"
          placeholder="За что / детали"
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

        {isEdit && <PaymentsSection debt={debt!} />}

        {isEdit && (
          <button
            className="btn btn-secondary"
            style={{ marginTop: 10 }}
            disabled={pending}
            onClick={toggleClosed}
          >
            {debt!.isClosed ? '↩︎ Вернуть в активные' : '✓ Отметить возвращённым'}
          </button>
        )}

        {isEdit && (confirmDel ? (
          <>
            <p className="del-note">Карточка долга будет удалена без возможности восстановить.</p>
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
            Удалить долг
          </button>
        ))}
      </div>
    </div>
  )
}

/** Секция «Возвраты частями» (S9): прогресс, запись возврата, история платежей. */
function PaymentsSection({ debt }: { debt: Debt }) {
  const [amount, setAmount] = useState('')
  const [payDate, setPayDate] = useState(todayISO())
  const [err, setErr] = useState<string | null>(null)

  const { data: payments, isPending } = useDebtPayments(debt.id)
  const add = useAddDebtPayment(debt.id)
  const del = useDeleteDebtPayment(debt.id)
  const busy = add.isPending || del.isPending

  // Погашено считаем по живой истории платежей (не по возможно устаревшему debt.paid).
  const paid = useMemo(
    () => (payments ?? []).reduce((s, p) => s + p.amount, 0),
    [payments],
  )
  const remaining = Math.max(0, Math.round((debt.amount - paid) * 100) / 100)
  const pct = debt.amount > 0 ? Math.min(100, Math.round((paid / debt.amount) * 100)) : 0

  const record = async () => {
    const amt = Number(amount || 0)
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Сумма возврата должна быть больше 0'); return }
    if (amt > remaining) { setErr(`Больше остатка (${money(remaining)})`); return }
    setErr(null)
    try {
      await add.mutateAsync({ amount: amt, date: payDate || undefined })
      haptic('medium')
      setAmount('')
      setPayDate(todayISO())
    } catch {
      setErr('Не удалось записать возврат')
    }
  }

  const removePayment = async (id: number) => {
    setErr(null)
    try {
      await del.mutateAsync(id)
      haptic('light')
    } catch {
      setErr('Не удалось удалить возврат')
    }
  }

  return (
    <div className="pay-sec">
      <div className="pay-head">
        <span className="sheet-label" style={{ margin: 0 }}>Возвраты частями</span>
        <span className="pay-prog-lbl">{compact(paid)} из {compact(debt.amount)}</span>
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
        <p className="muted" style={{ fontSize: 12, margin: '0 0 6px' }}>Долг погашен полностью 🎉</p>
      )}

      {err && (
        <div className="toast over" style={{ margin: '10px 0 0' }}>
          <span className="ti">⚠️</span>
          <span>{err}</span>
        </div>
      )}

      {isPending ? null : payments && payments.length > 0 ? (
        <div className="pay-list">
          {payments.map((p) => (
            <div key={p.id} className="pay-row">
              <span className="pay-row-date">{formatTxDate(p.date)}</span>
              <span className="pay-row-amt">{money(p.amount)}</span>
              <button
                className="pay-row-del"
                disabled={busy}
                onClick={() => removePayment(p.id)}
                aria-label="Удалить возврат"
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

/** Русское склонение: 1 долг / 2 долга / 5 долгов. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
