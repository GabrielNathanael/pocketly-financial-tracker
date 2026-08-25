'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EnrichedBudget } from '@/types/database'
import { BudgetCard } from '@/components/budget/budget-card'
import { BudgetFormModal } from '@/components/budget/budget-form'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCurrency } from '@/lib/utils/currency'
import { getNextMonth, getPrevMonth, formatDate } from '@/lib/utils/date'
import { useLanguage } from '@/lib/i18n/language-context'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface BudgetManagerProps {
  budgets: EnrichedBudget[]
  currentPeriod: string
}

export function BudgetManager({ budgets, currentPeriod }: BudgetManagerProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [selectedBudget, setSelectedBudget] = useState<EnrichedBudget | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

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

  const totalBudget = budgets.reduce((acc, b) => acc + (b.amount || 0), 0)
  const totalSpent = budgets.reduce((acc, b) => acc + (b.actual_spent || 0), 0)
  const totalRemaining = totalBudget - totalSpent
  const overallPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Month Navigator Header */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A]">
        <button
          onClick={handlePrevMonth}
          className="p-1.5 rounded-md text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] transition-colors cursor-pointer"
          title="Previous Month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            {formatDate(currentPeriod, 'MMMM yyyy')}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold">
            {t.budgets.periodLabel}
          </span>
        </div>

        <button
          onClick={handleNextMonth}
          className="p-1.5 rounded-md text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] transition-colors cursor-pointer"
          title="Next Month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Aggregate Overview Tile */}
      {totalBudget > 0 && (
        <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 font-mono">
          <div className="flex items-center justify-between text-xs">
            <span className="font-sans font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] text-[10px]">
              {t.budgets.aggregateTitle}
            </span>
            <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] tnum">
              {overallPercentage.toFixed(0)}% {t.budgets.consumed}
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
                {formatCurrency(totalBudget, 'IDR')}
              </span>
            </div>
            <div className="text-center">
              <span className="text-[10px] font-sans text-[#94A3B8] uppercase tracking-wider block">{t.common.spent}</span>
              <span className="font-bold text-[#E11D48]">
                {formatCurrency(totalSpent, 'IDR')}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-sans text-[#94A3B8] uppercase tracking-wider block">{t.common.remaining}</span>
              <span
                className={`font-bold ${
                  totalRemaining < 0 ? 'text-[#E11D48]' : 'text-[#0D9488]'
                }`}
              >
                {formatCurrency(totalRemaining, 'IDR')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Grid of category cards */}
      {budgets.length === 0 ? (
        <EmptyState
          icon="PieChart"
          title={t.budgets.emptyTitle}
          description={t.budgets.emptyDesc}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {budgets.map((b) => (
            <BudgetCard key={b.id} budget={b} onEditClick={() => handleEdit(b)} />
          ))}
        </div>
      )}

      {/* Edit Budget Modal */}
      <BudgetFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedBudget(null)
        }}
        budget={selectedBudget}
        periodStartDate={currentPeriod}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}
