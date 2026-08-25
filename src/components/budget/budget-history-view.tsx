'use client'

import React from 'react'
import Link from 'next/link'
import { Category } from '@/types/database'
import { CategoryHistoryItem } from '@/actions/budgets'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { BudgetProgressBar } from '@/components/budget/budget-progress-bar'
import { formatCurrency } from '@/lib/utils/currency'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowLeft, AlertTriangle } from 'lucide-react'

interface BudgetHistoryViewProps {
  category: Category
  history: CategoryHistoryItem[]
}

export function BudgetHistoryView({ category, history }: BudgetHistoryViewProps) {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto">
      <div>
        <Link
          href="/budget"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.budgets.backToBudgets}</span>
        </Link>
      </div>

      {/* Category Header Card */}
      <div className="p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
          <DynamicIcon name={category.icon} className="w-5 h-5" />
        </div>

        <div>
          <h1 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            {category.name}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
            {t.budgets.historySubtitle}
          </p>
        </div>
      </div>

      {/* 6-Month Historical List */}
      <div className="flex flex-col gap-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC] px-0.5">
          {t.budgets.historyTitle}
        </h2>

        {history.map((item) => {
          const isOver = item.budgetAmount > 0 && item.actualSpent > item.budgetAmount
          const pct = item.budgetAmount > 0 ? (item.actualSpent / item.budgetAmount) * 100 : 0

          return (
            <div
              key={item.periodStart}
              className="p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  {item.periodLabel}
                </span>
                <span
                  className={`text-xs font-mono font-bold flex items-center gap-1 ${
                    isOver ? 'text-[#E11D48]' : 'text-[#64748B] dark:text-[#94A3B8]'
                  }`}
                >
                  {isOver && <AlertTriangle className="w-3.5 h-3.5" />}
                  {item.budgetAmount > 0 ? `${pct.toFixed(0)}% ${t.budgets.consumed}` : '—'}
                </span>
              </div>

              {item.budgetAmount > 0 && (
                <BudgetProgressBar spent={item.actualSpent} budget={item.budgetAmount} />
              )}

              <div className="flex items-center justify-between text-xs pt-1 border-t border-[#E5E7EB] dark:border-[#27272A] font-mono tnum">
                <div>
                  <span className="text-[10px] font-sans text-[#94A3B8] uppercase tracking-wider block">
                    {t.budgets.actualSpent}
                  </span>
                  <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    {formatCurrency(item.actualSpent, 'IDR')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-sans text-[#94A3B8] uppercase tracking-wider block">
                    {t.budgets.totalLimit}
                  </span>
                  <span className="font-medium text-[#64748B] dark:text-[#94A3B8]">
                    {item.budgetAmount > 0 ? formatCurrency(item.budgetAmount, 'IDR') : '—'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
