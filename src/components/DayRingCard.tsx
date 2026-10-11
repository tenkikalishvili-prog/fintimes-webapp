import { useNavigate } from 'react-router-dom'
import { useDayRing } from '../lib/queries'
import { money } from '../lib/format'
import { haptic } from '../lib/telegram'

const R = 27
const C = 2 * Math.PI * R

/**
 * «Кольцо дня» (G2): сколько из дневного ориентира по «Тратам» уже потрачено. Зелёное, пока
 * укладываешься; жёлтое — чуть выше ориентира; красное — перерасход. Когда день закрыт и ты в
 * рамках — кольцо замыкается с галочкой. Внизу — точки последних 7 дней и «дней в рамках».
 */
export function DayRingCard({ closedToday }: { closedToday: boolean }) {
  const navigate = useNavigate()
  const ring = useDayRing()
  const d = ring.data
  if (!d) return null

  if (!d.hasBudget) {
    return (
      <button className="ring-card empty" onClick={() => { haptic('light'); navigate('/budget') }}>
        <span className="ring-empty-ic">◎</span>
        <span className="ring-empty-tx">
          <b>Кольцо дня</b>
          <small>Задайте месячный лимит на «Траты» в «Бюджете» — и здесь появится дневное кольцо</small>
        </span>
      </button>
    )
  }

  const closedRing = closedToday && d.status === 'good'
  const pct = closedRing ? 100 : Math.min(d.pct, 100)
  const tone = d.status === 'good' ? 'ok' : d.status === 'medium' ? 'warn' : 'over'

  return (
    <div className={`ring-card ${tone}${closedRing ? ' closed' : ''}`}>
      <div className="ring-svg">
        <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
          <circle cx="32" cy="32" r={R} className="ring-track" />
          <circle
            cx="32" cy="32" r={R}
            className="ring-bar"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct / 100)}
            transform="rotate(-90 32 32)"
          />
        </svg>
        <span className="ring-mid">{closedRing ? '✓' : `${d.pct}%`}</span>
      </div>
      <div className="ring-info">
        <div className="ring-ttl">Кольцо дня</div>
        <div className="ring-sub">
          потрачено <b>{money(d.todaySpent)}</b> из {money(d.dailyTarget)}
        </div>
        <div className="ring-week">
          {d.week.map((w) => (
            <i key={w.day} className={`${w.state}${w.day === d.today ? ' now' : ''}`} />
          ))}
          <span>в рамках {d.daysWithin} из {d.daysClosed}</span>
        </div>
      </div>
    </div>
  )
}
