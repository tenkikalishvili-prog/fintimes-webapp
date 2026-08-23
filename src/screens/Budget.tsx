import { useState } from 'react'
import { budgetStatus, compact, fillClass, money } from '../lib/format'
import { useBudget, useSetBudget } from '../lib/queries'
import { SkeletonBlock, ErrorState, EmptyState } from '../components/States'
import { haptic } from '../lib/telegram'
import type { BudgetLine } from '../types'

export function Budget() {
  const { data, isPending, isError, refetch } = useBudget()
  const [editing, setEditing] = useState<BudgetLine | null>(null)

  return (
    <>
      <header className="apphead">
        <div className="mo">Бюджет · Траты</div>
      </header>

      {isPending ? (
        <SkeletonBlock rows={5} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : data.length === 0 ? (
        <div className="block">
          <EmptyState emoji="🎯" title="Бюджеты не заданы" sub="Лимиты по группе «Траты» появятся здесь" />
        </div>
      ) : (
        <>
          <div className="block">
            {data.map((line) => {
              const st = budgetStatus(line.spent, line.limit)
              const pct = line.limit > 0 ? Math.min(100, Math.round((line.spent / line.limit) * 100)) : 0
              return (
                <button
                  key={line.subcategoryId}
                  className="budget-row"
                  onClick={() => {
                    haptic('light')
                    setEditing(line)
                  }}
                >
                  <div className="catrow">
                    <span className="ic">{line.emoji}</span>
                    <span className="nm">{line.name}</span>
                    <span className="am">
                      {compact(line.spent)} / {compact(line.limit)} ✎
                    </span>
                  </div>
                  <div className="bar">
                    <i className={fillClass[st]} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              )
            })}
          </div>

          <div className="block center muted" style={{ fontSize: 12 }}>
            Итого траты: <b style={{ color: 'var(--text)' }}>{compact(sum(data, 'spent'))}</b> из{' '}
            <b style={{ color: 'var(--text)' }}>{compact(sum(data, 'limit'))}</b>
          </div>
        </>
      )}

      {editing && <EditBudgetSheet line={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function sum(lines: BudgetLine[], key: 'spent' | 'limit'): number {
  return lines.reduce((s, l) => s + l[key], 0)
}

function EditBudgetSheet({ line, onClose }: { line: BudgetLine; onClose: () => void }) {
  const [amount, setAmount] = useState(String(Math.round(line.limit)))
  const setBudget = useSetBudget()

  const save = () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value < 0) return
    setBudget.mutate(
      { categoryId: line.subcategoryId, amount: value },
      {
        onSuccess: () => {
          haptic('medium')
          onClose()
        },
      },
    )
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <h4>
          {line.emoji} {line.name} · лимит
        </h4>
        <input
          className="input"
          inputMode="numeric"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
          style={{ marginBottom: 12 }}
        />
        <button className="btn btn-primary" disabled={setBudget.isPending} onClick={save}>
          {setBudget.isPending ? 'Сохраняю…' : `Сохранить · ${money(Number(amount || 0))}`}
        </button>
      </div>
    </div>
  )
}
