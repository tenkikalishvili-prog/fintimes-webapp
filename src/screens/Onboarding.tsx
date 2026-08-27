import { useState } from 'react'
import { useCompleteOnboarding } from '../lib/queries'
import { haptic } from '../lib/telegram'
import { money } from '../lib/format'

/** Дней в текущем месяце — для превью дневного лимита на шаге трат. */
function daysInMonth(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
}

const onlyDigits = (s: string) => s.replace(/[^\d]/g, '')
const grouped = (s: string) => (s ? Number(s).toLocaleString('ru-RU').replace(/,/g, ' ') : '')

/**
 * Лёгкий мастер первого входа: доход + общий лимит трат.
 * 2 шага. Общий лимит трат сразу питает дневной лимит на Главной.
 */
export function Onboarding({ name }: { name: string }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [income, setIncome] = useState('')
  const [spending, setSpending] = useState('')
  const complete = useCompleteOnboarding()

  const finish = (withData: boolean) => {
    if (complete.isPending) return
    haptic('medium')
    complete.mutate({
      monthlyIncome: withData && income ? Number(income) : undefined,
      monthlySpending: withData && spending ? Number(spending) : undefined,
    })
    // При успехе /me обновится (needsOnboarding=false) → App покажет Главную.
  }

  const perDay = spending ? Math.round(Number(spending) / daysInMonth()) : 0

  return (
    <div className="app-shell">
      <div className="app-body no-tabbar ob">
        <div className="ob-dots" aria-hidden>
          <i className={step >= 1 ? 'on' : ''} />
          <i className={step >= 2 ? 'on' : ''} />
        </div>

        {step === 1 ? (
          <>
            <div className="ob-hero">
              <div className="ob-emoji">👋</div>
              <h1 className="h1">Привет, {name}!</h1>
              <p className="muted ob-sub">
                Это Financial Times — помощник по деньгам. Настроим за минуту, чтобы
                приложение сразу показывало твой дневной лимит.
              </p>
            </div>

            <label className="ob-label">Сколько зарабатываешь в месяц?</label>
            <div className="amount-in ob-amount">
              <input
                className="a"
                inputMode="numeric"
                placeholder="0"
                value={grouped(income)}
                onChange={(e) => setIncome(onlyDigits(e.target.value))}
              />
              <div className="c">рублей в месяц · доход</div>
            </div>

            <div className="ob-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  haptic('light')
                  setStep(2)
                }}
              >
                Далее
              </button>
              <button className="btn btn-ghost" onClick={() => finish(false)} disabled={complete.isPending}>
                Пропустить настройку
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="ob-hero">
              <div className="ob-emoji">🎯</div>
              <h1 className="h1">Лимит на траты</h1>
              <p className="muted ob-sub">
                Сколько в месяц готов тратить на повседневные траты — продукты, кафе,
                транспорт, развлечения? Разделим на дни и подскажем лимит на каждый день.
              </p>
            </div>

            <label className="ob-label">Бюджет на повседневные траты в месяц</label>
            <div className="amount-in ob-amount">
              <input
                className="a"
                inputMode="numeric"
                placeholder="0"
                value={grouped(spending)}
                onChange={(e) => setSpending(onlyDigits(e.target.value))}
              />
              <div className="c">рублей в месяц · группа «Траты»</div>
            </div>

            {perDay > 0 && (
              <div className="ob-preview">
                Это ≈ <b>{money(perDay)}</b> в день
              </div>
            )}

            {complete.isError && (
              <div className="toast over" style={{ marginTop: 12 }}>
                <span className="ti">⚠️</span>
                <span>Не удалось сохранить. Попробуй ещё раз.</span>
              </div>
            )}

            <div className="ob-actions">
              <button className="btn btn-primary" onClick={() => finish(true)} disabled={complete.isPending}>
                {complete.isPending ? 'Сохраняю…' : 'Готово'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  haptic('light')
                  setStep(1)
                }}
                disabled={complete.isPending}
              >
                ‹ Назад
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
