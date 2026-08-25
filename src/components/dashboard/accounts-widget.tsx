'use client'

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import { Account } from '@/types/database'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { formatCurrency } from '@/lib/utils/currency'
import { TransferModal } from '@/components/accounts/transfer-modal'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowRightLeft, Plus, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'

interface AccountsWidgetProps {
  accounts: Account[]
  exchangeRate?: number
}

export function AccountsWidget({ accounts, exchangeRate }: AccountsWidgetProps) {
  const { t } = useLanguage()
  const [isTransferOpen, setIsTransferOpen] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
            {t.dashboard.accountsTitle} ({accounts.length})
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Scroll Navigation Arrows */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={scrollLeft}
              className="p-1 rounded-md bg-[#F1F3F5] dark:bg-[#1A1A20] hover:bg-[#E2E8F0] dark:hover:bg-[#27272A] text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA] border border-[#E5E7EB] dark:border-[#27272A] transition-colors cursor-pointer"
              title="Scroll Kiri"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={scrollRight}
              className="p-1 rounded-md bg-[#F1F3F5] dark:bg-[#1A1A20] hover:bg-[#E2E8F0] dark:hover:bg-[#27272A] text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA] border border-[#E5E7EB] dark:border-[#27272A] transition-colors cursor-pointer"
              title="Scroll Kanan"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {accounts.length >= 2 && (
            <button
              onClick={() => setIsTransferOpen(true)}
              className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA] hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <ArrowRightLeft className="w-3 h-3" />
              <span>{t.dashboard.transferBtn}</span>
            </button>
          )}

          <Link
            href="/accounts"
            className="text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
          >
            <span>{t.dashboard.allAccounts}</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Horizontal Scrollable Carousel */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-2.5 overflow-x-auto pb-1.5 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar scroll-smooth"
      >
        {accounts.map((acc) => (
          <Link
            key={acc.id}
            href={`/accounts/${acc.id}`}
            className="flex flex-col justify-between p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors shrink-0 w-44 sm:w-48 h-28 cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-md bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center">
                <DynamicIcon name={acc.icon || 'Wallet'} className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#64748B] dark:text-[#94A3B8]">
                {acc.currency}
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8] truncate">
                {acc.name}
              </span>
              <span className="text-sm sm:text-base font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight truncate mt-0.5 tnum">
                {formatCurrency(acc.current_balance, acc.currency)}
              </span>
            </div>
          </Link>
        ))}

        {/* Add Account Trigger Card */}
        <Link
          href="/accounts"
          className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-dashed border-[#CBD5E1] dark:border-[#334155] hover:border-[#0F172A] dark:hover:border-[#FAFAFA] text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] shrink-0 w-28 h-28 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 mb-1" />
          <span className="text-xs font-bold whitespace-nowrap">{t.dashboard.addAccount}</span>
        </Link>
      </div>

      {accounts.length >= 2 && (
        <TransferModal
          isOpen={isTransferOpen}
          onClose={() => setIsTransferOpen(false)}
          accounts={accounts}
          defaultExchangeRate={exchangeRate || 16000}
        />
      )}
    </div>
  )
}
