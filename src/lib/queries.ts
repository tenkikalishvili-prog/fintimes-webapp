// React Query-хуки над HTTP-API. Один источник данных для всех экранов.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type {
  Analytics,
  Article,
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
  budgetOverview: (month?: string) => ['budget-overview', month ?? 'current'] as const,
  categories: (article: Article) => ['categories', article] as const,
  transactions: (month?: string) => ['transactions', month ?? 'all'] as const,
  history: (filters: HistoryFilters) => ['history', filters] as const,
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

/** Полный обзор бюджета: все категории со своими подкатегориями (для карусели). */
export function useBudgetOverview(month?: string) {
  return useQuery({
    queryKey: keys.budgetOverview(month),
    queryFn: () => api.get<BudgetGroupView[]>(`/api/budget/overview${qs({ month })}`),
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
/** После записи/удаления операции пересчитываются суммы во всех разделах. */
function invalidateMoney(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['overview'] })
  qc.invalidateQueries({ queryKey: ['analytics'] })
  qc.invalidateQueries({ queryKey: ['budget'] })
  qc.invalidateQueries({ queryKey: ['budget-overview'] })
  qc.invalidateQueries({ queryKey: ['transactions'] })
  qc.invalidateQueries({ queryKey: ['history'] })
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
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      api.patch<{ group: string; renamed: number }>('/api/categories/group', { oldName, newName }),
    onSuccess: () => {
      invalidateMoney(qc)
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}
