import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Article, CategoryGroup, Subcategory } from '../types'
import { ARTICLE_LABELS } from '../types'
import { useCategories, useCreateTransaction, useSmartParse } from '../lib/queries'
import { SkeletonBlock, ErrorState } from '../components/States'
import { haptic } from '../lib/telegram'
import { money } from '../lib/format'

const ARTICLES: Article[] = ['expense', 'income', 'debt']

/** Двухшаговый ввод: Статья → Категория(группа) → Подкатегория → Сумма.
 *  Плюс поле умного ввода: «кофе 350» → предзаполняет сумму, статью и категорию. */
export function AddTransaction() {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [article, setArticle] = useState<Article>('expense')
  const [amount, setAmount] = useState('')
  const [group, setGroup] = useState<CategoryGroup | null>(null)
  const [sub, setSub] = useState<Subcategory | null>(null)

  // ── Умный ввод ───────────────────────────────────────────────────────
  const [smartText, setSmartText] = useState('')
  const [smartNote, setSmartNote] = useState<string | null>(null)
  // Отложенный матч: подкатегория придёт из разбора, а список категорий
  // нужной статьи может ещё грузиться после смены article — резолвим в эффекте
  // (state, а не ref: смена должна перезапускать эффект).
  const [pendingMatch, setPendingMatch] = useState<{ group: string; subId: number } | null>(null)
  const smart = useSmartParse()

  const cats = useCategories(article)
  const create = useCreateTransaction()

  // Как только загрузились категории нужной статьи — применяем отложенный матч.
  useEffect(() => {
    if (!pendingMatch || cats.isPending || !cats.data) return
    const g = cats.data.find((x) => x.group === pendingMatch.group)
    const s = g?.subcategories.find((x) => x.id === pendingMatch.subId)
    if (g && s) {
      setGroup(g)
      setSub(s)
      setStep(2)
      haptic('medium')
    }
    setPendingMatch(null) // резолвили (или не нашли) — не повторяем
  }, [pendingMatch, cats.data, cats.isPending])

  const runSmart = async () => {
    const text = smartText.trim()
    if (!text || smart.isPending) return
    setSmartNote(null)
    try {
      const res = await smart.mutateAsync(text)
      if (res.amount != null) setAmount(String(res.amount))
      setArticle(res.article)
      if (res.matched && res.categoryId != null && res.group && res.amount != null) {
        // Есть и сумма, и категория → прыгаем на шаг 2, готово к сохранению.
        setPendingMatch({ group: res.group, subId: res.categoryId })
        setSmartText('')
      } else if (res.amount == null) {
        setSmartNote('Не понял сумму — впиши её вручную ниже 👇')
      } else {
        setSmartNote(`Сумму понял (${money(res.amount)}), а категорию — нет. Выбери ниже 👇`)
        setSmartText('')
      }
    } catch {
      setSmartNote('Не удалось разобрать. Попробуй ещё раз или введи вручную.')
    }
  }

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

            <div className="smart-add">
              <div className="smart-row">
                <span className="smart-ico">✨</span>
                <input
                  className="smart-input"
                  placeholder="кофе 350, такси 420, зарплата…"
                  value={smartText}
                  onChange={(e) => {
                    setSmartText(e.target.value)
                    if (smartNote) setSmartNote(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runSmart()
                  }}
                  enterKeyHint="done"
                />
                <button
                  className="smart-go"
                  onClick={runSmart}
                  disabled={!smartText.trim() || smart.isPending}
                  aria-label="Разобрать"
                >
                  {smart.isPending ? '…' : '→'}
                </button>
              </div>
              {smartNote && <div className="smart-note">{smartNote}</div>}
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
              <div className="c">введите сумму</div>
            </div>

            <div className="fieldlbl">Категория</div>

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
