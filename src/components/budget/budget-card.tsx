'use client'

import React from 'react'
import Link from 'next/link'
import { EnrichedBudget } from '@/types/database'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { BudgetProgressBar } from '@/components/budget/budget-progress-bar'
import { formatCurrency } from '@/lib/utils/currency'
import { useLanguage } from '@/lib/i18n/language-context'
import { AlertTriangle, ChevronRight, Check } from 'lucide-react'

interface BudgetCardProps {
  budget: EnrichedBudget
  onEditClick?: () => void
}

export function BudgetCard({ budget, onEditClick }: BudgetCardProps) {
  const { t } = useLanguage()
  const cat = budget.category
  const spent = budget.actual_spent || 0
  const budgetAmount = budget.amount || 0
  const remaining = budgetAmount - spent
  const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0
  const isOver = budgetAmount > 0 && spent > budgetAmount

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 transition-colors hover:border-[#0F172A] dark:hover:border-[#FAFAFA]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        <Link
          href={`/budget/${budget.category_id}`}
          className="flex items-center gap-2.5 min-w-0 flex-1 group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
            <DynamicIcon name={cat?.icon || 'Tag'} className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                {cat?.name || t.common.category}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
            <span className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] truncate">
              {budgetAmount > 0 ? `${percentage.toFixed(0)}% ${t.budgets.consumed}` : t.dashboard.noBudgetsSet}
            </span>
          </div>
        </Link>

        {onEditClick && (
          <button
            type="button"
            onClick={onEditClick}
            className="shrink-0 whitespace-nowrap text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] px-2.5 py-1 rounded-md transition-colors cursor-pointer"
          >
            {budgetAmount > 0 ? t.common.edit : `+ ${t.dashboard.setLimits}`}
          </button>
        )}
      </div>

      {/* Progress */}
      {budgetAmount > 0 && <BudgetProgressBar spent={spent} budget={budgetAmount} />}

      {/* Financial breakdown */}
      <div className="flex items-center justify-between text-xs pt-0.5 font-mono tnum">
        <div className="flex flex-col">
          <span className="text-[#94A3B8] text-[10px] uppercase tracking-wider">{t.common.spent}</span>
          <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            {formatCurrency(spent, 'IDR')}
          </span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[#94A3B8] text-[10px] uppercase tracking-wider">{t.common.limit}</span>
          <span className="font-medium text-[#475569] dark:text-[#94A3B8]">
            {budgetAmount > 0 ? formatCurrency(budgetAmount, 'IDR') : '—'}
          </span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[#94A3B8] text-[10px] uppercase tracking-wider">
            {isOver ? t.common.deficit : t.common.remaining}
          </span>
          <span
            className={`font-bold flex items-center gap-1 ${
              isOver ? 'text-[#E11D48]' : 'text-[#0D9488]'
            }`}
          >
            {isOver && <AlertTriangle className="w-3 h-3" />}
            {!isOver && budgetAmount > 0 && <Check className="w-3 h-3" />}
            {formatCurrency(Math.abs(remaining), 'IDR')}
          </span>
        </div>
      </div>
    </div>
  )
}
