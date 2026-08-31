import { useRef, useState } from 'react'
import { budgetStatus, compact, fillClass, money } from '../lib/format'
import { useBudgetOverview, useSetBudget, useRenameSubcategory } from '../lib/queries'
import { SkeletonBlock, ErrorState, EmptyState } from '../components/States'
import { haptic } from '../lib/telegram'
import { ApiError } from '../lib/api'
import type { BudgetGroupView, BudgetSub } from '../types'

export function Budget() {
  const { data, isPending, isError, refetch } = useBudgetOverview()
  const [active, setActive] = useState(0)
  const [editing, setEditing] = useState<BudgetSub | null>(null)
  const carRef = useRef<HTMLDivElement>(null)

  // Тап по точке — мгновенный переход к панели. Плавный smooth-scroll на
  // scroll-snap:mandatory-контейнере ненадёжен (снап отменяет анимацию),
  // а свайп пальцем и так плавный (нативный). Прямое присваивание scrollLeft надёжно.
  const goto = (i: number) => {
    haptic('light')
    const el = carRef.current
    if (el) el.scrollLeft = i * el.clientWidth
    setActive(i)
  }

  const onScroll = () => {
    const el = carRef.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== active) setActive(i)
  }

  return (
    <>
      <header className="apphead">
        <div className="mo">Бюджет</div>
      </header>

      {isPending ? (
        <SkeletonBlock rows={5} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : data.length === 0 ? (
        <div className="block">
          <EmptyState emoji="🎯" title="Категорий пока нет" sub="Появятся после первого входа" />
        </div>
      ) : (
        <>
          {/* Карусель: одна «страница» = категория со своими подкатегориями.
              Название категории — заголовком внутри блока итога. Свайп + точки. */}
          <div className="bcar" ref={carRef} onScroll={onScroll}>
            {data.map((g) => (
              <CategoryPanel key={g.group} group={g} onEdit={setEditing} />
            ))}
          </div>

          {data.length > 1 && (
            <div className="bcat-dots">
              {data.map((g, i) => (
                <button
                  key={g.group}
                  className={i === active ? 'on' : ''}
                  aria-label={`К категории «${g.group}»`}
                  onClick={() => goto(i)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {editing && <EditSheet sub={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function CategoryPanel({ group, onEdit }: { group: BudgetGroupView; onEdit: (s: BudgetSub) => void }) {
  const st = budgetStatus(group.spent, group.limit)
  const pct = group.limit > 0 ? Math.min(100, Math.round((group.spent / group.limit) * 100)) : 0
  const noLimits = group.limit === 0
  return (
    <div className="bcar-panel">
      <div className="block">
        <div className="bgroup-head">
          <span className="bgroup-ic">{group.emoji}</span>
          {group.group}
        </div>
        <div className="bgroup-sum">
          <span>Итого по категории</span>
          <b>
            {compact(group.spent)}
            {group.limit > 0 ? ` / ${compact(group.limit)}` : ''}
          </b>
        </div>
        {group.limit > 0 && (
          <div className="bar" style={{ marginTop: 8 }}>
            <i className={fillClass[st]} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      <div className="block">
        {noLimits && (
          <p className="muted" style={{ fontSize: 12, margin: '0 0 10px' }}>
            Лимиты не заданы. Нажми на подкатегорию, чтобы задать лимит или переименовать её.
          </p>
        )}
        {group.subcategories.map((sub) => {
          const s = budgetStatus(sub.spent, sub.limit)
          const p = sub.limit > 0 ? Math.min(100, Math.round((sub.spent / sub.limit) * 100)) : 0
          return (
            <button
              key={sub.subcategoryId}
              className="budget-row"
              onClick={() => { haptic('light'); onEdit(sub) }}
            >
              <div className="catrow">
                <span className="ic">{sub.emoji}</span>
                <span className="nm">{sub.name}</span>
                <span className="am">
                  {sub.limit > 0 ? `${compact(sub.spent)} / ${compact(sub.limit)}` : `${compact(sub.spent)} · без лимита`} ✎
                </span>
              </div>
              {sub.limit > 0 && (
                <div className="bar">
                  <i className={fillClass[s]} style={{ width: `${p}%` }} />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EditSheet({ sub, onClose }: { sub: BudgetSub; onClose: () => void }) {
  const [name, setName] = useState(sub.name)
  const [amount, setAmount] = useState(sub.limit > 0 ? String(Math.round(sub.limit)) : '')
  const [err, setErr] = useState<string | null>(null)
  const rename = useRenameSubcategory()
  const setBudget = useSetBudget()
  const pending = rename.isPending || setBudget.isPending

  const save = async () => {
    const nm = name.trim()
    const amt = Number(amount || 0)
    if (!nm) { setErr('Название не может быть пустым'); return }
    if (!Number.isFinite(amt) || amt < 0) { setErr('Лимит должен быть числом ≥ 0'); return }
    setErr(null)
    try {
      if (nm !== sub.name) await rename.mutateAsync({ id: sub.subcategoryId, name: nm })
      if (amt !== Math.round(sub.limit)) await setBudget.mutateAsync({ categoryId: sub.subcategoryId, amount: amt })
      haptic('medium')
      onClose()
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 400 ? 'Такое название уже есть в этой категории' : 'Не удалось сохранить')
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <h4>{sub.emoji ? `${sub.emoji} ` : ''}Подкатегория</h4>

        <label className="sheet-label">Название</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <label className="sheet-label">Лимит в месяц, ₽ <span className="muted">(0 — без лимита)</span></label>
        <input
          className="input"
          inputMode="numeric"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
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
      </div>
    </div>
  )
}
