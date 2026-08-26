'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { EnrichedRecurringTransaction } from '@/types/database'
import { formatCurrency } from '@/lib/utils/currency'
import { usePreferredCurrency } from '@/lib/storage/preferred-currency'
import { usePrivacyMode, maskCurrency } from '@/lib/storage/privacy-mode'
import { useLanguage } from '@/lib/i18n/language-context'
import { processRecurringPayment } from '@/actions/recurring'
import { parseISO, differenceInCalendarDays } from 'date-fns'
import { Flame, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'

interface RecurringDueBannerProps {
  recurringTransactions: EnrichedRecurringTransaction[]
}

export function RecurringDueBanner({ recurringTransactions }: RecurringDueBannerProps) {
  const { t, language } = useLanguage()
  const displayCurrency = usePreferredCurrency()
  const isPrivate = usePrivacyMode()
  const today = new Date()

  const [processingId, setProcessingId] = useState<string | null>(null)
  const [hiddenIds, setHiddenIds] = useState<string[]>([])

  // Find active items due in <= 3 days (including overdue)
  const dueItems = recurringTransactions.filter((item) => {
    if (!item.is_active || hiddenIds.includes(item.id)) return false
    try {
      const dueDate = parseISO(item.next_due_date)
      const diff = differenceInCalendarDays(dueDate, today)
      return diff <= 3
    } catch {
      return false
    }
  })

  if (dueItems.length === 0) return null

  const handleQuickPay = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setProcessingId(id)
    try {
      const res = await processRecurringPayment(id)
      if (res.success) {
        setHiddenIds((prev) => [...prev, id])
      }
    } finally {
      setProcessingId(null)
    }
  }

  const firstItem = dueItems[0]
  const diffDays = differenceInCalendarDays(parseISO(firstItem.next_due_date), today)

  return (
    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
          <Flame className="w-5 h-5 animate-pulse" />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#0F172A] dark:text-[#FAFAFA]">
              {t.recurring.dueBannerTitle}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white">
              {dueItems.length}
            </span>
          </div>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
            <strong className="text-[#0F172A] dark:text-[#FAFAFA]">{firstItem.name}</strong> (
            {maskCurrency(formatCurrency(firstItem.amount, firstItem.currency), isPrivate)}){' '}
            {diffDays < 0
              ? `• ${t.recurring.overdue.replace('{days}', String(Math.abs(diffDays)))}`
              : diffDays === 0
                ? `• ${t.recurring.dueToday}`
                : `• ${t.recurring.dueInDays.replace('{days}', String(diffDays))}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        <button
          type="button"
          disabled={processingId === firstItem.id}
          onClick={(e) => handleQuickPay(firstItem.id, e)}
          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          {processingId === firstItem.id ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          <span>{language === 'en' ? 'Pay Now' : 'Bayar Sekarang'}</span>
        </button>

        <Link
          href="/recurring"
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA] hover:bg-amber-500/10 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span>{t.recurring.viewAllBtn}</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
