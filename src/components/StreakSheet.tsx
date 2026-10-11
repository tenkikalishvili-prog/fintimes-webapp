import { useCloseDay } from '../lib/queries'
import { haptic } from '../lib/telegram'
import type { Streak, Xp } from '../types'

/** Русское «день / дня / дней» по числу. */
export function daysWord(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'день'
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня'
  return 'дней'
}

/**
 * «Финансовая серия»: сколько дней подряд ты вёл финансы. День закрыт, когда внесена любая
 * операция или нажато «Трат не было». Без стыда за пропуски — только позитив и мягкие напоминания.
 */
export function StreakSheet({
  streak,
  xp,
  levelUp = false,
  onClose,
}: {
  streak: Streak
  xp?: Xp
  /** Уровень вырос с прошлого открытия — показываем поздравление. */
  levelUp?: boolean
  onClose: () => void
}) {
  const close = useCloseDay()

  const closeDay = async () => {
    try {
      await close.mutateAsync()
      haptic('heavy') // «награда» за закрытый день
    } catch {
      /* кнопка останется — можно нажать ещё раз */
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {xp && (
          <div className="lvl-box">
            {levelUp && <div className="lvl-up">🎉 Новый уровень!</div>}
            <div className="lvl-top">
              <span className="lvl-badge">{xp.level}</span>
              <span className="lvl-name">
                <b>{xp.levelName}</b>
                <small>{xp.xp} XP · +{xp.today} сегодня</small>
              </span>
            </div>
            <div className="bar lvl-bar"><i style={{ width: `${xp.progress}%` }} /></div>
            <div className="lvl-next">до уровня {xp.level + 1}: {xp.nextAt - xp.xp} XP</div>
          </div>
        )}

        <div className="stk-hero">
          <div className={`stk-flame${streak.current > 0 ? ' on' : ''}`}>🔥</div>
          <div key={streak.current} className="stk-num">{streak.current}</div>
          <div className="stk-cap">
            {streak.current > 0 ? `${daysWord(streak.current)} подряд` : 'серия пока не началась'}
          </div>
        </div>

        <div className="stk-row">
          <span>Рекорд</span>
          <b>{streak.longest} {daysWord(streak.longest)}</b>
        </div>
        <div className="stk-row">
          <span>Сегодня</span>
          <b className={streak.closedToday ? 'ok' : ''}>
            {streak.closedToday ? '✓ день закрыт' : 'ещё не закрыт'}
          </b>
        </div>

        <p className="stk-hint">
          День закрывается, когда ты вносишь любую операцию — или нажимаешь «Трат не было».
          {streak.atRisk && ' Закрой сегодняшний день, чтобы серия продолжилась.'}
        </p>

        {!streak.closedToday && (
          <button className="btn btn-primary" disabled={close.isPending} onClick={closeDay}>
            {close.isPending ? '…' : 'Трат не было'}
          </button>
        )}
        <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}
