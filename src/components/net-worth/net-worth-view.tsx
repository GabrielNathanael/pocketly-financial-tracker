'use client'

import React from 'react'
import Link from 'next/link'
import { formatCurrency, ForexRatesMap, convertAmount } from '@/lib/utils/currency'
import { usePreferredCurrency } from '@/lib/storage/preferred-currency'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowLeft, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface NetWorthData {
  totalAccountsIdr: number
  totalDebtsIdr: number
  totalReceivablesIdr: number
  netWorthIdr: number
  exchangeRate: number
  rates?: ForexRatesMap
}

interface NetWorthViewProps {
  data: NetWorthData
}

export function NetWorthView({ data }: NetWorthViewProps) {
  const { t } = useLanguage()
  const displayCurrency = usePreferredCurrency()

  const convertedTotalAccounts = convertAmount(data.totalAccountsIdr, 'IDR', displayCurrency, data.rates)
  const convertedReceivables = convertAmount(data.totalReceivablesIdr, 'IDR', displayCurrency, data.rates)
  const convertedDebts = convertAmount(data.totalDebtsIdr, 'IDR', displayCurrency, data.rates)
  const convertedNetWorth = convertedTotalAccounts + convertedReceivables - convertedDebts

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.netWorth.backToHome}</span>
        </Link>
      </div>

      {/* Main Net Worth Total Hero */}
      <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            {t.netWorth.calculatedPosition} ({displayCurrency})
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#64748B] dark:text-[#94A3B8] border border-[#E5E7EB] dark:border-[#27272A]">
            Real-time Forex
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight tnum">
          {formatCurrency(convertedNetWorth, displayCurrency)}
        </h1>

        {displayCurrency !== 'IDR' && (
          <span className="text-xs font-mono text-[#94A3B8] tnum">
            ≈ {formatCurrency(data.netWorthIdr, 'IDR')}
          </span>
        )}

        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
          {t.netWorth.formula}
        </p>
      </div>

      {/* Structured Ledger Balance Sheet Breakdown (Vertical Stacked Cards) */}
      <div className="p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4 shadow-2xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
          {t.netWorth.breakdownTitle}
        </h2>

        <div className="flex flex-col gap-3 font-mono tnum">
          {/* Liquid Accounts */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
            <div className="flex items-center gap-2.5 font-sans">
              <div className="w-7 h-7 rounded bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center">
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {t.netWorth.liquidAssets}
              </span>
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              {formatCurrency(convertedTotalAccounts, displayCurrency)}
            </span>
          </div>

          {/* Receivables */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
            <div className="flex items-center gap-2.5 font-sans">
              <div className="w-7 h-7 rounded bg-[#ECFDF5] dark:bg-[#064E3B]/20 border border-[#A7F3D0] dark:border-[#065F46]/40 text-[#0D9488] flex items-center justify-center">
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {t.netWorth.activeReceivables}
              </span>
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#0D9488]">
              +{formatCurrency(convertedReceivables, displayCurrency)}
            </span>
          </div>

          {/* Debts */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
            <div className="flex items-center gap-2.5 font-sans">
              <div className="w-7 h-7 rounded bg-[#FFF1F2] dark:bg-[#881337]/20 border border-[#FECDD3] dark:border-[#9F1239]/40 text-[#E11D48] flex items-center justify-center">
                <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {t.netWorth.activeLiabilities}
              </span>
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#E11D48]">
              -{formatCurrency(convertedDebts, displayCurrency)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB] dark:border-[#27272A] font-mono">
          <span className="font-sans text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            {t.netWorth.netTotal}
          </span>
          <span className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] tnum">
            {formatCurrency(convertedNetWorth, displayCurrency)}
          </span>
        </div>
      </div>
    </div>
  )
}
