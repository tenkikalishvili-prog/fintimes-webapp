// Доменные типы MiniApp Financial Times.
// Совпадают с ответами HTTP-API (app/api/schemas.py), ключи в camelCase.
// Иерархия: Статья → Категория(группа) → Подкатегория → Сумма.
// В backend строка Category = уровень подкатегории; её id и есть categoryId операции.

/** Статья операции (верхний уровень). Цветом НЕ кодируется. */
export type Article = 'expense' | 'income' | 'debt'

export const ARTICLE_LABELS: Record<Article, string> = {
  expense: 'Расход',
  income: 'Доход',
  debt: 'Долг',
}

export interface Me {
  id: number
  telegramId: number
  name: string
  currency: string
  theme: string
  /** true → показать мастер первого входа (онбординг ещё не пройден). */
  needsOnboarding: boolean
  /** Плановый доход в месяц (с онбординга), ₽. null — не задан. */
  plannedIncome: number | null
  /** Общий месячный лимит на «Траты» (с онбординга), ₽. null — не задан. */
  plannedSpending: number | null
}

/** Данные лёгкого мастера онбординга: доход + общий лимит трат. */
export interface OnboardingInput {
  monthlyIncome?: number
  monthlySpending?: number
}

/** Настройки уведомлений бота. Час — по часовому поясу пользователя. */
export interface NotificationSettings {
  timezone: string
  morningEnabled: boolean
  morningHour: number
  eveningEnabled: boolean
  eveningHour: number
}

/** Частичное обновление настроек уведомлений (любое поле опционально). */
export interface NotificationSettingsInput {
  timezone?: string
  morningEnabled?: boolean
  morningHour?: number
  eveningEnabled?: boolean
  eveningHour?: number
}

export interface TopSpend {
  subcategoryId: number
  name: string
  emoji: string | null
  spent: number
  limit: number
}

export interface Overview {
  month: string // YYYY-MM
  income: number
  expense: number
  remaining: number
  dailyLimit: number
  daysLeft: number
  hasBudget: boolean
  topSpend: TopSpend[]
}

export interface AnalyticsSlice {
  name: string
  value: number
}

export interface Analytics {
  month: string
  total: number
  slices: AnalyticsSlice[]
}

export interface BudgetLine {
  subcategoryId: number
  group: string
  name: string
  emoji: string | null
  spent: number
  limit: number
}

/** Подкатегория в обзоре бюджета (без group — она задаётся родительской группой). */
export interface BudgetSub {
  subcategoryId: number
  name: string
  emoji: string | null
  spent: number
  limit: number
}

/** Категория (группа) с её подкатегориями — «страница» карусели в разделе «Бюджет». */
export interface BudgetGroupView {
  group: string
  emoji: string | null
  spent: number
  limit: number
  subcategories: BudgetSub[]
}

export interface Subcategory {
  id: number
  name: string
  emoji: string | null
}

export interface CategoryGroup {
  group: string
  emoji: string | null
  subcategories: Subcategory[]
}

export interface Transaction {
  id: number
  article: Article
  categoryId: number
  categoryName: string
  subcategoryName: string
  emoji: string | null
  amount: number
  date: string // ISO YYYY-MM-DD
  comment: string | null
}

export interface TransactionInput {
  categoryId: number
  amount: number
  date?: string
  comment?: string
}

/** Статус бюджета — единственное место, где живёт светофор. */
export type BudgetStatus = 'ok' | 'warn' | 'over'
