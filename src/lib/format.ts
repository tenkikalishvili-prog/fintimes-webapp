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
  return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0).replace('.', ',').replace(/,?0+$/, '')
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
