'use client'

import React from 'react'
import Link from 'next/link'
import { EnrichedBudget } from '@/types/database'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { BudgetProgressBar } from '@/components/budget/budget-progress-bar'
import { formatCurrency } from '@/lib/utils/currency'
import { usePrivacyMode, maskCurrency } from '@/lib/storage/privacy-mode'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowRight, AlertTriangle } from 'lucide-react'

interface BudgetOverviewWidgetProps {
  budgets: EnrichedBudget[]
}

export function BudgetOverviewWidget({ budgets }: BudgetOverviewWidgetProps) {
  const { t } = useLanguage()
  const isPrivate = usePrivacyMode()
  const activeBudgets = budgets.filter((b) => (b.amount || 0) > 0)

  if (activeBudgets.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
            {t.dashboard.budgetTitle}
          </span>
          <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            {t.dashboard.noBudgetsSet}
          </span>
        </div>
        <Link
          href="/budget"
          className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA] hover:underline"
        >
          {t.dashboard.setLimits}
        </Link>
      </div>
    )
  }

  const sorted = [...activeBudgets].sort((a, b) => {
    const pctA = (a.actual_spent || 0) / (a.amount || 1)
    const pctB = (b.actual_spent || 0) / (b.amount || 1)
    return pctB - pctA
  })

  const topItems = sorted.slice(0, 3)

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
          {t.dashboard.budgetTitle}
        </h2>
        <Link
          href="/budget"
          className="text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] flex items-center gap-0.5"
        >
          <span>{t.dashboard.allBudgets}</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {topItems.map((b) => {
          const spent = b.actual_spent || 0
          const budget = b.amount || 0
          const percentage = (spent / budget) * 100
          const isOver = spent > budget
          const cat = b.category

          return (
            <Link
              key={b.id}
              href={`/budget/${b.category_id}?currency=${b.currency || 'IDR'}`}
              className="p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors flex flex-col gap-2.5 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
                    <DynamicIcon name={cat?.icon || 'Tag'} className="w-3 h-3" />
                  </div>
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                      {cat?.name}
                    </span>
                    <span className="text-[9px] font-mono font-bold px-1 rounded bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#64748B] dark:text-[#94A3B8]">
                      {b.currency || 'IDR'}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-mono font-bold flex items-center gap-0.5 ${
                    isOver ? 'text-[#E11D48]' : percentage >= 85 ? 'text-[#D97706]' : 'text-[#0D9488]'
                  }`}
                >
                  {isOver && <AlertTriangle className="w-3 h-3" />}
                  {percentage.toFixed(0)}%
                </span>
              </div>

              <BudgetProgressBar spent={spent} budget={budget} />

              <div className="flex items-center justify-between text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8] tnum pt-0.5">
                <span>{maskCurrency(formatCurrency(spent, b.currency || 'IDR'), isPrivate)}</span>
                <span>/ {maskCurrency(formatCurrency(budget, b.currency || 'IDR'), isPrivate)}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
