'use client'

import React from 'react'
import Link from 'next/link'
import { formatCurrency, convertAmount } from '@/lib/utils/currency'
import { usePreferredCurrency } from '@/lib/storage/preferred-currency'
import { usePrivacyMode, maskCurrency, togglePrivacyMode } from '@/lib/storage/privacy-mode'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowDownRight, ArrowUpRight, ArrowRight, Eye, EyeOff } from 'lucide-react'

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
  const { t, language } = useLanguage()
  const displayCurrency = usePreferredCurrency()
  const isPrivate = usePrivacyMode()

  const displayTotal = convertAmount(totalBalanceIdr, 'IDR', displayCurrency, exchangeRate)
  const displayIncome = convertAmount(totalIncomeMonth, 'IDR', displayCurrency, exchangeRate)
  const displayExpense = convertAmount(totalExpenseMonth, 'IDR', displayCurrency, exchangeRate)

  const privacyTooltip = isPrivate
    ? language === 'id' ? 'Tampilkan Saldo' : 'Show Balance'
    : language === 'id' ? 'Sembunyikan Saldo (Privasi)' : 'Hide Balance (Privacy)'

  const formattedTotal = maskCurrency(formatCurrency(displayTotal, displayCurrency), isPrivate)
  const formattedIncome = maskCurrency(formatCurrency(displayIncome, displayCurrency), isPrivate)
  const formattedExpense = maskCurrency(formatCurrency(displayExpense, displayCurrency), isPrivate)

  const getBigBalanceFontSize = (len: number) => {
    if (len > 22) return 'text-xl sm:text-2xl md:text-3xl'
    if (len > 16) return 'text-2xl sm:text-3xl md:text-4xl'
    if (len > 12) return 'text-[1.7rem] sm:text-3xl md:text-4xl'
    return 'text-3xl sm:text-4xl'
  }

  const getSubCardFontSize = (len: number) => {
    if (len > 18) return 'text-xs sm:text-sm'
    if (len > 14) return 'text-[13px] sm:text-sm md:text-base'
    return 'text-sm sm:text-base'
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4 shadow-2xs">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] truncate">
              {t.dashboard.netBalance} ({displayCurrency})
            </span>
            <button
              type="button"
              onClick={() => togglePrivacyMode()}
              className="p-1 rounded-md text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] transition-colors cursor-pointer shrink-0"
              title={privacyTooltip}
              aria-label={privacyTooltip}
            >
              {isPrivate ? <EyeOff className="w-3.5 h-3.5 text-amber-500" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <Link
            href="/transactions"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA] hover:underline shrink-0 whitespace-nowrap"
          >
            <span>{t.dashboard.allTransactions}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Big Balance with Auto-Scale */}
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className={`font-extrabold text-[#0F172A] dark:text-[#FAFAFA] font-mono tracking-tight tnum break-words leading-none ${getBigBalanceFontSize(formattedTotal.length)}`}>
            {formattedTotal}
          </h2>
          {displayCurrency !== 'IDR' && (
            <span className="text-xs font-mono text-[#94A3B8] tnum">
              ≈ {maskCurrency(formatCurrency(totalBalanceIdr, 'IDR'), isPrivate)}
            </span>
          )}
        </div>

        {/* 2 Mini cards (Income & Expense) with Auto-Scale */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E5E7EB] dark:border-[#27272A]">
          {/* Income this month */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1 text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              <div className="w-4 h-4 rounded-full bg-[#ECFDF5] dark:bg-[#064E3B]/30 flex items-center justify-center text-[#0D9488] shrink-0">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
              <span className="truncate">{t.dashboard.incomeMonth}</span>
            </div>
            <span className={`font-bold font-mono text-[#0D9488] tracking-tight tnum truncate ${getSubCardFontSize(formattedIncome.length)}`}>
              +{formattedIncome}
            </span>
          </div>

          {/* Expense this month */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1 text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              <div className="w-4 h-4 rounded-full bg-[#FFF1F2] dark:bg-[#881337]/30 flex items-center justify-center text-[#E11D48] shrink-0">
                <ArrowDownRight className="w-3.5 h-3.5" />
              </div>
              <span className="truncate">{t.dashboard.expenseMonth}</span>
            </div>
            <span className={`font-bold font-mono text-[#E11D48] tracking-tight tnum truncate ${getSubCardFontSize(formattedExpense.length)}`}>
              -{formattedExpense}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
