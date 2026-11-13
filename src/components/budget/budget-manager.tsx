'use client'

import React, { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { EnrichedBudget, Category } from '@/types/database'
import { BudgetCard } from '@/components/budget/budget-card'
import { BudgetFormModal } from '@/components/budget/budget-form'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCurrency, convertAmount } from '@/lib/utils/currency'
import { usePrivacyMode, maskCurrency } from '@/lib/storage/privacy-mode'
import { usePreferredCurrency } from '@/lib/storage/preferred-currency'
import { getNextMonth, getPrevMonth, formatDate } from '@/lib/utils/date'
import { useLanguage } from '@/lib/i18n/language-context'
import { ChevronLeft, ChevronRight, Plus, Search, X, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils/cn'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface BudgetManagerProps {
  budgets: EnrichedBudget[]
  categories?: Category[]
  exchangeRate?: number
  currentPeriod: string
}

type BudgetStatusFilter = 'all' | 'over' | 'warning' | 'healthy' | 'unset'
type BudgetCurrencyFilter = 'all' | 'IDR' | 'USD' | 'SGD'

export function BudgetManager({
  budgets,
  categories = [],
  exchangeRate = 16200,
  currentPeriod,
}: BudgetManagerProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const isPrivate = usePrivacyMode()
  const displayCurrency = usePreferredCurrency()

  const [isPending, startTransition] = useTransition()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedBudget, setSelectedBudget] = useState<EnrichedBudget | null>(null)
  const [statusFilter, setStatusFilter] = useState<BudgetStatusFilter>('all')
  const [currencyFilter, setCurrencyFilter] = useState<BudgetCurrencyFilter>('all')
  const [search, setSearch] = useState('')

  const handlePrevMonth = () => {
    const prev = getPrevMonth(currentPeriod)
    startTransition(() => {
      router.push(`/budget?period=${prev}`)
    })
  }

  const handleNextMonth = () => {
    const next = getNextMonth(currentPeriod)
    startTransition(() => {
      router.push(`/budget?period=${next}`)
    })
  }

  const handleEdit = (b: EnrichedBudget) => {
    setSelectedBudget(b)
    setIsModalOpen(true)
  }

  const handleAddNew = () => {
    setSelectedBudget(null)
    setIsModalOpen(true)
  }

  // Aggregate in displayCurrency using live exchange rates
  const totalBudget = budgets.reduce(
    (acc, b) => acc + convertAmount(b.amount || 0, b.currency || 'IDR', displayCurrency, exchangeRate),
    0
  )
  const totalSpent = budgets.reduce(
    (acc, b) => acc + convertAmount(b.actual_spent || 0, b.currency || 'IDR', displayCurrency, exchangeRate),
    0
  )
  const totalRemaining = totalBudget - totalSpent
  const overallPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  // Filtered Budgets
  const filteredBudgets = useMemo(() => {
    return budgets.filter((b) => {
      // 1. Currency filter
      if (currencyFilter !== 'all' && (b.currency || 'IDR') !== currencyFilter) return false

      // 2. Status filter
      const spent = b.actual_spent || 0
      const limit = b.amount || 0
      const isUnset = limit <= 0
      const isOver = limit > 0 && spent > limit
      const isWarning = limit > 0 && !isOver && (spent / limit) >= 0.8
      const isHealthy = limit > 0 && (spent / limit) < 0.8

      if (statusFilter === 'over' && !isOver) return false
      if (statusFilter === 'warning' && !isWarning) return false
      if (statusFilter === 'healthy' && !isHealthy) return false
      if (statusFilter === 'unset' && !isUnset) return false

      // 3. Search query
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchCat = (b.category?.name || '').toLowerCase().includes(q)
        return matchCat
      }

      return true
    })
  }, [budgets, currencyFilter, statusFilter, search])

  const hasActiveFilters = statusFilter !== 'all' || currencyFilter !== 'all' || search !== ''

  const handleResetFilters = () => {
    setStatusFilter('all')
    setCurrencyFilter('all')
    setSearch('')
  }

  const statusOptions: Array<{ label: string; value: BudgetStatusFilter }> = [
    { label: t.budgets.filterAllStatus, value: 'all' },
    { label: t.budgets.filterOverBudget, value: 'over' },
    { label: t.budgets.filterWarning, value: 'warning' },
    { label: t.budgets.filterHealthy, value: 'healthy' },
    { label: t.budgets.filterUnset, value: 'unset' },
  ]

  const currencyOptions: Array<{ label: string; value: BudgetCurrencyFilter }> = [
    { label: t.budgets.filterAllCurrencies, value: 'all' },
    { label: 'IDR', value: 'IDR' },
    { label: 'USD', value: 'USD' },
    { label: 'SGD', value: 'SGD' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Dynamic Bilingual Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {t.budgets.title}
        </h1>
        <p className="text-xs text-foreground-secondary dark:text-foreground-muted font-mono">
          {t.budgets.subtitle}
        </p>
      </div>

      {/* Month Navigator Header & Add Budget Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-surface border border-border flex-1">
          <button
            onClick={handlePrevMonth}
            disabled={isPending}
            className="p-1.5 rounded-md text-foreground-secondary dark:text-foreground-muted hover:text-foreground hover:bg-surface-subtle transition-colors cursor-pointer disabled:opacity-50"
            title="Bulan Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-foreground">
                {formatDate(currentPeriod, 'MMMM yyyy')}
              </span>
              {isPending && <Loader2 className="w-3.5 h-3.5 text-info animate-spin" />}
            </div>
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-foreground-muted font-bold">
              {t.budgets.periodLabel}
            </span>
          </div>

          <button
            onClick={handleNextMonth}
            disabled={isPending}
            className="p-1.5 rounded-md text-foreground-secondary dark:text-foreground-muted hover:text-foreground hover:bg-surface-subtle transition-colors cursor-pointer disabled:opacity-50"
            title="Bulan Berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {categories.length > 0 && (
          <button
            type="button"
            onClick={handleAddNew}
            className="h-10 px-4 rounded-xl bg-surface-inverse hover:bg-surface-inverse/90 text-foreground-inverse text-xs font-bold transition-all active:scale-95 inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{t.budgets.modalTitle}</span>
          </button>
        )}
      </div>

      {/* Aggregate Overview Tile (Normalized in displayCurrency) */}
      {totalBudget > 0 && (
        <div className="p-4 sm:p-5 rounded-xl bg-surface border border-border flex flex-col gap-3 font-mono">
          <div className="flex items-center justify-between text-xs">
            <span className="font-sans font-bold uppercase tracking-wider text-foreground-secondary dark:text-foreground-muted text-[10px]">
              {t.budgets.aggregateTitle} ({displayCurrency})
            </span>
            <span className="font-bold text-foreground tnum">
              {isPrivate ? '••%' : `${overallPercentage.toFixed(0)}%`} {t.budgets.consumed}
            </span>
          </div>

          <div className="w-full bg-border h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                totalSpent > totalBudget ? 'bg-destructive' : 'bg-success'
              }`}
              style={{
                width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%`,
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-xs tnum">
            <div>
              <span className="text-[10px] font-sans text-foreground-muted uppercase tracking-wider block">{t.budgets.totalLimit}</span>
              <span className="font-bold text-foreground">
                {maskCurrency(formatCurrency(totalBudget, displayCurrency), isPrivate)}
              </span>
            </div>
            <div className="text-center">
              <span className="text-[10px] font-sans text-foreground-muted uppercase tracking-wider block">{t.common.spent}</span>
              <span className="font-bold text-destructive">
                {maskCurrency(formatCurrency(totalSpent, displayCurrency), isPrivate)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-sans text-foreground-muted uppercase tracking-wider block">{t.common.remaining}</span>
              <span
                className={`font-bold ${
                  totalRemaining < 0 ? 'text-destructive' : 'text-success'
                }`}
              >
                {maskCurrency(formatCurrency(totalRemaining, displayCurrency), isPrivate)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="p-3 sm:p-4 rounded-xl bg-surface border border-border flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
            <input
              type="text"
              placeholder={t.budgets.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 sm:py-2 text-xs bg-surface-subtle border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-foreground transition-colors"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-destructive hover:underline flex items-center gap-1 cursor-pointer font-semibold shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>{t.budgets.reset}</span>
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-border">
          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {statusOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setStatusFilter(item.value)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors shrink-0 whitespace-nowrap cursor-pointer border',
                  statusFilter === item.value
                    ? 'bg-surface-inverse text-foreground-inverse border-transparent shadow-2xs'
                    : 'bg-surface text-foreground-secondary dark:text-foreground-muted border-border hover:bg-surface-subtle'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Currency Filter — icon Select kayak di list Transaksi */}
          <Select
            value={currencyFilter}
            onValueChange={(val) => setCurrencyFilter(val as BudgetCurrencyFilter)}
          >
            <SelectTrigger className="h-8 w-27.5 shrink-0 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {currencyOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid of category cards or Skeleton Loader during isPending */}
      {isPending ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-in fade-in-50 duration-200">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-3.5 sm:p-4 rounded-xl bg-surface border border-border shadow-2xs flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="w-8 h-8 rounded-lg bg-surface-subtle" />
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-24 rounded-md bg-surface-muted" />
                    <Skeleton className="h-2.5 w-16 rounded-md bg-surface-subtle" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-md bg-surface-muted" />
              </div>
              <Skeleton className="h-2 w-full rounded-full bg-surface-subtle" />
              <div className="flex items-center justify-between pt-0.5">
                <Skeleton className="h-3 w-20 rounded-md bg-surface-muted" />
                <Skeleton className="h-3 w-24 rounded-md bg-surface-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredBudgets.length === 0 ? (
        <EmptyState
          icon="PieChart"
          title={t.budgets.emptyNoMatchTitle}
          description={t.budgets.emptyNoMatchDesc}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filteredBudgets.map((b) => (
            <BudgetCard key={b.id} budget={b} onEditClick={() => handleEdit(b)} />
          ))}
        </div>
      )}

      {/* Add / Edit Budget Modal */}
      <BudgetFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedBudget(null)
        }}
        budget={selectedBudget}
        categories={categories}
        periodStartDate={currentPeriod}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}
