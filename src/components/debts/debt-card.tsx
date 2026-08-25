'use client'

import React from 'react'
import Link from 'next/link'
import { EnrichedDebtWithPayments } from '@/actions/debts'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowDownRight, ArrowUpRight, ChevronRight, Calendar } from 'lucide-react'

interface DebtCardProps {
  debt: EnrichedDebtWithPayments
  onRecordPaymentClick?: () => void
}

export function DebtCard({ debt, onRecordPaymentClick }: DebtCardProps) {
  const { t } = useLanguage()
  const isDebt = debt.type === 'debt'
  const isPaid = debt.status === 'paid' || Number(debt.remaining_amount) <= 0
  const progress =
    Number(debt.initial_amount) > 0
      ? ((Number(debt.initial_amount) - Number(debt.remaining_amount)) / Number(debt.initial_amount)) * 100
      : 100

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 transition-colors hover:border-[#0F172A] dark:hover:border-[#FAFAFA]">
      <div className="flex items-center justify-between">
        <Link href={`/debts/${debt.id}`} className="flex items-center gap-2.5 min-w-0 group cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
            {isDebt ? (
              <ArrowDownRight className="w-4 h-4 text-[#E11D48]" />
            ) : (
              <ArrowUpRight className="w-4 h-4 text-[#0D9488]" />
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                {debt.counterparty_name}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              <span>{isDebt ? t.debts.debtType : t.debts.receivableType}</span>
              {debt.due_date && (
                <span className="flex items-center gap-0.5 text-[10px] font-mono text-[#94A3B8]">
                  <Calendar className="w-3 h-3" /> {formatDate(debt.due_date, 'dd MMM')}
                </span>
              )}
            </div>
          </div>
        </Link>

        <Badge variant={isPaid ? 'success' : isDebt ? 'danger' : 'info'}>
          {isPaid ? t.debts.paidStatus : t.debts.activeStatus}
        </Badge>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-[#E5E7EB] dark:bg-[#27272A] h-1.5 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isPaid ? 'bg-[#0D9488]' : isDebt ? 'bg-[#E11D48]' : 'bg-[#0284C7]'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>

      {/* Details */}
      <div className="flex items-center justify-between text-xs pt-0.5 font-mono tnum">
        <div>
          <span className="text-[#94A3B8] text-[10px] font-sans uppercase tracking-wider block">{t.debts.remainingTagihan}</span>
          <span
            className={`font-bold ${
              isPaid ? 'text-[#94A3B8]' : isDebt ? 'text-[#E11D48]' : 'text-[#0D9488]'
            }`}
          >
            {formatCurrency(debt.remaining_amount, debt.currency)}
          </span>
        </div>

        <div className="text-right">
          <span className="text-[#94A3B8] text-[10px] font-sans uppercase tracking-wider block">{t.debts.principalLabel}</span>
          <span className="font-semibold text-[#475569] dark:text-[#94A3B8]">
            {formatCurrency(debt.initial_amount, debt.currency)}
          </span>
        </div>
      </div>

      {!isPaid && onRecordPaymentClick && (
        <div className="pt-2 border-t border-[#E5E7EB] dark:border-[#27272A] flex justify-end">
          <button
            type="button"
            onClick={onRecordPaymentClick}
            className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA] hover:underline cursor-pointer"
          >
            + {t.debts.recordPayment}
          </button>
        </div>
      )}
    </div>
  )
}
