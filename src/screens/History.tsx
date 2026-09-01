import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategories, useDeleteTransaction, useHistory } from '../lib/queries'
import { SkeletonBlock, ErrorState, EmptyState } from '../components/States'
import { haptic } from '../lib/telegram'
import { money, dayHeading, monthTitle, currentMonth, shiftMonth } from '../lib/format'
import type { Article, HistoryFilters, Transaction } from '../types'
import type { ReactNode } from 'react'

type TypeFilter = 'all' | Article

const TYPE_PILLS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'expense', label: 'Расход' },
  { key: 'income', label: 'Доход' },
  { key: 'debt', label: 'Долг' },
]

/** Полный экран истории операций: период, тип, категория, поиск, подгрузка, удаление. */
export function History() {
  const navigate = useNavigate()
  const del = useDeleteTransaction()

  const [month, setMonth] = useState<string | undefined>(currentMonth())
  const [type, setType] = useState<TypeFilter>('all')
  const [group, setGroup] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')

  // Поиск с задержкой — не дёргаем API на каждой букве.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  // Категории для чипов показываем только когда выбран конкретный тип (внутри статьи).
  const catArticle: Article = type === 'all' ? 'expense' : type
  const cats = useCategories(catArticle)

  const filters: HistoryFilters = useMemo(
    () => ({
      month,
      article: type === 'all' ? undefined : type,
      group: group || undefined,
      q: debouncedQ || undefined,
    }),
    [month, type, group, debouncedQ],
  )

  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useHistory(filters)

  const items = useMemo(() => data?.pages.flat() ?? [], [data])

  // Сводка по загруженным операциям.
  const summary = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of items) {
      if (t.article === 'income') income += t.amount
      else if (t.article === 'expense') expense += t.amount
    }
    return { count: items.length, income, expense }
  }, [items])

  const cur = currentMonth()

  const pickType = (key: TypeFilter) => {
    haptic('light')
    setType(key)
    setGroup(undefined) // категории привязаны к статье — сбрасываем при смене типа
  }

  const remove = (id: number, label: string) => {
    haptic('medium')
    if (confirm(`Удалить «${label}»?`)) del.mutate(id)
  }

  const openEdit = (t: Transaction) => {
    haptic('light')
    navigate(`/edit/${t.id}`, { state: { tx: t } })
  }

  return (
    <div className="app-shell">
      <div className="app-body no-tabbar">
        <div className="modal-head">
          <div className="mo">История</div>
          <button className="close" onClick={() => navigate(-1)} aria-label="Закрыть">
            ✕
          </button>
        </div>

        {/* Период */}
        <div className="hist-period">
          <button className="hp-nav" disabled={!month} onClick={() => setMonth(shiftMonth(month!, -1))} aria-label="Раньше">
            ‹
          </button>
          <span className="hp-lbl">{month ? monthTitle(month) : 'Все операции'}</span>
          <button
            className="hp-nav"
            disabled={!month || month >= cur}
            onClick={() => setMonth(shiftMonth(month!, 1))}
            aria-label="Позже"
          >
            ›
          </button>
          <button
            className="hp-all"
            onClick={() => {
              haptic('light')
              setMonth(month ? undefined : cur)
            }}
          >
            {month ? 'Всё время' : 'По месяцам'}
          </button>
        </div>

        {/* Поиск */}
        <div className="hist-search">
          <span className="hs-ic">🔎</span>
          <input
            className="hs-input"
            placeholder="Поиск по названию или заметке"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="hs-clear" onClick={() => setSearch('')} aria-label="Очистить">
              ✕
            </button>
          )}
        </div>

        {/* Тип */}
        <div className="chips-scroll">
          <div className="pills">
            {TYPE_PILLS.map((p) => (
              <button key={p.key} className={`pill${type === p.key ? ' on' : ''}`} onClick={() => pickType(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Категории (в рамках выбранного типа) */}
        {type !== 'all' && (cats.data?.length ?? 0) > 0 && (
          <div className="chips-scroll">
            <div className="pills">
              <button className={`pill${!group ? ' on' : ''}`} onClick={() => { haptic('light'); setGroup(undefined) }}>
                Все категории
              </button>
              {cats.data!.map((c) => (
                <button
                  key={c.group}
                  className={`pill${group === c.group ? ' on' : ''}`}
                  onClick={() => { haptic('light'); setGroup(c.group) }}
                >
                  {c.emoji ? `${c.emoji} ` : ''}{c.group}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Список */}
        {isPending ? (
          <SkeletonBlock rows={6} />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : items.length === 0 ? (
          <EmptyState
            emoji="🗒️"
            title="Ничего не найдено"
            sub={debouncedQ || group || type !== 'all' ? 'Смягчи фильтры или поиск' : 'Добавь первую операцию по кнопке ＋'}
          />
        ) : (
          <>
            <div className="hist-summary">
              <span>{summary.count} {plural(summary.count, 'операция', 'операции', 'операций')}</span>
              <span className="hs-nums">
                {summary.expense > 0 && <b className="hs-out">−{money(summary.expense).replace('−', '')}</b>}
                {summary.income > 0 && <b className="hs-in">+{money(summary.income).replace('−', '')}</b>}
              </span>
            </div>

            <div className="block hist-list">
              {renderGrouped(items, remove, openEdit)}
            </div>

            {hasNextPage && (
              <button
                className="more-btn"
                disabled={isFetchingNextPage}
                onClick={() => { haptic('light'); fetchNextPage() }}
              >
                {isFetchingNextPage ? 'Загрузка…' : 'Показать ещё'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** Рендер списка с заголовками-днями (данные уже отсортированы: новые сверху).
 *  Тап по строке → редактирование; ✕ — быстрое удаление (не открывает редактор). */
function renderGrouped(
  items: Transaction[],
  remove: (id: number, label: string) => void,
  openEdit: (t: Transaction) => void,
) {
  const out: ReactNode[] = []
  let lastDay = ''
  for (const t of items) {
    if (t.date !== lastDay) {
      lastDay = t.date
      out.push(
        <div className="hist-day" key={`d-${t.date}`}>
          {dayHeading(t.date)}
        </div>,
      )
    }
    out.push(
      <div className="txrow tap" key={t.id} onClick={() => openEdit(t)}>
        <div className="tic">{t.emoji ?? '💸'}</div>
        <div className="tmid">
          <div className="tname">{t.subcategoryName}</div>
          <div className="tmeta">
            {t.categoryName}
            {t.comment ? ` · ${t.comment}` : ''}
          </div>
        </div>
        <div className={`tamt${t.article === 'income' ? ' plus' : ''}`}>
          {t.article === 'income' ? '+' : '−'}
          {money(t.amount).replace('−', '')}
        </div>
        <button
          className="tx-del"
          aria-label="Удалить"
          onClick={(e) => {
            e.stopPropagation()
            remove(t.id, `${t.subcategoryName} ${money(t.amount)}`)
          }}
        >
          ✕
        </button>
      </div>,
    )
  }
  return out
}

/** Русское склонение по числу: 1 операция / 2 операции / 5 операций. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
