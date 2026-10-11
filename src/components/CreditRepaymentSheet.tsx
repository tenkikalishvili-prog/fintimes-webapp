import { useState } from 'react'
import { useAddCreditRepayment, useCreditRepayments, useDeleteCreditRepayment } from '../lib/queries'
import { haptic } from '../lib/telegram'
import { money, compact, formatTxDate, onlyDigits, groupDigits } from '../lib/format'
import type { Credit } from '../types'

const todayISO = () => new Date().toISOString().slice(0, 10)

/**
 * Карточка кредита на экране «Платежи»: тело / оплачено (факт) / осталось, внесение части тела
 * и история досрочных погашений. Полностью закрыть кредит — галочкой в строке списка.
 */
export function CreditRepaymentSheet({ credit, onClose }: { credit: Credit; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [payDate, setPayDate] = useState(todayISO())
  const [err, setErr] = useState<string | null>(null)

  const { data: items } = useCreditRepayments(credit.id)
  const add = useAddCreditRepayment(credit.id)
  const del = useDeleteCreditRepayment(credit.id)
  const busy = add.isPending || del.isPending

  // Факт считаем по живой истории — карточка кредита из списка может быть чуть устаревшей.
  const paid = items ? items.reduce((s, c) => s + c.amount, 0) : credit.paid
  const remaining = Math.max(0, Math.round((credit.amount - paid) * 100) / 100)

  const record = async () => {
    const amt = Number(amount || 0)
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Сумма должна быть больше 0'); return }
    if (amt > remaining) { setErr(`Больше остатка (${money(remaining)})`); return }
    setErr(null)
    try {
      await add.mutateAsync({ amount: amt, date: payDate || undefined })
      haptic('medium')
      setAmount('')
      setPayDate(todayISO())
    } catch {
      setErr('Не удалось внести')
    }
  }

  const removeItem = async (id: number) => {
    setErr(null)
    try {
      await del.mutateAsync(id)
      haptic('light')
    } catch {
      setErr('Не удалось удалить')
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <h4>{credit.bank} · {credit.kind === 'card' ? 'кредитка' : 'кредит'}</h4>

        <div className="cr-info">
          <div><span>Тело</span><b>{compact(credit.amount)}</b></div>
          <div><span>Оплачено (факт)</span><b className="ok">{compact(paid)}</b></div>
          <div><span>Осталось</span><b>{compact(remaining)}</b></div>
        </div>

        {remaining > 0 ? (
          <div className="pay-add" style={{ marginTop: 14 }}>
            <input
              className="input pay-amt"
              inputMode="numeric"
              placeholder="Внести часть тела, ₽"
              value={groupDigits(amount)}
              onChange={(e) => setAmount(onlyDigits(e.target.value))}
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
          <p className="muted" style={{ fontSize: 12, margin: '14px 0 0' }}>Кредит погашен полностью 🎉</p>
        )}

        {err && (
          <div className="toast over" style={{ margin: '10px 0 0' }}>
            <span className="ti">⚠️</span>
            <span>{err}</span>
          </div>
        )}

        {items && items.length > 0 && (
          <div className="pay-list">
            {items.map((c) => (
              <div key={c.id} className="pay-row">
                <span className="pay-row-date">{formatTxDate(c.date)}</span>
                <span className="pay-row-amt">{money(c.amount)}</span>
                <button
                  className="pay-row-del"
                  disabled={busy}
                  onClick={() => removeItem(c.id)}
                  aria-label="Удалить погашение"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
