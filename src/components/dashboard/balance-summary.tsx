'use client'

import React from 'react'
import Link from 'next/link'
import { formatCurrency, convertAmount } from '@/lib/utils/currency'
import { usePreferredCurrency } from '@/lib/storage/preferred-currency'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowDownRight, ArrowUpRight, ArrowRight } from 'lucide-react'

interface BalanceSummaryProps {
  totalBalanceIdr: number
  totalIncomeMonth: number
  totalExpenseMonth: number
  exchangeRate: number
}

export function BalanceSummary({
  totalBalanceIdr,
  totalIncomeMonth,
  totalExpenseMonth,
  exchangeRate,
}: BalanceSummaryProps) {
  const { t } = useLanguage()
  const displayCurrency = usePreferredCurrency()

  const displayTotal = convertAmount(totalBalanceIdr, 'IDR', displayCurrency, exchangeRate)
  const displayIncome = convertAmount(totalIncomeMonth, 'IDR', displayCurrency, exchangeRate)
  const displayExpense = convertAmount(totalExpenseMonth, 'IDR', displayCurrency, exchangeRate)

  return (
    <div className="flex flex-col gap-3">
      <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            {t.dashboard.netBalance} ({displayCurrency})
          </span>
          <Link
            href="/transactions"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA] hover:underline"
          >
            <span>{t.dashboard.allTransactions}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Big Balance */}
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] dark:text-[#FAFAFA] font-mono tracking-tight tnum">
            {formatCurrency(displayTotal, displayCurrency)}
          </h2>
          {displayCurrency !== 'IDR' && (
            <span className="text-xs font-mono text-[#94A3B8] tnum">
              ≈ {formatCurrency(totalBalanceIdr, 'IDR')}
            </span>
          )}
        </div>

        {/* 2 Mini cards (Income & Expense) */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E5E7EB] dark:border-[#27272A]">
          {/* Income this month */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              <div className="w-4 h-4 rounded-full bg-[#ECFDF5] dark:bg-[#064E3B]/30 flex items-center justify-center text-[#0D9488]">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
              <span>{t.dashboard.incomeMonth}</span>
            </div>
            <span className="text-sm sm:text-base font-bold font-mono text-[#0D9488] tracking-tight tnum">
              +{formatCurrency(displayIncome, displayCurrency)}
            </span>
          </div>

          {/* Expense this month */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              <div className="w-4 h-4 rounded-full bg-[#FFF1F2] dark:bg-[#881337]/30 flex items-center justify-center text-[#E11D48]">
                <ArrowDownRight className="w-3.5 h-3.5" />
              </div>
              <span>{t.dashboard.expenseMonth}</span>
            </div>
            <span className="text-sm sm:text-base font-bold font-mono text-[#E11D48] tracking-tight tnum">
              -{formatCurrency(displayExpense, displayCurrency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
