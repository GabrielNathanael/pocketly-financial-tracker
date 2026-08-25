'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { EnrichedBudget, Category } from '@/types/database'
import { BudgetCard } from '@/components/budget/budget-card'
import { BudgetFormModal } from '@/components/budget/budget-form'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCurrency, convertAmount } from '@/lib/utils/currency'
import { usePrivacyMode, maskCurrency } from '@/lib/storage/privacy-mode'
import { getNextMonth, getPrevMonth, formatDate } from '@/lib/utils/date'
import { useLanguage } from '@/lib/i18n/language-context'
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

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
  const { language, t } = useLanguage()
  const isId = language === 'id'
  const isPrivate = usePrivacyMode()

  const [selectedBudget, setSelectedBudget] = useState<EnrichedBudget | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<BudgetStatusFilter>('all')
  const [currencyFilter, setCurrencyFilter] = useState<BudgetCurrencyFilter>('all')
  const [search, setSearch] = useState('')

  const handlePrevMonth = () => {
    const prev = getPrevMonth(currentPeriod)
    router.push(`/budget?period=${prev}`)
  }

  const handleNextMonth = () => {
    const next = getNextMonth(currentPeriod)
    router.push(`/budget?period=${next}`)
  }

  const handleEdit = (b: EnrichedBudget) => {
    setSelectedBudget(b)
    setIsModalOpen(true)
  }

  const handleAddNew = () => {
    setSelectedBudget(null)
    setIsModalOpen(true)
  }

  // Aggregate in IDR using live exchange rates
  const totalBudget = budgets.reduce(
    (acc, b) => acc + convertAmount(b.amount || 0, b.currency || 'IDR', 'IDR', exchangeRate),
    0
  )
  const totalSpent = budgets.reduce(
    (acc, b) => acc + convertAmount(b.actual_spent || 0, b.currency || 'IDR', 'IDR', exchangeRate),
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
    { label: isId ? 'Semua Status' : 'All Status', value: 'all' },
    { label: isId ? 'Defisit (Over Budget)' : 'Over Budget', value: 'over' },
    { label: isId ? 'Waspada (>80%)' : 'Warning (>80%)', value: 'warning' },
    { label: isId ? 'Aman (<80%)' : 'Healthy (<80%)', value: 'healthy' },
    { label: isId ? 'Tanpa Batas' : 'Unset Limit', value: 'unset' },
  ]

  const currencyOptions: Array<{ label: string; value: BudgetCurrencyFilter }> = [
    { label: isId ? 'Semua Valas' : 'All Currencies', value: 'all' },
    { label: 'IDR', value: 'IDR' },
    { label: 'USD', value: 'USD' },
    { label: 'SGD', value: 'SGD' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Dynamic Bilingual Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
          {t.budgets.title}
        </h1>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
          {t.budgets.subtitle}
        </p>
      </div>

      {/* Month Navigator Header & Add Budget Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex-1">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-md text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] transition-colors cursor-pointer"
            title="Bulan Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex flex-col items-center">
            <span className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              {formatDate(currentPeriod, 'MMMM yyyy')}
            </span>
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold">
              {t.budgets.periodLabel}
            </span>
          </div>

          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-md text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] transition-colors cursor-pointer"
            title="Bulan Berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {categories.length > 0 && (
          <button
            type="button"
            onClick={handleAddNew}
            className="h-10 px-4 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-[#FAFAFA] dark:hover:bg-[#E2E8F0] text-white dark:text-[#0F172A] text-xs font-bold transition-all active:scale-95 inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{t.budgets.modalTitle}</span>
          </button>
        )}
      </div>

      {/* Aggregate Overview Tile (Normalized in IDR) */}
      {totalBudget > 0 && (
        <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 font-mono">
          <div className="flex items-center justify-between text-xs">
            <span className="font-sans font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] text-[10px]">
              {t.budgets.aggregateTitle} (IDR)
            </span>
            <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] tnum">
              {isPrivate ? '••%' : `${overallPercentage.toFixed(0)}%`} {t.budgets.consumed}
            </span>
          </div>

          <div className="w-full bg-[#E5E7EB] dark:bg-[#27272A] h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                totalSpent > totalBudget ? 'bg-[#E11D48]' : 'bg-[#0D9488]'
              }`}
              style={{
                width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%`,
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A] text-xs tnum">
            <div>
              <span className="text-[10px] font-sans text-[#94A3B8] uppercase tracking-wider block">{t.budgets.totalLimit}</span>
              <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {maskCurrency(formatCurrency(totalBudget, 'IDR'), isPrivate)}
              </span>
            </div>
            <div className="text-center">
              <span className="text-[10px] font-sans text-[#94A3B8] uppercase tracking-wider block">{t.common.spent}</span>
              <span className="font-bold text-[#E11D48]">
                {maskCurrency(formatCurrency(totalSpent, 'IDR'), isPrivate)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-sans text-[#94A3B8] uppercase tracking-wider block">{t.common.remaining}</span>
              <span
                className={`font-bold ${
                  totalRemaining < 0 ? 'text-[#E11D48]' : 'text-[#0D9488]'
                }`}
              >
                {maskCurrency(formatCurrency(totalRemaining, 'IDR'), isPrivate)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
            <input
              type="text"
              placeholder={isId ? 'Cari kategori anggaran...' : 'Search budget category...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 sm:py-2 text-xs bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] rounded-lg text-[#0F172A] dark:text-[#FAFAFA] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-white transition-colors"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-[#E11D48] hover:underline flex items-center gap-1 cursor-pointer font-semibold shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>{isId ? 'Reset' : 'Reset'}</span>
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-[#E5E7EB] dark:border-[#27272A]">
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
                    ? 'bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] border-transparent shadow-2xs'
                    : 'bg-white dark:bg-[#121215] text-[#64748B] dark:text-[#94A3B8] border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20]'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Currency Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {currencyOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setCurrencyFilter(item.value)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold transition-colors shrink-0 whitespace-nowrap cursor-pointer border',
                  currencyFilter === item.value
                    ? 'bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] border-transparent shadow-2xs'
                    : 'bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#64748B] dark:text-[#94A3B8] border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F1F3F5] dark:hover:bg-[#26262E]'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of category cards */}
      {filteredBudgets.length === 0 ? (
        <EmptyState
          icon="PieChart"
          title={isId ? 'Tidak ada anggaran yang cocok' : 'No matching budgets found'}
          description={isId ? 'Coba ubah filter pencarian atau buat batas anggaran baru.' : 'Try adjusting your search criteria or set a new budget limit.'}
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
