import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Article, CategoryGroup, Subcategory } from '../types'
import { ARTICLE_LABELS } from '../types'
import { useCategories, useCreateTransaction } from '../lib/queries'
import { SkeletonBlock, ErrorState } from '../components/States'
import { haptic } from '../lib/telegram'
import { money } from '../lib/format'

const ARTICLES: Article[] = ['expense', 'income', 'debt']

/** Двухшаговый ввод: Статья → Категория(группа) → Подкатегория → Сумма. */
export function AddTransaction() {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [article, setArticle] = useState<Article>('expense')
  const [amount, setAmount] = useState('')
  const [group, setGroup] = useState<CategoryGroup | null>(null)
  const [sub, setSub] = useState<Subcategory | null>(null)

  const cats = useCategories(article)
  const create = useCreateTransaction()

  const close = () => navigate(-1)

  const pickGroup = (g: CategoryGroup) => {
    haptic('light')
    setGroup(g)
    setStep(2)
  }

  const canSave = Boolean(amount && sub) && !create.isPending

  const save = () => {
    if (!sub) return
    create.mutate(
      { categoryId: sub.id, amount: Number(amount), comment: undefined },
      {
        onSuccess: () => {
          haptic('medium')
          close()
        },
      },
    )
  }

  return (
    <div className="app-shell">
      <div className="app-body no-tabbar">
        {step === 1 ? (
          <>
            <div className="modal-head">
              <div className="mo">Новая операция</div>
              <button className="close" onClick={close} aria-label="Закрыть">
                ✕
              </button>
            </div>

            <div className="seg" style={{ marginBottom: 16 }}>
              {ARTICLES.map((a) => (
                <button
                  key={a}
                  className={`s${article === a ? ' on' : ''}`}
                  onClick={() => {
                    setArticle(a)
                    setGroup(null)
                    setSub(null)
                  }}
                >
                  {ARTICLE_LABELS[a]}
                </button>
              ))}
            </div>

            <div className="amount-in">
              <input
                className="a"
                inputMode="numeric"
                placeholder="0 ₽"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                style={{ background: 'none', border: 'none', textAlign: 'center', color: 'var(--text)', width: '100%' }}
              />
              <div className="c">введите сумму</div>
            </div>

            <div className="faint" style={{ fontSize: 11, margin: '0 0 8px' }}>
              Категория
            </div>

            {cats.isPending ? (
              <SkeletonBlock rows={4} />
            ) : cats.isError ? (
              <ErrorState onRetry={cats.refetch} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cats.data.map((g) => (
                  <button key={g.group} className="field" onClick={() => pickGroup(g)}>
                    <span className="val">
                      {g.emoji} {g.group}
                    </span>
                    <span className="faint">›</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="modal-head">
              <button className="crumbs" onClick={() => setStep(1)}>
                ‹ {ARTICLE_LABELS[article]} › {group?.emoji} {group?.group}
              </button>
              <button className="close" onClick={close} aria-label="Закрыть">
                ✕
              </button>
            </div>

            <div className="mo" style={{ margin: '2px 0 14px' }}>
              Подкатегория
            </div>
            <div className="grid-cat" style={{ marginBottom: 14 }}>
              {group?.subcategories.map((s) => (
                <button
                  key={s.id}
                  className={`cchip${sub?.id === s.id ? ' on' : ''}`}
                  onClick={() => {
                    haptic('light')
                    setSub(s)
                  }}
                >
                  <span className="e">{s.emoji}</span>
                  {s.name}
                </button>
              ))}
            </div>

            {create.isError && (
              <div className="toast over" style={{ marginBottom: 12 }}>
                <span className="ti">⚠️</span>
                <span>Не удалось сохранить. Попробуй ещё раз.</span>
              </div>
            )}

            <button className="btn btn-primary" disabled={!canSave} onClick={save}>
              {create.isPending ? 'Сохраняю…' : `Сохранить${amount ? ` · ${money(Number(amount))}` : ''}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
