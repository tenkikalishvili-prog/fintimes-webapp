import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useBills,
  useCashflowPlan,
  useCategories,
  useCreateBill,
  useCredits,
  useDeleteBill,
  useSetBillPaid,
  useSetCreditClosed,
  useSetDebtPaid,
  useUpdateBill,
} from '../lib/queries'
import { SkeletonBlock, ErrorState } from '../components/States'
import { OverdueBlock } from '../components/OverdueBlock'
import { PaymentTile } from '../components/PaymentTiles'
import { CreditRepaymentSheet } from '../components/CreditRepaymentSheet'
import { ApiError } from '../lib/api'
import { haptic } from '../lib/telegram'
import { money, compact, monthTitle, currentMonth, shiftMonth, onlyDigits, groupDigits } from '../lib/format'
import type { Bill, BillInput, BillUpdateInput, CashflowItem, Credit } from '../types'

/**
 * Раздел «Платежи»: три блока под кнопкой «＋ Платёж».
 *  1. «Обязательные платежи» — плитки «до 15-го» / «до конца месяца» (перенесены из «Аналитики»)
 *     с чек-боксами оплаты внутри;
 *  2. «Долги» — отдельный список с чек-боксом оплаты (в плитках долгов нет);
 *  3. «Досрочное погашение кредитов» — рекомендуемая сумма (фонд), факт и список кредитов.
 * «Осталось оплатить» = неоплаченные платежи + долги + просрочка. Досрочка сюда НЕ входит.
 */
export function Payments() {
  const navigate = useNavigate()
  const [month, setMonth] = useState(currentMonth())
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)

  const billsQ = useBills(month)
  const plan = useCashflowPlan(month)
  const setPaid = useSetBillPaid()
  const setDebtPaid = useSetDebtPaid()

  const bills = useMemo(() => billsQ.data ?? [], [billsQ.data])
  const segments = plan.data?.segments ?? []
  const overdueItems = useMemo(() => plan.data?.overdue ?? [], [plan.data])

  // Все обязательства месяца (платежи + долги): считаем «Осталось оплатить» и прогресс.
  const monthItems = useMemo(() => segments.flatMap((s) => s.items), [segments])
  const debtItems = useMemo(() => monthItems.filter((it) => it.kind === 'debt'), [monthItems])
  const total = monthItems.reduce((s, it) => s + it.amount, 0)
  const paidSum = monthItems.reduce(
    (s, it) => s + (it.paid ? it.amount : it.kind === 'debt' ? it.paidAmount : 0),
    0,
  )
  const paidCount = monthItems.filter((it) => it.paid).length
  const overdueSum = overdueItems.reduce((s, o) => s + o.amount, 0)
  const remaining = Math.max(0, total - paidSum) + overdueSum

  const payOverdue = (it: CashflowItem) => {
    if (!it.originPeriod) return
    haptic('medium')
    if (it.kind === 'debt') setDebtPaid.mutate({ id: it.id, paid: true, amount: it.amount })
    else setPaid.mutate({ id: it.id, month: it.originPeriod, paid: true })
  }

  const editBill = (id: number) => {
    const b = bills.find((x) => x.id === id)
    if (b) setEditing(b)
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

        {/* Сводка месяца — сумма включает просрочку, ниже разбивка */}
        <div className={`pay-sum${overdueSum > 0 ? ' has-over' : ''}`}>
          <span className="ps-cap">Осталось оплатить</span>
          <span className="ps-amt">{money(remaining)}</span>
          {overdueSum > 0 && (
            <div className="ps-break">
              <span className="dot" />
              <span className="lbl">в том числе просрочка</span>
              <span className="val">{money(overdueSum)}</span>
            </div>
          )}
          {monthItems.length > 0 && (
            <span className="ps-meta">
              оплачено {paidCount} из {monthItems.length} · {compact(paidSum)} из {compact(total)}
            </span>
          )}
        </div>

        {/* Просрочка прошлых месяцев (платежи и долги) — красным блоком, с галочками */}
        <OverdueBlock
          items={overdueItems}
          onToggle={payOverdue}
          busy={setPaid.isPending || setDebtPaid.isPending}
        />

        <button
          className="btn btn-primary"
          style={{ marginBottom: 18 }}
          onClick={() => { haptic('light'); setAdding(true) }}
        >
          ＋ Платёж
        </button>

        {/* ① Обязательные платежи */}
        <div className="pay-div"><span>Обязательные платежи</span></div>
        {plan.isPending ? (
          <SkeletonBlock rows={2} />
        ) : plan.isError ? (
          <ErrorState onRetry={plan.refetch} />
        ) : (
          <div className="cfv-wrap">
            {segments.map((seg) => (
              <PaymentTile key={seg.index} seg={seg} month={month} onEdit={editBill} />
            ))}
          </div>
        )}

        {/* ② Долги */}
        <div className="pay-div">
          <span>Долги{debtItems.length > 0 && <em> · {debtItems.length}</em>}</span>
        </div>
        <DebtsBlock items={debtItems} onOpen={() => navigate('/debts')} />

        {/* ③ Досрочное погашение кредитов */}
        <div className="pay-div"><span>Досрочное погашение кредитов</span></div>
        <PrepayBlock month={month} onOpenCredits={() => navigate('/credits')} />
      </div>

      {adding && <BillSheet onClose={() => setAdding(false)} />}
      {editing && <BillSheet bill={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** Блок «Долги»: «я должен» со сроком в месяце. Чек-бокс вносит возврат на остаток. */
function DebtsBlock({ items, onOpen }: { items: CashflowItem[]; onOpen: () => void }) {
  const setDebtPaid = useSetDebtPaid()
  if (items.length === 0) {
    return (
      <div className="block pay-empty">
        <p>Долгов со сроком в этом месяце нет. Долги добавляются в разделе «Долги».</p>
      </div>
    )
  }
  const left = items.reduce((s, it) => s + (it.paid ? 0 : it.amount - it.paidAmount), 0)
  return (
    <div className="block bill-list">
      <div className="pay-blk-head">
        <span>Осталось вернуть</span>
        <b>{money(left)}</b>
      </div>
      {items.map((it) => (
        <div key={`debt-${it.id}`} className={`bill-row${it.paid ? ' paid' : ''}`}>
          <button
            className={`bill-check${it.paid ? ' on' : ''}`}
            disabled={setDebtPaid.isPending}
            onClick={() => {
              haptic('medium')
              setDebtPaid.mutate({ id: it.id, paid: !it.paid, amount: it.amount - it.paidAmount })
            }}
            aria-label={it.paid ? 'Снять отметку возврата' : 'Отметить возвращённым'}
          >
            {it.paid ? '✓' : ''}
          </button>
          <button className="bill-main" onClick={() => { haptic('light'); onOpen() }}>
            <div className="bill-mid">
              <div className="bill-title">🤝 {it.title}</div>
              <div className={`bill-meta${it.overdue ? ' overdue' : ''}`}>
                {it.paid
                  ? `до ${it.day} числа · возвращён`
                  : it.paidAmount > 0
                    ? `возвращено ${money(it.paidAmount)} из ${money(it.amount)}`
                    : `${it.overdue ? 'просрочено · ' : ''}до ${it.day} числа`}
              </div>
            </div>
            <div className="bill-amt">{money(it.amount)}</div>
          </button>
        </div>
      ))}
    </div>
  )
}

/** Блок «Досрочное погашение кредитов»: фонд (рекомендуемая сумма) + факт за месяц + кредиты. */
function PrepayBlock({ month, onOpenCredits }: { month: string; onOpenCredits: () => void }) {
  const credits = useCredits(month)
  const setClosed = useSetCreditClosed()
  const [open, setOpen] = useState<Credit | null>(null)
  const [armed, setArmed] = useState<number | null>(null)

  const list = useMemo(
    () =>
      [...(credits.data?.items ?? [])].sort(
        (a, b) => Number(a.isClosed) - Number(b.isClosed) || a.remaining - b.remaining || a.id - b.id,
      ),
    [credits.data],
  )

  if (credits.isPending) return <SkeletonBlock rows={2} />
  if (credits.isError) return <ErrorState onRetry={credits.refetch} />
  const data = credits.data

  const toggle = (c: Credit) => {
    if (c.isClosed && armed !== c.id) { setArmed(c.id); haptic('light'); return } // сброс факта — в два тапа
    haptic('medium')
    setArmed(null)
    setClosed.mutate({ id: c.id, closed: !c.isClosed })
  }

  return (
    <>
      <div className="pp-fund">
        <div>
          <span className="pp-cap">Рекомендуемая сумма</span>
          <span className="pp-big y">{money(data.fund)}</span>
        </div>
        <div className="pp-r">
          <span className="pp-cap">Факт за месяц</span>
          <span className={`pp-big${(data.monthPaid ?? 0) > 0 ? ' ok' : ''}`}>{money(data.monthPaid ?? 0)}</span>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="block pay-empty">
          <p>Кредитов пока нет. Добавьте их в разделе «Кредиты» — и здесь можно будет отмечать досрочные погашения.</p>
          <button className="btn btn-secondary btn-sm" onClick={onOpenCredits}>Перейти в «Кредиты»</button>
        </div>
      ) : (
        <div className="block bill-list">
          {list.map((c) => (
            <div key={c.id} className={`bill-row${c.isClosed ? ' paid' : ''}`}>
              <button
                className={`bill-check${c.isClosed ? ' on' : ''}${armed === c.id ? ' armed' : ''}`}
                disabled={setClosed.isPending}
                onClick={() => toggle(c)}
                aria-label={c.isClosed ? 'Снять отметку «погашен»' : 'Отметить погашенным полностью'}
              >
                {c.isClosed ? '✓' : ''}
              </button>
              <button className="bill-main" onClick={() => { haptic('light'); setArmed(null); setOpen(c) }}>
                <div className="bill-mid">
                  <div className="bill-title">
                    <span className={`cr-kind ${c.kind}`}>{c.kind === 'card' ? 'Кредитка' : 'Кредит'}</span>
                    {c.bank}
                  </div>
                  <div className="bill-meta">
                    {armed === c.id
                      ? 'Нажмите галочку ещё раз — факт обнулится'
                      : c.isClosed
                        ? '✓ погашен полностью'
                        : `тело ${money(c.amount)}${c.paid > 0 ? ` · осталось ${money(c.remaining)}` : ''}`}
                  </div>
                </div>
                <div className="pp-fact">
                  <small>Факт</small>
                  {money(c.paid)}
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      {open && <CreditRepaymentSheet credit={open} onClose={() => setOpen(null)} />}
    </>
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
              value={groupDigits(amount)}
              onChange={(e) => setAmount(onlyDigits(e.target.value))}
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
