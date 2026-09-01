import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Article, CategoryGroup, Subcategory, Transaction } from '../types'
import { ARTICLE_LABELS } from '../types'
import { useCategories, useDeleteTransaction, useUpdateTransaction } from '../lib/queries'
import { SkeletonBlock, ErrorState } from '../components/States'
import { haptic } from '../lib/telegram'
import { money } from '../lib/format'

const ARTICLES: Article[] = ['expense', 'income', 'debt']

/**
 * Одношаговое редактирование операции: сумма, тип, категория/подкатегория,
 * дата, заметка. Операция приходит из «Истории» через router state.
 */
export function EditTransaction() {
  const navigate = useNavigate()
  const location = useLocation()
  const tx = (location.state as { tx?: Transaction } | null)?.tx

  const [article, setArticle] = useState<Article>(tx?.article ?? 'expense')
  const [amount, setAmount] = useState(tx ? String(Math.round(tx.amount)) : '')
  const [group, setGroup] = useState<CategoryGroup | null>(null)
  const [sub, setSub] = useState<Subcategory | null>(null)
  const [comment, setComment] = useState(tx?.comment ?? '')
  const [date, setDate] = useState(tx?.date ?? '')
  // Отложенный матч исходной подкатегории: ждём, пока загрузятся категории статьи.
  const [pendingMatch, setPendingMatch] = useState<{ group: string; subId: number } | null>(
    tx ? { group: tx.categoryName, subId: tx.categoryId } : null,
  )

  const cats = useCategories(article)
  const update = useUpdateTransaction()
  const del = useDeleteTransaction()

  // Нет операции в state (прямой переход по ссылке) — возвращаемся назад.
  useEffect(() => {
    if (!tx) navigate('/history', { replace: true })
  }, [tx, navigate])

  // Как только категории статьи загрузились — восстанавливаем исходный выбор.
  useEffect(() => {
    if (!pendingMatch || cats.isPending || !cats.data) return
    const g = cats.data.find((x) => x.group === pendingMatch.group)
    const s = g?.subcategories.find((x) => x.id === pendingMatch.subId)
    if (g) setGroup(g)
    if (g && s) setSub(s)
    setPendingMatch(null)
  }, [pendingMatch, cats.data, cats.isPending])

  if (!tx) return null

  const close = () => navigate(-1)

  const changeArticle = (a: Article) => {
    if (a === article) return
    haptic('light')
    setArticle(a)
    setGroup(null)
    setSub(null)
    setPendingMatch(null)
  }

  const pickGroup = (g: CategoryGroup) => {
    haptic('light')
    setGroup(g)
    setSub(null)
  }

  const canSave = Boolean(amount && sub) && !update.isPending
  const changed =
    Number(amount) !== Math.round(tx.amount) ||
    sub?.id !== tx.categoryId ||
    (comment.trim() || null) !== (tx.comment || null) ||
    date !== tx.date

  const save = () => {
    if (!sub) return
    update.mutate(
      {
        id: tx.id,
        body: { amount: Number(amount), categoryId: sub.id, date, comment: comment.trim() },
      },
      {
        onSuccess: () => {
          haptic('medium')
          close()
        },
      },
    )
  }

  const remove = () => {
    haptic('medium')
    if (!confirm(`Удалить «${tx.subcategoryName} ${money(tx.amount)}»?`)) return
    del.mutate(tx.id, { onSuccess: () => { haptic('medium'); close() } })
  }

  return (
    <div className="app-shell">
      <div className="app-body no-tabbar">
        <div className="modal-head">
          <div className="mo">Изменить операцию</div>
          <button className="close" onClick={close} aria-label="Закрыть">
            ✕
          </button>
        </div>

        {/* Сумма */}
        <div className="amount-in">
          <div className="a-row">
            <input
              className="a a-input"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
              style={{ width: `${Math.max(1, amount.length)}ch` }}
            />
            <span className="a cur">₽</span>
          </div>
          <div className="c">сумма операции</div>
        </div>

        {/* Тип */}
        <div className="seg" style={{ marginBottom: 16 }}>
          {ARTICLES.map((a) => (
            <button key={a} className={`s${article === a ? ' on' : ''}`} onClick={() => changeArticle(a)}>
              {ARTICLE_LABELS[a]}
            </button>
          ))}
        </div>

        {cats.isPending ? (
          <SkeletonBlock rows={4} />
        ) : cats.isError ? (
          <ErrorState onRetry={cats.refetch} />
        ) : (
          <>
            {/* Категория */}
            <div className="fieldlbl">Категория</div>
            <div className="chips-scroll">
              <div className="pills">
                {cats.data.map((g) => (
                  <button
                    key={g.group}
                    className={`pill${group?.group === g.group ? ' on' : ''}`}
                    onClick={() => pickGroup(g)}
                  >
                    {g.emoji ? `${g.emoji} ` : ''}{g.group}
                  </button>
                ))}
              </div>
            </div>

            {/* Подкатегория */}
            {group && (
              <>
                <div className="fieldlbl">Подкатегория</div>
                <div className="grid-cat" style={{ marginBottom: 14 }}>
                  {group.subcategories.map((s) => (
                    <button
                      key={s.id}
                      className={`cchip${sub?.id === s.id ? ' on' : ''}`}
                      onClick={() => { haptic('light'); setSub(s) }}
                    >
                      <span className="e">{s.emoji}</span>
                      {s.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Дата и заметка */}
        <div className="fieldlbl">Дата</div>
        <input
          className="input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <div className="fieldlbl">Заметка</div>
        <input
          className="input"
          placeholder="комментарий (необязательно)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{ marginBottom: 16 }}
        />

        {update.isError && (
          <div className="toast over" style={{ marginBottom: 12 }}>
            <span className="ti">⚠️</span>
            <span>Не удалось сохранить. Попробуй ещё раз.</span>
          </div>
        )}

        <button className="btn btn-primary" disabled={!canSave || !changed} onClick={save}>
          {update.isPending ? 'Сохраняю…' : 'Сохранить изменения'}
        </button>
        <button className="btn btn-danger" onClick={remove} style={{ marginTop: 10 }}>
          {del.isPending ? 'Удаляю…' : 'Удалить операцию'}
        </button>
      </div>
    </div>
  )
}
