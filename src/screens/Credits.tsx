import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useCreateCredit,
  useCredits,
  useDeleteCredit,
  useSetCreditFund,
  useUpdateCredit,
} from '../lib/queries'
import { SkeletonBlock, ErrorState, EmptyState } from '../components/States'
import { haptic } from '../lib/telegram'
import { money, onlyDigits, groupDigits } from '../lib/format'
import type { Credit, CreditInput, CreditKind, CreditUpdateInput } from '../types'

/** Сортировка списка: по телу (остатку) или по ежемесячному платежу, в обе стороны. */
type SortKey = 'body-asc' | 'body-desc' | 'pay-asc' | 'pay-desc'

const SORT_OPTIONS: { key: SortKey; group: string; label: string }[] = [
  { key: 'body-asc', group: 'Тело', label: 'меньше → больше' },
  { key: 'body-desc', group: 'Тело', label: 'больше → меньше' },
  { key: 'pay-asc', group: 'Платёж', label: 'меньше → больше' },
  { key: 'pay-desc', group: 'Платёж', label: 'больше → меньше' },
]

const KIND_LABEL: Record<CreditKind, string> = { credit: 'Кредит', card: 'Кредитка' }

function sortCredits(items: Credit[], key: SortKey): Credit[] {
  const dir = key.endsWith('asc') ? 1 : -1
  const val = (c: Credit) => (key.startsWith('body') ? c.remaining : c.monthlyPayment)
  return [...items].sort((a, b) => dir * (val(a) - val(b)) || a.id - b.id)
}

/** Раздел «Кредиты»: фонд досрочного погашения, общий долг, высвободившиеся платежи, список. */
export function Credits() {
  const navigate = useNavigate()
  const { data, isPending, isError, refetch } = useCredits()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Credit | null>(null)
  const [sort, setSort] = useState<SortKey>('body-asc')
  const [menu, setMenu] = useState(false)

  const list = useMemo(() => sortCredits(data?.items ?? [], sort), [data, sort])
  const activeCount = (data?.items ?? []).filter((c) => !c.isClosed).length
  const closedCount = (data?.items ?? []).length - activeCount

  return (
    <div className="app-shell">
      <div className="app-body no-tabbar">
        <div className="modal-head">
          <div className="mo">Кредиты</div>
          <button className="close" onClick={() => navigate(-1)} aria-label="Закрыть">
            ✕
          </button>
        </div>

        {isPending ? (
          <SkeletonBlock rows={4} />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : (
          <>
            <FundCard fund={data.fund} />

            <div className="cr-pair">
              <div className="cr-card">
                <span className="cr-cap">Общий долг</span>
                <span className="cr-big">{money(data.totalDebt)}</span>
                <span className="cr-sub">{activeCount} активных</span>
              </div>
              <div className="cr-card">
                <span className="cr-cap">Высвободившиеся платежи</span>
                <span className="cr-big ok">{money(data.freedPayments)}</span>
                <span className="cr-sub">
                  {closedCount > 0 ? `от ${closedCount} погашенных` : 'нет погашенных'}
                </span>
              </div>
            </div>

            <div className="cr-listhead">
              <b>Список кредитов</b>
              <div className="cr-count">
                {data.items.length}
                <button
                  className={`cr-filter${menu ? ' on' : ''}`}
                  onClick={() => { haptic('light'); setMenu(!menu) }}
                  aria-label="Сортировка"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.4" strokeLinecap="round">
                    <path d="M4 6h16M7 12h10M10 18h4" />
                  </svg>
                </button>
              </div>
              {menu && (
                <div className="cr-menu">
                  {['Тело', 'Платёж'].map((g) => (
                    <div key={g}>
                      <div className="cr-menu-g">{g}</div>
                      {SORT_OPTIONS.filter((o) => o.group === g).map((o) => (
                        <button
                          key={o.key}
                          className={`cr-menu-o${sort === o.key ? ' on' : ''}`}
                          onClick={() => { haptic('light'); setSort(o.key); setMenu(false) }}
                        >
                          {o.label}
                          {sort === o.key && <span>✓</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {list.length === 0 ? (
              <EmptyState
                emoji="💳"
                title="Кредитов пока нет"
                sub="Добавьте кредит или кредитку: тело долга и ежемесячный платёж. Закрытые кредиты высвободят платёж"
              />
            ) : (
              <div className="cr-list">
                {list.map((c) => (
                  <button
                    key={c.id}
                    className={`cr-loan ${c.kind}${c.isClosed ? ' closed' : ''}`}
                    onClick={() => { haptic('light'); setEditing(c) }}
                  >
                    <div className="cr-row">
                      <div className="cr-nm">
                        <span className="cr-kind">{KIND_LABEL[c.kind]}</span>
                        <b>{c.bank}</b>
                        <small>платёж {money(c.monthlyPayment)}/мес</small>
                      </div>
                      <div className="cr-amt">
                        {money(c.remaining)}
                        <small>тело долга</small>
                      </div>
                    </div>
                    {c.isClosed && (
                      <div className="cr-done">✓ Погашен · +{money(c.monthlyPayment)}/мес высвобождено</div>
                    )}
                  </button>
                ))}
              </div>
            )}

            <button
              className="btn btn-secondary"
              style={{ marginTop: 14 }}
              onClick={() => { haptic('light'); setAdding(true) }}
            >
              ＋ Добавить кредит
            </button>
          </>
        )}
      </div>

      {adding && <CreditSheet onClose={() => setAdding(false)} />}
      {editing && <CreditSheet credit={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** Плитка фонда: сумма + «Изменить» → поле ввода. */
function FundCard({ fund }: { fund: number }) {
  const [edit, setEdit] = useState(false)
  const [val, setVal] = useState('')
  const setFund = useSetCreditFund()

  const start = () => { haptic('light'); setVal(fund ? String(Math.round(fund)) : ''); setEdit(true) }
  const save = async () => {
    try {
      await setFund.mutateAsync(Number(val || 0))
      haptic('medium')
      setEdit(false)
    } catch {
      /* остаёмся в режиме ввода — пользователь может повторить */
    }
  }

  return (
    <div className="cr-fund">
      <div className="cr-fund-top">
        <span className="cr-cap">Фонд досрочного погашения</span>
        {!edit && (
          <button className="cr-mini" onClick={start}>Изменить</button>
        )}
      </div>
      {edit ? (
        <div className="cr-fund-edit">
          <input
            className="input"
            inputMode="numeric"
            autoFocus
            placeholder="0"
            value={groupDigits(val)}
            onChange={(e) => setVal(onlyDigits(e.target.value))}
          />
          <button className="btn btn-primary cr-save" disabled={setFund.isPending} onClick={save}>
            {setFund.isPending ? '…' : 'Сохранить'}
          </button>
        </div>
      ) : (
        <>
          <div className="cr-fund-amt">{money(fund)}</div>
          <div className="cr-sub">
            {fund > 0 ? 'в месяц · рекомендуемая сумма' : 'Задайте сумму, которую готовы направлять на досрочку'}
          </div>
        </>
      )}
    </div>
  )
}

/** Bottom-sheet создания/редактирования кредита. Без `credit` — создание. */
function CreditSheet({ credit, onClose }: { credit?: Credit; onClose: () => void }) {
  const isEdit = !!credit
  const [kind, setKind] = useState<CreditKind>(credit?.kind ?? 'credit')
  const [bank, setBank] = useState(credit?.bank ?? '')
  const [amount, setAmount] = useState(credit ? String(Math.round(credit.amount)) : '')
  const [pay, setPay] = useState(credit ? String(Math.round(credit.monthlyPayment)) : '')
  const [err, setErr] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  const create = useCreateCredit()
  const update = useUpdateCredit()
  const del = useDeleteCredit()
  const pending = create.isPending || update.isPending || del.isPending

  const save = async () => {
    const name = bank.trim()
    const amt = Number(amount || 0)
    const mp = Number(pay || 0)
    if (!name) { setErr('Укажите банк'); return }
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Тело кредита должно быть больше 0'); return }
    setErr(null)
    try {
      if (isEdit) {
        const body: CreditUpdateInput = { kind, bank: name, amount: amt, monthlyPayment: mp }
        await update.mutateAsync({ id: credit!.id, body })
      } else {
        const body: CreditInput = { kind, bank: name, amount: amt, monthlyPayment: mp }
        await create.mutateAsync(body)
      }
      haptic('medium')
      onClose()
    } catch {
      setErr('Не удалось сохранить')
    }
  }

  const remove = async () => {
    if (!credit) return
    try {
      await del.mutateAsync(credit.id)
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
        <h4>{isEdit ? 'Редактировать кредит' : 'Новый кредит'}</h4>

        <div className="seg" style={{ marginBottom: 14 }}>
          {(['credit', 'card'] as CreditKind[]).map((k) => (
            <button key={k} className={`s${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <label className="sheet-label">Банк</label>
        <input
          className="input"
          placeholder="Напр. Сбер"
          value={bank}
          onChange={(e) => setBank(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <div className="add-row" style={{ marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label className="sheet-label">Тело кредита, ₽</label>
            <input
              className="input"
              inputMode="numeric"
              placeholder="0"
              value={groupDigits(amount)}
              onChange={(e) => setAmount(onlyDigits(e.target.value))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="sheet-label">Платёж в месяц, ₽</label>
            <input
              className="input"
              inputMode="numeric"
              placeholder="0"
              value={groupDigits(pay)}
              onChange={(e) => setPay(onlyDigits(e.target.value))}
            />
          </div>
        </div>

        {err && (
          <div className="toast over" style={{ marginBottom: 12 }}>
            <span className="ti">⚠️</span>
            <span>{err}</span>
          </div>
        )}

        <button className="btn btn-primary" disabled={pending} onClick={save}>
          {pending ? 'Сохраняю…' : 'Сохранить'}
        </button>

        {isEdit && (confirmDel ? (
          <>
            <p className="del-note">Кредит и история его досрочных погашений будут удалены без возможности восстановить.</p>
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
            Удалить кредит
          </button>
        ))}
      </div>
    </div>
  )
}
