import { useState } from 'react'
import { useSetBillPaid, useUpdateBill } from '../lib/queries'
import { haptic } from '../lib/telegram'
import { compact, money } from '../lib/format'
import type { CashflowItem, CashflowSegment } from '../types'

/**
 * Плитка половины месяца («Оплатить до 15-го» / «Оплатить до конца месяца») на экране «Платежи».
 * Перенесена из «Аналитики». Считает ТОЛЬКО обязательные платежи: долги живут в своём блоке
 * «Долги», поэтому «К оплате» и «Останется» здесь — без них. Внутри раскрывающегося списка у
 * каждого платежа чек-бокс «оплачено» (создаёт расходную операцию, снятие её удаляет).
 */
export function PaymentTile({
  seg,
  month,
  onEdit,
}: {
  seg: CashflowSegment
  month: string
  /** Тап по названию платежа — открыть редактирование. */
  onEdit: (billId: number) => void
}) {
  // Обе плитки свёрнуты по умолчанию — раскрываются по тапу.
  const [open, setOpen] = useState(false)

  const items = seg.items.filter((it) => it.kind === 'bill')
  const obligations = items.reduce((s, it) => s + it.amount, 0)
  const paid = items.filter((it) => it.paid).reduce((s, it) => s + it.amount, 0)
  const leftToPay = Math.max(0, obligations - paid)
  const coverage = seg.expectedIncome - obligations
  const restPos = coverage >= 0
  const showProgress = paid > 0
  const allPaid = paid > 0 && leftToPay === 0
  const emptyBoth = seg.incomes.length === 0 && items.length === 0

  return (
    <div className={`cfv-tile${open ? ' open' : ''}`}>
      <button className="cfv-top" onClick={() => { haptic('light'); setOpen(!open) }}>
        <div className="cfv-h">
          <span className="cfv-ic">{seg.index === 1 ? '💸' : '📆'}</span>
          <span className="cfv-tt">
            <b>{seg.index === 1 ? 'Оплатить до 15-го' : 'Оплатить до конца месяца'}</b>
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
            <div className="cfv-v">{compact(obligations)}</div>
          </div>
          <div className={`cfv-kpi rest ${restPos ? 'pos' : 'neg'}`}>
            <div className="cfv-k">Останется</div>
            <div className="cfv-v">{restPos ? '' : '−'}{compact(Math.abs(coverage))}</div>
          </div>
        </div>
      </button>

      <div className="cfv-status">
        <span className={`cfv-pill ${restPos ? 'ok' : 'over'}`}>
          {restPos ? '✓ хватает' : `не хватает ${compact(Math.abs(coverage))}`}
        </span>
        {showProgress && (
          <span className={`cfv-prog${allPaid ? ' done' : ''}`}>
            {allPaid
              ? `✓ оплачено ${compact(paid)}`
              : `оплачено ${compact(paid)} из ${compact(obligations)} · осталось ${compact(leftToPay)}`}
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
              {items.length === 0 ? (
                <p className="cfv-empty">Платежей нет</p>
              ) : (
                <div className="cfv-rows">
                  {items.map((it) => (
                    <PaymentRow
                      key={`bill-${it.id}`}
                      item={it}
                      month={month}
                      toSegment={seg.index === 1 ? 2 : 1}
                      onEdit={onEdit}
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

function PaymentRow({
  item,
  month,
  toSegment,
  onEdit,
}: {
  item: CashflowItem
  month: string
  toSegment: number
  onEdit: (billId: number) => void
}) {
  const [armed, setArmed] = useState(false)
  const updateBill = useUpdateBill()
  const setPaid = useSetBillPaid()

  const toggle = () => {
    haptic('medium')
    setPaid.mutate({ id: item.id, month: item.originPeriod ?? month, paid: !item.paid })
  }

  const move = async () => {
    if (!armed) { setArmed(true); haptic('light'); return }
    try {
      await updateBill.mutateAsync({ id: item.id, body: { segmentOverride: toSegment } })
      haptic('medium')
    } catch {
      setArmed(false)
    }
  }

  return (
    <div className={`cfv-row${item.paid ? ' paid' : ''}`}>
      <button
        className={`bill-check${item.paid ? ' on' : ''}`}
        onClick={toggle}
        disabled={setPaid.isPending}
        aria-label={item.paid ? 'Снять отметку оплаты' : 'Отметить оплаченным'}
      >
        {item.paid ? '✓' : ''}
      </button>
      <button className="cfv-tap" onClick={() => { haptic('light'); onEdit(item.id) }}>
        <span className="cfv-em">{item.emoji ?? '📄'}</span>
        <span className="cfv-nm">
          <span className="cfv-nm-h">
            {item.overdue && <span className="cfv-od" aria-label="Просрочен" title="Просрочен">⚠️</span>}
            <b>
              {item.title}
              {item.overridden && !item.overdue && !item.paid && <span className="cfv-badge">перенесён</span>}
            </b>
          </span>
          <small>
            {item.paid ? `до ${item.day} числа · оплачено` : item.overdue && item.originLabel ? item.originLabel : `до ${item.day} числа`}
          </small>
        </span>
        <span className="cfv-amt">{money(item.amount)}</span>
      </button>
      {!item.paid && (
        <button
          className={`cfv-mv${armed ? ' armed' : ''}`}
          disabled={updateBill.isPending}
          onClick={move}
          aria-label="Перенести в другую половину"
        >
          {armed ? (toSegment === 2 ? 'во 2-ю?' : 'в 1-ю?') : '⇄'}
        </button>
      )}
    </div>
  )
}
