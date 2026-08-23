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
