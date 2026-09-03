import { useRef, useState } from 'react'
import { budgetStatus, compact, fillClass, money } from '../lib/format'
import {
  useBudgetOverview,
  useSetBudget,
  useRenameSubcategory,
  useRenameGroup,
  useCreateSubcategory,
  useDeleteSubcategory,
  useDeleteGroup,
} from '../lib/queries'
import { SkeletonBlock, ErrorState, EmptyState } from '../components/States'
import { haptic } from '../lib/telegram'
import { ApiError } from '../lib/api'
import type { Article, BudgetGroupView, BudgetSub } from '../types'

// Служебная группа расходов: по ней считается дневной лимит — удалять её нельзя.
const SERVICE_GROUP = 'Траты'

export function Budget() {
  // Статья экрана: расходы (с лимитами) или доходы (без лимитов, только суммы).
  const [article, setArticle] = useState<Article>('expense')
  const isIncome = article === 'income'

  const { data, isPending, isError, refetch } = useBudgetOverview(undefined, article)
  const [active, setActive] = useState(0)
  const [editing, setEditing] = useState<BudgetSub | null>(null)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null)
  const [addingGroup, setAddingGroup] = useState(false)
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

  // Переключение статьи: сбрасываем карусель в начало.
  const switchArticle = (a: Article) => {
    if (a === article) return
    haptic('light')
    setArticle(a)
    setActive(0)
    const el = carRef.current
    if (el) el.scrollLeft = 0
  }

  return (
    <>
      <header className="apphead">
        <div className="mo">{isIncome ? 'Доходы' : 'Бюджет'}</div>
        {data && data.length > 0 && (
          <button className="head-add" onClick={() => { haptic('light'); setAddingGroup(true) }}>
            ＋ Категория
          </button>
        )}
      </header>

      {/* Тумблер статьи. Расходы — с лимитами; Доходы — категории с суммами полученного. */}
      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={`s${!isIncome ? ' on' : ''}`} onClick={() => switchArticle('expense')}>
          Расходы
        </button>
        <button className={`s${isIncome ? ' on' : ''}`} onClick={() => switchArticle('income')}>
          Доходы
        </button>
      </div>

      {isPending ? (
        <SkeletonBlock rows={5} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : data.length === 0 ? (
        <div className="block">
          <EmptyState
            emoji={isIncome ? '💰' : '🎯'}
            title={isIncome ? 'Категорий доходов пока нет' : 'Категорий пока нет'}
            sub="Добавьте первую категорию"
          />
          <button className="btn btn-secondary" onClick={() => { haptic('light'); setAddingGroup(true) }}>
            ＋ Новая категория
          </button>
        </div>
      ) : (
        <>
          {/* Карусель: одна «страница» = категория со своими подкатегориями.
              Название категории — заголовком внутри блока итога. Свайп + точки. */}
          <div className="bcar" ref={carRef} onScroll={onScroll}>
            {data.map((g) => (
              <CategoryPanel
                key={g.group}
                group={g}
                isIncome={isIncome}
                onEdit={setEditing}
                onEditGroup={setEditingGroup}
                onAddSub={setAddingSubTo}
              />
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

      {editing && <EditSheet sub={editing} isIncome={isIncome} onClose={() => setEditing(null)} />}
      {editingGroup !== null && (
        <GroupSheet group={editingGroup} article={article} onClose={() => setEditingGroup(null)} />
      )}
      {addingSubTo !== null && (
        <AddSubSheet group={addingSubTo} article={article} onClose={() => setAddingSubTo(null)} />
      )}
      {addingGroup && <AddGroupSheet article={article} onClose={() => setAddingGroup(false)} />}
    </>
  )
}

function CategoryPanel({
  group,
  isIncome,
  onEdit,
  onEditGroup,
  onAddSub,
}: {
  group: BudgetGroupView
  isIncome: boolean
  onEdit: (s: BudgetSub) => void
  onEditGroup: (g: string) => void
  onAddSub: (g: string) => void
}) {
  const st = budgetStatus(group.spent, group.limit)
  const pct = group.limit > 0 ? Math.min(100, Math.round((group.spent / group.limit) * 100)) : 0
  const noLimits = group.limit === 0
  return (
    <div className="bcar-panel">
      <div className="block">
        <button className="bgroup-head" onClick={() => { haptic('light'); onEditGroup(group.group) }}>
          <span className="bgroup-ic">{group.emoji}</span>
          <span className="bgroup-name">{group.group}</span>
          <span className="bgroup-edit">✎</span>
        </button>
        <div className="bgroup-sum">
          <span>{isIncome ? 'Получено за месяц' : 'Итого по категории'}</span>
          <b>
            {compact(group.spent)}
            {!isIncome && group.limit > 0 ? ` / ${compact(group.limit)}` : ''}
          </b>
        </div>
        {!isIncome && group.limit > 0 && (
          <div className="bar" style={{ marginTop: 8 }}>
            <i className={fillClass[st]} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      <div className="block">
        {isIncome ? (
          <p className="muted" style={{ fontSize: 12, margin: '0 0 10px' }}>
            Суммы — сколько получено за месяц. Нажми на подкатегорию, чтобы переименовать или удалить её.
          </p>
        ) : noLimits ? (
          <p className="muted" style={{ fontSize: 12, margin: '0 0 10px' }}>
            Лимиты не заданы. Нажми на подкатегорию, чтобы задать лимит или переименовать её.
          </p>
        ) : null}
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
                  {isIncome
                    ? `${compact(sub.spent)} ✎`
                    : `${sub.limit > 0 ? `${compact(sub.spent)} / ${compact(sub.limit)}` : `${compact(sub.spent)} · без лимита`} ✎`}
                </span>
              </div>
              {!isIncome && sub.limit > 0 && (
                <div className="bar">
                  <i className={fillClass[s]} style={{ width: `${p}%` }} />
                </div>
              )}
            </button>
          )
        })}

        <button className="cat-add" onClick={() => { haptic('light'); onAddSub(group.group) }}>
          ＋ Подкатегория
        </button>
      </div>
    </div>
  )
}

function EditSheet({ sub, isIncome, onClose }: { sub: BudgetSub; isIncome: boolean; onClose: () => void }) {
  const [name, setName] = useState(sub.name)
  const [amount, setAmount] = useState(sub.limit > 0 ? String(Math.round(sub.limit)) : '')
  const [err, setErr] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const rename = useRenameSubcategory()
  const setBudget = useSetBudget()
  const del = useDeleteSubcategory()
  const pending = rename.isPending || setBudget.isPending || del.isPending

  const save = async () => {
    const nm = name.trim()
    const amt = Number(amount || 0)
    if (!nm) { setErr('Название не может быть пустым'); return }
    if (!isIncome && (!Number.isFinite(amt) || amt < 0)) { setErr('Лимит должен быть числом ≥ 0'); return }
    setErr(null)
    try {
      if (nm !== sub.name) await rename.mutateAsync({ id: sub.subcategoryId, name: nm })
      if (!isIncome && amt !== Math.round(sub.limit)) {
        await setBudget.mutateAsync({ categoryId: sub.subcategoryId, amount: amt })
      }
      haptic('medium')
      onClose()
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 400 ? 'Такое название уже есть в этой категории' : 'Не удалось сохранить')
    }
  }

  const remove = async () => {
    setErr(null)
    try {
      await del.mutateAsync(sub.subcategoryId)
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
        <h4>{sub.emoji ? `${sub.emoji} ` : ''}Подкатегория</h4>

        <label className="sheet-label">Название</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        {!isIncome && (
          <>
            <label className="sheet-label">Лимит в месяц, ₽ <span className="muted">(0 — без лимита)</span></label>
            <input
              className="input"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
              style={{ marginBottom: 14 }}
            />
          </>
        )}

        {err && (
          <div className="toast over" style={{ marginBottom: 12 }}>
            <span className="ti">⚠️</span>
            <span>{err}</span>
          </div>
        )}

        <button className="btn btn-primary" disabled={pending} onClick={save}>
          {pending ? 'Сохраняю…' : isIncome ? 'Сохранить' : `Сохранить · ${money(Number(amount || 0))}`}
        </button>

        {confirmDel ? (
          <>
            <p className="del-note">
              Если по подкатегории есть операции — она уйдёт в архив (история сохранится).
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
            Удалить подкатегорию
          </button>
        )}
      </div>
    </div>
  )
}

function GroupSheet({ group, article, onClose }: { group: string; article: Article; onClose: () => void }) {
  const [name, setName] = useState(group)
  const [err, setErr] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const rename = useRenameGroup()
  const del = useDeleteGroup()
  // Служебная «Траты» защищена только среди расходов.
  const isService = article === 'expense' && group === SERVICE_GROUP
  const pending = rename.isPending || del.isPending

  const save = async () => {
    const nm = name.trim()
    if (!nm) { setErr('Название не может быть пустым'); return }
    if (nm === group) { onClose(); return }
    setErr(null)
    try {
      await rename.mutateAsync({ oldName: group, newName: nm, article })
      haptic('medium')
      onClose()
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 400 ? 'Категория с таким названием уже есть' : 'Не удалось сохранить')
    }
  }

  const remove = async () => {
    setErr(null)
    try {
      await del.mutateAsync({ article, name: group })
      haptic('medium')
      onClose()
    } catch {
      setErr('Не удалось удалить категорию')
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <h4>Название категории</h4>
        <label className="sheet-label">Переименование затронет все подкатегории внутри</label>
        <input
          className="input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ marginBottom: 14 }}
        />
        {err && (
          <div className="toast over" style={{ marginBottom: 12 }}>
            <span className="ti">⚠️</span>
            <span>{err}</span>
          </div>
        )}
        <button className="btn btn-primary" disabled={pending} onClick={save}>
          {rename.isPending ? 'Сохраняю…' : 'Сохранить'}
        </button>

        {isService ? (
          <p className="del-note">
            Категорию «{SERVICE_GROUP}» удалить нельзя — по ней считается дневной лимит.
          </p>
        ) : confirmDel ? (
          <>
            <p className="del-note">
              Удалить категорию со всеми подкатегориями? Те, по которым есть операции,
              уйдут в архив (история сохранится).
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
            Удалить категорию
          </button>
        )}
      </div>
    </div>
  )
}

function AddSubSheet({ group, article, onClose }: { group: string; article: Article; onClose: () => void }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const create = useCreateSubcategory()

  const save = async () => {
    const nm = name.trim()
    if (!nm) { setErr('Введите название'); return }
    setErr(null)
    try {
      await create.mutateAsync({ article, group, name: nm, emoji: emoji.trim() || undefined })
      haptic('medium')
      onClose()
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 400 ? 'Такая подкатегория уже есть' : 'Не удалось создать')
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <h4>Новая подкатегория</h4>
        <label className="sheet-label">Категория: {group}</label>

        <div className="add-row">
          <input
            className="input add-emoji"
            placeholder="🙂"
            value={emoji}
            maxLength={2}
            onChange={(e) => setEmoji(e.target.value)}
          />
          <input
            className="input"
            autoFocus
            placeholder="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {err && (
          <div className="toast over" style={{ margin: '12px 0 0' }}>
            <span className="ti">⚠️</span>
            <span>{err}</span>
          </div>
        )}

        <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={create.isPending} onClick={save}>
          {create.isPending ? 'Создаю…' : 'Добавить'}
        </button>
      </div>
    </div>
  )
}

function AddGroupSheet({ article, onClose }: { article: Article; onClose: () => void }) {
  const [group, setGroup] = useState('')
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const create = useCreateSubcategory()
  const isIncome = article === 'income'

  const save = async () => {
    const gr = group.trim()
    const nm = name.trim()
    if (!gr) { setErr('Введите название категории'); return }
    if (!nm) { setErr('Введите название первой подкатегории'); return }
    setErr(null)
    try {
      await create.mutateAsync({ article, group: gr, name: nm, emoji: emoji.trim() || undefined })
      haptic('medium')
      onClose()
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 400 ? 'Такая подкатегория уже есть' : 'Не удалось создать')
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <h4>{isIncome ? 'Новая категория дохода' : 'Новая категория'}</h4>
        <label className="sheet-label">Категория объединяет подкатегории. Добавьте первую подкатегорию сразу.</label>

        <input
          className="input"
          autoFocus
          placeholder="Название категории"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <label className="sheet-label">Первая подкатегория</label>
        <div className="add-row">
          <input
            className="input add-emoji"
            placeholder="🙂"
            value={emoji}
            maxLength={2}
            onChange={(e) => setEmoji(e.target.value)}
          />
          <input
            className="input"
            placeholder="Название подкатегории"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {err && (
          <div className="toast over" style={{ margin: '12px 0 0' }}>
            <span className="ti">⚠️</span>
            <span>{err}</span>
          </div>
        )}

        <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={create.isPending} onClick={save}>
          {create.isPending ? 'Создаю…' : 'Создать категорию'}
        </button>
      </div>
    </div>
  )
}
