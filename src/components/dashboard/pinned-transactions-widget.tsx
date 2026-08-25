'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { usePinnedTemplates, removePinnedTemplate, PinnedTemplate } from '@/lib/storage/pinned-templates'
import { formatCurrency } from '@/lib/utils/currency'
import { usePrivacyMode, maskCurrency } from '@/lib/storage/privacy-mode'
import { useLanguage } from '@/lib/i18n/language-context'
import { createTransaction } from '@/actions/transactions'
import { Pin, Zap, X, Check, ChevronLeft, ChevronRight } from 'lucide-react'

export function PinnedTransactionsWidget() {
  const router = useRouter()
  const { language, t } = useLanguage()
  const isPrivate = usePrivacyMode()
  const templates = usePinnedTemplates()
  const [loggingId, setLoggingId] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  if (templates.length === 0) {
    return null
  }

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -220, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 220, behavior: 'smooth' })
    }
  }

  const handleInstantLog = async (tpl: PinnedTemplate) => {
    setLoggingId(tpl.id)
    try {
      await createTransaction({
        accountId: tpl.accountId,
        categoryId: tpl.categoryId,
        type: tpl.type,
        amount: tpl.amount,
        currency: tpl.currency,
        description: tpl.description || null,
        transactionDate: new Date().toISOString(), // Always logs for today's current timestamp!
      })
      setSuccessId(tpl.id)
      router.refresh()
      setTimeout(() => setSuccessId(null), 2000)
    } finally {
      setLoggingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
          <Pin className="w-3.5 h-3.5 text-[#0F172A] dark:text-[#FAFAFA]" />
          <span>{t.dashboard.pinnedTitle}</span>
        </h2>

        <div className="flex items-center gap-2">
          {/* Scroll Navigation Arrows: Hidden on mobile (swipe), visible on desktop */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={scrollLeft}
              className="p-1 rounded-md bg-[#F1F3F5] dark:bg-[#1A1A20] hover:bg-[#E2E8F0] dark:hover:bg-[#27272A] text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA] border border-[#E5E7EB] dark:border-[#27272A] transition-colors cursor-pointer"
              title={t.dashboard.scrollLeft || 'Scroll Left'}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={scrollRight}
              className="p-1 rounded-md bg-[#F1F3F5] dark:bg-[#1A1A20] hover:bg-[#E2E8F0] dark:hover:bg-[#27272A] text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA] border border-[#E5E7EB] dark:border-[#27272A] transition-colors cursor-pointer"
              title={t.dashboard.scrollRight || 'Scroll Right'}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            {t.dashboard.pinnedTapToLog}
          </span>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-0.5 no-scrollbar scroll-smooth"
      >
        {templates.map((tpl) => {
          const isLogging = loggingId === tpl.id
          const isSuccess = successId === tpl.id

          return (
            <div
              key={tpl.id}
              className="relative min-w-[160px] sm:min-w-[190px] shrink-0 p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors flex flex-col justify-between group shadow-2xs"
            >
              <button
                type="button"
                onClick={() => removePinnedTemplate(tpl.id)}
                className="absolute right-2 top-2 p-1 text-[#94A3B8] hover:text-[#E11D48] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                title={t.dashboard.deletePinnedTitle || 'Remove pin'}
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleInstantLog(tpl)}
                disabled={isLogging}
                className="flex flex-col text-left w-full cursor-pointer select-none"
              >
                <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate pr-4">
                  {tpl.name}
                </span>
                <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate mt-0.5">
                  {tpl.categoryName || (language === 'en' ? 'Category' : 'Kategori')} • {tpl.accountName || (language === 'en' ? 'Account' : 'Akun')}
                </span>

                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#E5E7EB] dark:border-[#27272A]">
                  <span
                    className={`text-xs font-mono font-bold tnum truncate ${
                      tpl.type === 'income' ? 'text-[#0D9488]' : 'text-[#E11D48]'
                    }`}
                  >
                    {maskCurrency(formatCurrency(tpl.amount, tpl.currency), isPrivate)}
                  </span>

                  <div className="w-5 h-5 rounded bg-[#F1F3F5] dark:bg-[#1A1A20] flex items-center justify-center text-[#0F172A] dark:text-[#FAFAFA] shrink-0 ml-1">
                    {isSuccess ? (
                      <Check className="w-3 h-3 text-[#0D9488]" />
                    ) : isLogging ? (
                      <span className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3" />
                    )}
                  </div>
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
