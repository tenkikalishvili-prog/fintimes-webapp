import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useBills,
  useCategories,
  useCreateBill,
  useDeleteBill,
  useSetBillPaid,
  useUpdateBill,
} from '../lib/queries'
import { SkeletonBlock, ErrorState, EmptyState } from '../components/States'
import { ApiError } from '../lib/api'
import { haptic } from '../lib/telegram'
import { money, compact, monthTitle, currentMonth, shiftMonth } from '../lib/format'
import type { Bill, BillInput, BillUpdateInput } from '../types'

/** Раздел «Платежи» (направление C, S10): календарь обязательных платежей по месяцам. */
export function Payments() {
  const navigate = useNavigate()
  const [month, setMonth] = useState(currentMonth())
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)

  const { data, isPending, isError, refetch } = useBills(month)
  const setPaid = useSetBillPaid()

  const bills = useMemo(() => data ?? [], [data])
  const total = useMemo(() => bills.reduce((s, b) => s + b.amount, 0), [bills])
  const paidSum = useMemo(
    () => bills.filter((b) => b.paid).reduce((s, b) => s + b.amount, 0),
    [bills],
  )
  const paidCount = bills.filter((b) => b.paid).length
  const remaining = Math.max(0, total - paidSum)

  const cur = currentMonth()
  const todayDay = new Date().getDate()
  const isOverdue = (b: Bill): boolean => {
    if (b.paid) return false
    if (month < cur) return true // прошлый месяц и не оплачено
    if (month === cur) return b.dueDay < todayDay
    return false // будущий месяц
  }

  const toggle = (b: Bill) => {
    haptic('medium')
    setPaid.mutate({ id: b.id, month, paid: !b.paid })
  }

  return (
    <div className="app-shell">
      <div className="app-body no-tabbar">
        <div className="modal-head">
          <div className="mo">Платежи</div>
          <button className="close" onClick={() => navigate(-1)} aria-label="Закрыть">
            ✕
          </button>
        </div>

        {/* Переключатель месяца */}
        <div className="hist-period" style={{ marginBottom: 14 }}>
          <button className="hp-nav" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Раньше">
            ‹
          </button>
          <span className="hp-lbl">{monthTitle(month)}</span>
          <button className="hp-nav" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Позже">
            ›
          </button>
        </div>

        {/* Сводка месяца */}
        <div className="pay-sum">
          <span className="ps-cap">Осталось оплатить</span>
          <span className="ps-amt">{money(remaining)}</span>
          {bills.length > 0 && (
            <span className="ps-meta">
              оплачено {paidCount} из {bills.length} · {compact(paidSum)} из {compact(total)}
            </span>
          )}
        </div>

        <button
          className="btn btn-primary"
          style={{ marginBottom: 18 }}
          onClick={() => { haptic('light'); setAdding(true) }}
        >
          ＋ Платёж
        </button>

        {isPending ? (
          <SkeletonBlock rows={4} />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : bills.length === 0 ? (
          <EmptyState
            emoji="📅"
            title="Платежей пока нет"
            sub="Добавьте регулярный платёж — так его не пропустить"
          />
        ) : (
          <div className="block bill-list">
            {bills.map((b) => (
              <div key={b.id} className={`bill-row${b.paid ? ' paid' : ''}`}>
                <button
                  className={`bill-check${b.paid ? ' on' : ''}`}
                  onClick={() => toggle(b)}
                  disabled={setPaid.isPending}
                  aria-label={b.paid ? 'Снять отметку оплаты' : 'Отметить оплаченным'}
                >
                  {b.paid ? '✓' : ''}
                </button>
                <button className="bill-main" onClick={() => { haptic('light'); setEditing(b) }}>
                  <div className="bill-mid">
                    <div className="bill-title">
                      {b.emoji ? `${b.emoji} ` : ''}{b.title}
                    </div>
                    <div className={`bill-meta${isOverdue(b) ? ' overdue' : ''}`}>
                      {isOverdue(b) ? `просрочено · до ${b.dueDay} числа` : `до ${b.dueDay} числа`} · {b.categoryName}
                    </div>
                  </div>
                  <div className="bill-amt">{money(b.amount)}</div>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {adding && <BillSheet onClose={() => setAdding(false)} />}
      {editing && <BillSheet bill={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** Bottom-sheet создания/редактирования платежа. Без `bill` — режим создания. */
function BillSheet({ bill, onClose }: { bill?: Bill; onClose: () => void }) {
  const isEdit = !!bill
  const [title, setTitle] = useState(bill?.title ?? '')
  const [amount, setAmount] = useState(bill ? String(Math.round(bill.amount)) : '')
  const [dueDay, setDueDay] = useState(bill ? String(bill.dueDay) : '')
  const [categoryId, setCategoryId] = useState<number | null>(bill?.categoryId ?? null)
  const [note, setNote] = useState(bill?.note ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  const cats = useCategories('expense')
  const create = useCreateBill()
  const update = useUpdateBill()
  const del = useDeleteBill()
  const pending = create.isPending || update.isPending || del.isPending

  const save = async () => {
    const t = title.trim()
    const amt = Number(amount || 0)
    const day = Number(dueDay || 0)
    if (!t) { setErr('Введите название платежа'); return }
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Сумма должна быть больше 0'); return }
    if (!Number.isInteger(day) || day < 1 || day > 31) { setErr('Число месяца — от 1 до 31'); return }
    if (!categoryId) { setErr('Выберите категорию расхода'); return }
    setErr(null)
    try {
      if (isEdit) {
        const body: BillUpdateInput = { title: t, amount: amt, dueDay: day, categoryId, note: note.trim() }
        await update.mutateAsync({ id: bill!.id, body })
      } else {
        const body: BillInput = { title: t, amount: amt, dueDay: day, categoryId, note: note.trim() || undefined }
        await create.mutateAsync(body)
      }
      haptic('medium')
      onClose()
    } catch (e) {
      setErr(e instanceof ApiError ? 'Не удалось сохранить' : 'Не удалось сохранить')
    }
  }

  const remove = async () => {
    if (!bill) return
    try {
      await del.mutateAsync(bill.id)
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
        <h4>{isEdit ? 'Платёж' : 'Новый платёж'}</h4>

        <label className="sheet-label">Название</label>
        <input
          className="input"
          placeholder="Аренда, кредит, подписка…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <div className="add-row" style={{ marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label className="sheet-label">Сумма, ₽</label>
            <input
              className="input"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
            />
          </div>
          <div style={{ flex: '0 0 38%' }}>
            <label className="sheet-label">Число месяца</label>
            <input
              className="input"
              inputMode="numeric"
              placeholder="1–31"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
            />
          </div>
        </div>

        <label className="sheet-label">Категория расхода</label>
        {cats.isPending ? (
          <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Загружаю категории…</div>
        ) : (
          <select
            className="input select"
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
            style={{ marginBottom: 14 }}
          >
            <option value="">— выберите —</option>
            {(cats.data ?? []).map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.subcategories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.emoji ? `${s.emoji} ` : ''}{s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}

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

        {isEdit && (confirmDel ? (
          <>
            <p className="del-note">
              Платёж и его отметки будут удалены. Уже записанные операции останутся в истории.
            </p>
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
            Удалить платёж
          </button>
        ))}
      </div>
    </div>
  )
}
