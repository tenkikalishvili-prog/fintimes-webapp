// Форматирование денег и статусов бюджета.
import type { BudgetStatus } from '../types'

/** Полная сумма с разделителями тысяч и знаком ₽. Напр. 1240 → "1 240 ₽" */
export function money(value: number): string {
  const sign = value < 0 ? '−' : ''
  const abs = Math.abs(Math.round(value))
  return `${sign}${abs.toLocaleString('ru-RU').replace(/,/g, ' ')} ₽`
}

/** Компактная сумма: 288000 → "288к", 1620000 → "1,62 млн". Без ₽. */
export function compact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)} млн`
  if (abs >= 1_000) return `${trim(value / 1_000)}к`
  return String(Math.round(value))
}

function trim(n: number): string {
  // Срезаем незначащие нули ТОЛЬКО в дробной части («1.50»→«1.5», «2.00»→«2»),
  // не трогая целые, оканчивающиеся на нули («300»→«300», «180»→«180»).
  let s = n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0)
  if (s.includes('.')) s = s.replace(/\.?0+$/, '')
  return s.replace('.', ',')
}

/** Порог бюджета → статус светофора. <80% ok · 80–100% warn · >100% over */
export function budgetStatus(spent: number, limit: number): BudgetStatus {
  if (limit <= 0) return 'ok'
  const ratio = spent / limit
  if (ratio > 1) return 'over'
  if (ratio >= 0.8) return 'warn'
  return 'ok'
}

/** CSS-класс заливки прогресс-бара по статусу. */
export const fillClass: Record<BudgetStatus, string> = {
  ok: 'fill-g',
  warn: 'fill-a',
  over: 'fill-r',
}

/** Дата операции для списка: «сегодня» / «вчера» / «5 авг». */
export function formatTxDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 864e5)
  if (sameDay(d, today)) return 'сегодня'
  if (sameDay(d, yesterday)) return 'вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString()
}

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

/** 'YYYY-MM' → «Сентябрь 2026». */
export function monthTitle(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS_RU[m - 1]} ${y}`
}

/** Текущий месяц в формате 'YYYY-MM'. */
export function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Сдвиг месяца 'YYYY-MM' на delta месяцев (±). */
export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Заголовок дня для группировки истории: «Сегодня» / «Вчера» / «5 сентября, пн». */
export function dayHeading(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 864e5)
  if (sameDay(d, today)) return 'Сегодня'
  if (sameDay(d, yesterday)) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' })
}
