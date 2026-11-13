'use client'

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import { Account } from '@/types/database'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { formatCurrency } from '@/lib/utils/currency'
import { usePrivacyMode, maskCurrency } from '@/lib/storage/privacy-mode'
import { TransferModal } from '@/components/accounts/transfer-modal'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowRightLeft, Plus, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'

interface AccountsWidgetProps {
  accounts: Account[]
  exchangeRate?: number
}

export function AccountsWidget({ accounts, exchangeRate }: AccountsWidgetProps) {
  const { t } = useLanguage()
  const isPrivate = usePrivacyMode()
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
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
            {t.dashboard.accountsTitle} ({accounts.length})
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Scroll Navigation Arrows: Hidden on mobile (touch swipe), visible on desktop */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={scrollLeft}
              className="p-1 rounded-md bg-surface-muted hover:bg-secondary-hover text-foreground-secondary hover:text-foreground border border-border transition-colors cursor-pointer"
              title={t.dashboard.scrollLeft || 'Scroll Left'}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={scrollRight}
              className="p-1 rounded-md bg-surface-muted hover:bg-secondary-hover text-foreground-secondary hover:text-foreground border border-border transition-colors cursor-pointer"
              title={t.dashboard.scrollRight || 'Scroll Right'}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {accounts.length >= 2 && (
            <button
              onClick={() => setIsTransferOpen(true)}
              className="text-xs font-semibold text-foreground hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <ArrowRightLeft className="w-3 h-3" />
              <span>{t.dashboard.transferBtn}</span>
            </button>
          )}

          <Link
            href="/accounts"
            className="text-xs font-semibold text-foreground-secondary hover:text-foreground flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
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
            className="flex flex-col justify-between p-3.5 rounded-xl bg-surface border border-border hover:border-foreground transition-colors shrink-0 w-44 sm:w-48 h-28 cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-md bg-surface-muted border border-border text-foreground flex items-center justify-center">
                <DynamicIcon name={acc.icon || 'Wallet'} className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface-muted text-foreground-secondary">
                {acc.currency}
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-foreground-secondary truncate">
                {acc.name}
              </span>
              <span className="text-sm sm:text-base font-mono font-bold text-foreground tracking-tight truncate mt-0.5 tnum">
                {maskCurrency(formatCurrency(acc.current_balance, acc.currency), isPrivate)}
              </span>
            </div>
          </Link>
        ))}

        {/* Add Account Trigger Card */}
        <Link
          href="/accounts"
          className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-dashed border-border-strong hover:border-foreground text-foreground-secondary hover:text-foreground shrink-0 w-28 h-28 transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-surface-muted flex items-center justify-center mb-1">
            <Plus className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold">{t.dashboard.addAccount}</span>
        </Link>
      </div>

      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        accounts={accounts}
        defaultExchangeRate={exchangeRate}
      />
    </div>
  )
}
