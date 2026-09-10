import { money } from '../lib/format'
import type { CashflowItem } from '../types'

/**
 * Красный блок «Просрочено» — неоплаченные обязательства прошлых месяцев.
 * Общий для «Аналитики» (только чтение) и «Платежей» (с галочками).
 *
 * `onToggle` включает режим с галочками; вызывающий передаёт УЖЕ отфильтрованные
 * элементы (на «Платежах» — только `kind === 'bill'`). Без `onToggle` — только показ.
 */
export function OverdueBlock({
  items,
  onToggle,
  busy = false,
}: {
  items: CashflowItem[]
  onToggle?: (item: CashflowItem) => void
  busy?: boolean
}) {
  if (items.length === 0) return null
  const total = items.reduce((s, it) => s + it.amount, 0)

  return (
    <div className="ovd">
      <div className="ovd-head">
        <span className="ovd-cap">⚠️ Просрочено <span className="n">· {items.length}</span></span>
        <span className="ovd-sum">{money(total)}</span>
      </div>
      <div className="ovd-hint">
        {onToggle
          ? 'Платежи прошлых месяцев, оставшиеся неоплаченными. Отметьте галочкой, когда погасите.'
          : 'Неоплаченные платежи и долги прошлых месяцев.'}
      </div>
      {items.map((it) => (
        <div className="ovd-row" key={`${it.kind}-${it.id}-${it.originPeriod ?? ''}`}>
          {onToggle && (
            <button
              className="ovd-check"
              disabled={busy}
              onClick={() => onToggle(it)}
              aria-label="Отметить оплаченным"
            />
          )}
          <span className="ovd-em">{it.emoji ?? (it.kind === 'debt' ? '🤝' : '📄')}</span>
          <span className="ovd-mid">
            <span className="ovd-title">{it.title}</span>
            <span className="ovd-meta">просрочено · {it.originLabel ?? `до ${it.day} числа`}</span>
          </span>
          <span className="ovd-amt">{money(it.amount)}</span>
        </div>
      ))}
    </div>
  )
}
