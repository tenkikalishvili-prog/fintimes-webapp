// Доменные типы MiniApp Financial Times.
// Совпадают с ответами HTTP-API (app/api/schemas.py), ключи в camelCase.
// Иерархия: Статья → Категория(группа) → Подкатегория → Сумма.
// В backend строка Category = уровень подкатегории; её id и есть categoryId операции.

/** Статья операции (верхний уровень). Цветом НЕ кодируется. */
export type Article = 'expense' | 'income' | 'debt' | 'goal'

export const ARTICLE_LABELS: Record<Article, string> = {
  expense: 'Расход',
  income: 'Доход',
  debt: 'Долг',
  goal: 'Цель',
}

/** Тип движения для рендера строки операции. */
export type TxKind = 'expense' | 'income' | 'goal' | 'debt'
/** Направление движения ДС у операций по целям/долгам. */
export type Flow = 'in' | 'out'

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
  /** Напоминания о платежах и долгах (S11) — в утренний час. */
  remindersEnabled: boolean
}

/** Частичное обновление настроек уведомлений (любое поле опционально). */
export interface NotificationSettingsInput {
  timezone?: string
  morningEnabled?: boolean
  morningHour?: number
  eveningEnabled?: boolean
  eveningHour?: number
  remindersEnabled?: boolean
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

/** Данные создания подкатегории (и, если группа новая, — новой категории). */
export interface SubcategoryInput {
  article: Article
  group: string
  name: string
  emoji?: string
}

/** Результат удаления: 'deleted' — удалено, 'archived' — скрыто (есть операции). */
export interface DeleteResult {
  action: 'deleted' | 'archived'
  id: number
}

export interface Transaction {
  id: number
  article: Article
  /** Тип движения для рендера: expense | income | goal | debt. */
  kind: TxKind
  /** Знак движения ДС у операций по целям/долгам: in (+) | out (−). null у доход/расход. */
  flow: Flow | null
  /** null у операций по целям/долгам (категории нет). */
  categoryId: number | null
  categoryName: string
  subcategoryName: string
  emoji: string | null
  amount: number
  date: string // ISO YYYY-MM-DD
  comment: string | null
  /** Привязка к цели (операция-пополнение). */
  goalId: number | null
  /** Привязка к долгу (тело/возврат). */
  debtId: number | null
  /** Роль операции долга: principal (тело) | payment (возврат). */
  debtRole: 'principal' | 'payment' | null
}

export interface TransactionInput {
  categoryId: number
  amount: number
  date?: string
  comment?: string
}

/** Частичное изменение операции. Присылаем только изменённые поля. */
export interface TransactionUpdateInput {
  amount?: number
  categoryId?: number
  date?: string
  comment?: string
}

/** Фильтры экрана «История». Все поля опциональны и комбинируются. */
export interface HistoryFilters {
  /** Период 'YYYY-MM'. undefined — за всё время. */
  month?: string
  /** Тип операции. undefined — любой. */
  article?: Article
  /** Имя категории (группы). undefined — любая. */
  group?: string
  /** Поиск по описанию и названию подкатегории. */
  q?: string
}

/** Направление долга: owe — я должен кому-то; lent — мне должны. */
export type DebtDirection = 'owe' | 'lent'

export const DEBT_DIRECTION_LABELS: Record<DebtDirection, string> = {
  owe: 'Я должен',
  lent: 'Мне должны',
}

/** Карточка долга из реестра (направление C, S8). Отдельная сущность, не операция. */
export interface Debt {
  id: number
  direction: DebtDirection
  /** Кому / кто должен. */
  counterparty: string
  /** Изначальная сумма долга, ₽. */
  amount: number
  /** Погашено на данный момент, ₽ (S9; пока 0). */
  paid: number
  /** Остаток = amount − paid, ₽. */
  remaining: number
  /** Срок возврата, ISO YYYY-MM-DD. null — без срока. */
  dueDate: string | null
  /** Дата движения тела (когда деньги перешли), ISO YYYY-MM-DD. */
  startedOn: string | null
  note: string | null
  /** Долг закрыт (возвращён). */
  isClosed: boolean
}

/** Данные создания долга. */
export interface DebtInput {
  direction: DebtDirection
  counterparty: string
  amount: number
  dueDate?: string
  /** Дата движения тела долга (по умолчанию сегодня). */
  startedOn?: string
  note?: string
}

/** Один возврат по долгу частями (S9). */
export interface DebtPayment {
  id: number
  amount: number
  /** Дата возврата, ISO YYYY-MM-DD. */
  date: string
}

/** Данные записи возврата. date опционально (по умолчанию — сегодня). */
export interface DebtPaymentInput {
  amount: number
  date?: string
}

/** Частичное изменение долга. Присылаем только изменённые поля. */
export interface DebtUpdateInput {
  direction?: DebtDirection
  counterparty?: string
  amount?: number
  dueDate?: string
  startedOn?: string
  note?: string
  isClosed?: boolean
}

/** Обязательный платёж (направление C, S10): регулярное ежемесячное обязательство. */
export interface Bill {
  id: number
  title: string
  amount: number
  /** Число месяца-срок (1–31). */
  dueDay: number
  /** Подкатегория расхода, куда пишется операция при оплате. */
  categoryId: number
  categoryName: string
  /** Категория (группа) подкатегории. */
  group: string
  emoji: string | null
  note: string | null
  isActive: boolean
  /** Оплачен ли за выбранный месяц. */
  paid: boolean
}

/** Данные создания платежа. */
export interface BillInput {
  title: string
  amount: number
  dueDay: number
  categoryId: number
  note?: string
}

/** Частичное изменение платежа. */
export interface BillUpdateInput {
  title?: string
  amount?: number
  dueDay?: number
  categoryId?: number
  note?: string
  isActive?: boolean
}

/** Финансовая цель / накопление (направление D, S13). Отдельная сущность, не операция. */
export interface Goal {
  id: number
  /** На что копим. */
  title: string
  /** Сколько нужно всего, ₽. */
  targetAmount: number
  /** Накоплено на данный момент, ₽ (сумма пополнений). */
  saved: number
  /** Остаток = targetAmount − saved, ₽. */
  remaining: number
  /** Срок цели, ISO YYYY-MM-DD. null — без срока. */
  deadline: string | null
  note: string | null
  /** Цель достигнута. */
  isDone: boolean
}

/** Данные создания цели. */
export interface GoalInput {
  title: string
  targetAmount: number
  deadline?: string
  note?: string
}

/** Частичное изменение цели. Присылаем только изменённые поля. */
export interface GoalUpdateInput {
  title?: string
  targetAmount?: number
  deadline?: string
  note?: string
  isDone?: boolean
}

/** Одно пополнение цели (S13). */
export interface GoalContribution {
  id: number
  amount: number
  /** Дата пополнения, ISO YYYY-MM-DD. */
  date: string
}

/** Данные записи пополнения. date опционально (по умолчанию — сегодня). */
export interface GoalContributionInput {
  amount: number
  date?: string
}

/** Статус бюджета — единственное место, где живёт светофор. */
export type BudgetStatus = 'ok' | 'warn' | 'over'

/** Разбор строки умного ввода («кофе 350») для предзаполнения формы «Добавить». */
export interface SmartParseResult {
  /** Распознанная сумма, ₽. null — сумму понять не удалось. */
  amount: number | null
  /** Очищенное описание (без суммы и валюты). */
  description: string
  /** Предполагаемая статья. */
  article: Article
  /** Угадана ли подкатегория. */
  matched: boolean
  /** id подобранной подкатегории (если matched). */
  categoryId: number | null
  /** Категория (группа) подобранной подкатегории. */
  group: string | null
  /** Имя подобранной подкатегории. */
  subcategoryName: string | null
  emoji: string | null
}
