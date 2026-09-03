import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings, useUpdateSettings } from '../lib/queries'
import { SkeletonBlock, ErrorState } from '../components/States'
import { haptic } from '../lib/telegram'
import { TIMEZONES } from '../lib/timezones'
import type { NotificationSettingsInput } from '../types'

const hhmm = (h: number) => `${String(h).padStart(2, '0')}:00`

/** Экран настроек уведомлений: вкл/выкл и час утренней и вечерней рассылки. */
export function Settings() {
  const navigate = useNavigate()
  const { data, isPending, isError, refetch } = useSettings()
  const update = useUpdateSettings()

  // Локальное состояние для мгновенного отклика; сервер подтверждает через мутацию.
  const [tz, setTz] = useState('Europe/Moscow')
  const [morningOn, setMorningOn] = useState(true)
  const [morningHour, setMorningHour] = useState(9)
  const [eveningOn, setEveningOn] = useState(true)
  const [eveningHour, setEveningHour] = useState(23)
  const [remindersOn, setRemindersOn] = useState(true)

  // Актуальный час в ref: серия быстрых тапов «+/−» накапливается корректно,
  // не завися от асинхронного ре-рендера (иначе два тапа читали бы одно значение).
  const morningRef = useRef(9)
  const eveningRef = useRef(23)

  useEffect(() => {
    if (!data) return
    setTz(data.timezone)
    setMorningOn(data.morningEnabled)
    setMorningHour(data.morningHour)
    setEveningOn(data.eveningEnabled)
    setEveningHour(data.eveningHour)
    setRemindersOn(data.remindersEnabled)
    morningRef.current = data.morningHour
    eveningRef.current = data.eveningHour
  }, [data])

  const patch = (body: NotificationSettingsInput) => update.mutate(body)

  // Если пояс пользователя не из курированного списка — добавим его пунктом,
  // чтобы значение отображалось и не терялось при сохранении.
  const tzOptions = TIMEZONES.some((t) => t.value === tz)
    ? TIMEZONES
    : [{ value: tz, label: tz }, ...TIMEZONES]

  const changeTz = (value: string) => {
    haptic('light')
    setTz(value)
    patch({ timezone: value })
  }

  const stepHour = (which: 'morning' | 'evening', delta: number) => {
    haptic('light')
    if (which === 'morning') {
      const h = (morningRef.current + delta + 24) % 24
      morningRef.current = h
      setMorningHour(h)
      patch({ morningHour: h })
    } else {
      const h = (eveningRef.current + delta + 24) % 24
      eveningRef.current = h
      setEveningHour(h)
      patch({ eveningHour: h })
    }
  }

  const toggle = (which: 'morning' | 'evening' | 'reminders', on: boolean) => {
    haptic('medium')
    if (which === 'morning') {
      setMorningOn(on)
      patch({ morningEnabled: on })
    } else if (which === 'evening') {
      setEveningOn(on)
      patch({ eveningEnabled: on })
    } else {
      setRemindersOn(on)
      patch({ remindersEnabled: on })
    }
  }

  return (
    <div className="app-shell">
      <div className="app-body no-tabbar">
        <div className="modal-head">
          <div className="mo">Настройки</div>
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
            <div className="block">
              <h3>🌍 Часовой пояс</h3>
              <select
                className="input set-tz"
                value={tz}
                onChange={(e) => changeTz(e.target.value)}
              >
                {tzOptions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <div className="set-hint">По нему считаются время уведомлений и «сегодня».</div>
            </div>

            <div className="block">
              <h3>🔔 Уведомления от бота</h3>

              {/* Утро */}
              <div className="set-item">
                <div className="set-top">
                  <div className="set-txt">
                    <div className="set-name">☀️ Утренний лимит</div>
                    <div className="set-sub">Сколько можно потратить сегодня</div>
                  </div>
                  <div className="seg set-seg">
                    <button className={`s${morningOn ? ' on' : ''}`} onClick={() => toggle('morning', true)}>
                      Вкл
                    </button>
                    <button className={`s${!morningOn ? ' on' : ''}`} onClick={() => toggle('morning', false)}>
                      Выкл
                    </button>
                  </div>
                </div>
                {morningOn && (
                  <div className="set-time">
                    <span className="set-time-lbl">Время</span>
                    <div className="stepper">
                      <button onClick={() => stepHour('morning', -1)} aria-label="Раньше">
                        −
                      </button>
                      <b>{hhmm(morningHour)}</b>
                      <button onClick={() => stepHour('morning', 1)} aria-label="Позже">
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="set-div" />

              {/* Вечер */}
              <div className="set-item">
                <div className="set-top">
                  <div className="set-txt">
                    <div className="set-name">🌙 Вечерняя сводка</div>
                    <div className="set-sub">Как прошёл день по тратам</div>
                  </div>
                  <div className="seg set-seg">
                    <button className={`s${eveningOn ? ' on' : ''}`} onClick={() => toggle('evening', true)}>
                      Вкл
                    </button>
                    <button className={`s${!eveningOn ? ' on' : ''}`} onClick={() => toggle('evening', false)}>
                      Выкл
                    </button>
                  </div>
                </div>
                {eveningOn && (
                  <div className="set-time">
                    <span className="set-time-lbl">Время</span>
                    <div className="stepper">
                      <button onClick={() => stepHour('evening', -1)} aria-label="Раньше">
                        −
                      </button>
                      <b>{hhmm(eveningHour)}</b>
                      <button onClick={() => stepHour('evening', 1)} aria-label="Позже">
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="set-div" />

              {/* Напоминания о платежах и долгах (S11) */}
              <div className="set-item">
                <div className="set-top">
                  <div className="set-txt">
                    <div className="set-name">📅 Напоминания о платежах и долгах</div>
                    <div className="set-sub">В утренний час, если есть ближайшие сроки</div>
                  </div>
                  <div className="seg set-seg">
                    <button className={`s${remindersOn ? ' on' : ''}`} onClick={() => toggle('reminders', true)}>
                      Вкл
                    </button>
                    <button className={`s${!remindersOn ? ' on' : ''}`} onClick={() => toggle('reminders', false)}>
                      Выкл
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="block muted" style={{ fontSize: 12.5 }}>
              Настройки применяются сразу — перезапускать бота не нужно.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
