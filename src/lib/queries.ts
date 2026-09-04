// React Query-хуки над HTTP-API. Один источник данных для всех экранов.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type {
  Analytics,
  Article,
  Bill,
  BillInput,
  BillUpdateInput,
  Debt,
  DebtInput,
  DebtPayment,
  DebtPaymentInput,
  DebtUpdateInput,
  Goal,
  GoalContribution,
  GoalContributionInput,
  GoalInput,
  GoalUpdateInput,
  HistoryFilters,
  BudgetGroupView,
  BudgetLine,
  CategoryGroup,
  DeleteResult,
  Me,
  NotificationSettings,
  NotificationSettingsInput,
  OnboardingInput,
  Overview,
  SmartParseResult,
  Subcategory,
  SubcategoryInput,
  Transaction,
  TransactionInput,
  TransactionUpdateInput,
} from '../types'

const qs = (params: Record<string, string | number | undefined>): string => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  if (entries.length === 0) return ''
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
}

// ── Ключи кэша ────────────────────────────────────────────────────────────
export const keys = {
  me: ['me'] as const,
  overview: (month?: string) => ['overview', month ?? 'current'] as const,
  analytics: (month?: string) => ['analytics', month ?? 'current'] as const,
  budget: (month?: string, group?: string) => ['budget', month ?? 'current', group ?? 'Траты'] as const,
  budgetOverview: (month?: string, article: Article = 'expense') =>
    ['budget-overview', month ?? 'current', article] as const,
  categories: (article: Article) => ['categories', article] as const,
  transactions: (month?: string) => ['transactions', month ?? 'all'] as const,
  history: (filters: HistoryFilters) => ['history', filters] as const,
  debts: (includeClosed: boolean) => ['debts', includeClosed] as const,
  debtPayments: (debtId: number) => ['debt-payments', debtId] as const,
  goals: (includeDone: boolean) => ['goals', includeDone] as const,
  goalContributions: (goalId: number) => ['goal-contributions', goalId] as const,
  bills: (month?: string) => ['bills', month ?? 'current'] as const,
  settings: ['settings'] as const,
}

// ── Чтение ─────────────────────────────────────────────────────────────────
export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => api.get<Me>('/api/me') })
}

export function useOverview(month?: string) {
  return useQuery({
    queryKey: keys.overview(month),
    queryFn: () => api.get<Overview>(`/api/overview${qs({ month })}`),
  })
}

export function useAnalytics(month?: string) {
  return useQuery({
    queryKey: keys.analytics(month),
    queryFn: () => api.get<Analytics>(`/api/analytics${qs({ month })}`),
  })
}

export function useBudget(month?: string, group?: string) {
  return useQuery({
    queryKey: keys.budget(month, group),
    queryFn: () => api.get<BudgetLine[]>(`/api/budget${qs({ month, group })}`),
  })
}

/**
 * Полный обзор категорий: все категории со своими подкатегориями (для карусели).
 * article='expense' — с лимитами (бюджет); article='income' — доходные категории
 * с суммами полученного за месяц (лимитов нет).
 */
export function useBudgetOverview(month?: string, article: Article = 'expense') {
  return useQuery({
    queryKey: keys.budgetOverview(month, article),
    queryFn: () => api.get<BudgetGroupView[]>(`/api/budget/overview${qs({ month, article })}`),
  })
}

export function useCategories(article: Article) {
  return useQuery({
    queryKey: keys.categories(article),
    queryFn: () => api.get<CategoryGroup[]>(`/api/categories${qs({ article })}`),
  })
}

export function useTransactions(month?: string, limit = 30) {
  return useQuery({
    queryKey: keys.transactions(month),
    queryFn: () => api.get<Transaction[]>(`/api/transactions${qs({ month, limit })}`),
  })
}

/**
 * Полная история операций с фильтрами и постраничной подгрузкой («Показать ещё»).
 * Каждая страница — массив операций; конец достигнут, когда пришло меньше pageSize.
 */
export function useHistory(filters: HistoryFilters, pageSize = 40) {
  return useInfiniteQuery({
    queryKey: keys.history(filters),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.get<Transaction[]>(
        `/api/transactions${qs({ ...filters, limit: pageSize, offset: pageParam })}`,
      ),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < pageSize ? undefined : allPages.length * pageSize,
  })
}

// ── Изменение ────────────────────────────────────────────────────────────
/** После записи/удаления операции пересчитываются суммы во всех разделах.
 *  Единый реестр: операция может быть по цели/долгу — обновляем и их (дёшево). */
function invalidateMoney(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['overview'] })
  qc.invalidateQueries({ queryKey: ['analytics'] })
  qc.invalidateQueries({ queryKey: ['budget'] })
  qc.invalidateQueries({ queryKey: ['budget-overview'] })
  qc.invalidateQueries({ queryKey: ['transactions'] })
  qc.invalidateQueries({ queryKey: ['history'] })
  qc.invalidateQueries({ queryKey: ['goals'] })
  qc.invalidateQueries({ queryKey: ['debts'] })
}

/** Умный ввод: «кофе 350» → сумма + подобранная подкатегория (ничего не пишет в БД). */
export function useSmartParse() {
  return useMutation({
    mutationFn: (text: string) => api.post<SmartParseResult>('/api/smart-parse', { text }),
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TransactionInput) => api.post<Transaction>('/api/transactions', body),
    onSuccess: () => invalidateMoney(qc),
  })
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: TransactionUpdateInput }) =>
      api.patch<Transaction>(`/api/transactions/${id}`, body),
    onSuccess: () => invalidateMoney(qc),
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del<void>(`/api/transactions/${id}`),
    onSuccess: () => invalidateMoney(qc),
  })
}

// ── Долги (направление C, S8) ──────────────────────────────────────────────
export function useDebts(includeClosed = false) {
  return useQuery({
    queryKey: keys.debts(includeClosed),
    queryFn: () => api.get<Debt[]>(`/api/debts${qs({ includeClosed: includeClosed ? 'true' : undefined })}`),
  })
}

export function useCreateDebt() {
  const qc = useQueryClient()
  return useMutation({
    // Создание долга заводит операцию-тело → влияет на остаток и историю.
    mutationFn: (body: DebtInput) => api.post<Debt>('/api/debts', body),
    onSuccess: () => invalidateMoney(qc),
  })
}

export function useUpdateDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: DebtUpdateInput }) =>
      api.patch<Debt>(`/api/debts/${id}`, body),
    onSuccess: () => invalidateMoney(qc),
  })
}

export function useDeleteDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del<void>(`/api/debts/${id}`),
    onSuccess: () => invalidateMoney(qc),
  })
}

// ── Возвраты долга частями (S9) ────────────────────────────────────────────
/** История возвратов конкретного долга (свежие сверху). */
export function useDebtPayments(debtId: number) {
  return useQuery({
    queryKey: keys.debtPayments(debtId),
    queryFn: () => api.get<DebtPayment[]>(`/api/debts/${debtId}/payments`),
  })
}

/** После изменения платежей — обновляем деньги (остаток/история) и историю платежей долга. */
function invalidateDebtPayments(qc: ReturnType<typeof useQueryClient>, debtId: number) {
  invalidateMoney(qc)
  qc.invalidateQueries({ queryKey: keys.debtPayments(debtId) })
}

export function useAddDebtPayment(debtId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DebtPaymentInput) => api.post<Debt>(`/api/debts/${debtId}/payments`, body),
    onSuccess: () => invalidateDebtPayments(qc, debtId),
  })
}

export function useDeleteDebtPayment(debtId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (paymentId: number) => api.del<Debt>(`/api/debts/${debtId}/payments/${paymentId}`),
    onSuccess: () => invalidateDebtPayments(qc, debtId),
  })
}

// ── Финансовые цели (направление D, S13) ───────────────────────────────────
export function useGoals(includeDone = false) {
  return useQuery({
    queryKey: keys.goals(includeDone),
    queryFn: () => api.get<Goal[]>(`/api/goals${qs({ includeDone: includeDone ? 'true' : undefined })}`),
  })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: GoalInput) => api.post<Goal>('/api/goals', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useUpdateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: GoalUpdateInput }) =>
      api.patch<Goal>(`/api/goals/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del<void>(`/api/goals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

/** История пополнений конкретной цели (свежие сверху). */
export function useGoalContributions(goalId: number) {
  return useQuery({
    queryKey: keys.goalContributions(goalId),
    queryFn: () => api.get<GoalContribution[]>(`/api/goals/${goalId}/contributions`),
  })
}

/** После изменения пополнений — обновляем деньги (остаток/история) и историю пополнений цели. */
function invalidateGoalContributions(qc: ReturnType<typeof useQueryClient>, goalId: number) {
  invalidateMoney(qc)
  qc.invalidateQueries({ queryKey: keys.goalContributions(goalId) })
}

export function useAddGoalContribution(goalId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: GoalContributionInput) =>
      api.post<Goal>(`/api/goals/${goalId}/contributions`, body),
    onSuccess: () => invalidateGoalContributions(qc, goalId),
  })
}

export function useDeleteGoalContribution(goalId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (contributionId: number) =>
      api.del<Goal>(`/api/goals/${goalId}/contributions/${contributionId}`),
    onSuccess: () => invalidateGoalContributions(qc, goalId),
  })
}

// ── Обязательные платежи (направление C, S10) ──────────────────────────────
/** Платежи с отметкой оплаты за месяц (по умолчанию — текущий). */
export function useBills(month?: string) {
  return useQuery({
    queryKey: keys.bills(month),
    queryFn: () => api.get<Bill[]>(`/api/bills${qs({ month })}`),
  })
}

export function useCreateBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BillInput) => api.post<Bill>('/api/bills', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
  })
}

export function useUpdateBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: BillUpdateInput }) =>
      api.patch<Bill>(`/api/bills/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
  })
}

export function useDeleteBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del<void>(`/api/bills/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
  })
}

/** Отметка «оплачено» за месяц: создаёт/удаляет расходную операцию → пересчёт всех сумм. */
export function useSetBillPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, month, paid }: { id: number; month: string; paid: boolean }) =>
      api.patch<Bill>(`/api/bills/${id}/paid`, { month, paid }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bills'] })
      invalidateMoney(qc)
    },
  })
}

/** Завершение лёгкого онбординга: сохраняет доход и лимит трат, обновляет /me и суммы. */
export function useCompleteOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: OnboardingInput) => api.post<Me>('/api/onboarding', body),
    onSuccess: (me) => {
      qc.setQueryData(keys.me, me)
      invalidateMoney(qc)
    },
  })
}

// ── Настройки уведомлений ──────────────────────────────────────────────────
export function useSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: () => api.get<NotificationSettings>('/api/settings'),
  })
}

/** Обновление настроек уведомлений. Ответ сразу кладём в кэш (без перезапроса). */
export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: NotificationSettingsInput) =>
      api.patch<NotificationSettings>('/api/settings', body),
    onSuccess: (settings) => qc.setQueryData(keys.settings, settings),
  })
}

export function useSetBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ categoryId, amount }: { categoryId: number; amount: number }) =>
      api.patch<BudgetLine>(`/api/budget/${categoryId}`, { amount }),
    onSuccess: () => invalidateMoney(qc),
  })
}

/** Переименование подкатегории. Меняет название везде (id не трогается). */
export function useRenameSubcategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.patch<Subcategory>(`/api/categories/${id}`, { name }),
    onSuccess: () => {
      invalidateMoney(qc)
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

/** Создание подкатегории (или новой категории, если группа новая). */
export function useCreateSubcategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SubcategoryInput) =>
      api.post<{ id: number; name: string; emoji: string | null; group: string; article: string }>(
        '/api/categories',
        body,
      ),
    onSuccess: () => {
      invalidateMoney(qc)
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

/** Удаление подкатегории. Если по ней есть операции — бэкенд её архивирует. */
export function useDeleteSubcategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del<DeleteResult>(`/api/categories/${id}`),
    onSuccess: () => {
      invalidateMoney(qc)
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

/** Удаление категории (группы) целиком. Служебную «Траты» удалить нельзя. */
export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ article, name }: { article: Article; name: string }) =>
      api.del<{ deleted: number; archived: number }>(
        `/api/categories/group${qs({ article, name })}`,
      ),
    onSuccess: () => {
      invalidateMoney(qc)
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

/** Переименование категории (группы) — меняет её у всех подкатегорий. */
export function useRenameGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ oldName, newName, article = 'expense' }: { oldName: string; newName: string; article?: Article }) =>
      api.patch<{ group: string; renamed: number }>('/api/categories/group', { oldName, newName, article }),
    onSuccess: () => {
      invalidateMoney(qc)
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}
