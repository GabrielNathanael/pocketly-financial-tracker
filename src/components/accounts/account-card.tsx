'use client'

import React from 'react'
import Link from 'next/link'
import { Account } from '@/types/database'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { formatCurrency } from '@/lib/utils/currency'
import { useDefaultAccountId } from '@/lib/storage/default-account'
import { usePrivacyMode, maskCurrency } from '@/lib/storage/privacy-mode'
import { useLanguage } from '@/lib/i18n/language-context'
import { ChevronRight, Star } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface AccountCardProps {
  account: Account
}

export function AccountCard({ account }: AccountCardProps) {
  const { t } = useLanguage()
  const isPrivate = usePrivacyMode()
  const defaultAccountId = useDefaultAccountId()
  const isDefault = defaultAccountId === account.id

  return (
    <Link
      href={`/accounts/${account.id}`}
      className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
          <DynamicIcon name={account.icon || 'Wallet'} className="w-4 h-4" />
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
              {account.name}
            </span>
            {isDefault && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FEF3C7] dark:bg-[#78350F]/30 text-[#D97706] dark:text-[#FBBF24] border border-[#FDE68A] dark:border-[#92400E]/40 shrink-0">
                <Star className="w-2.5 h-2.5 fill-current" />
                {t.common.defaultBadge}
              </span>
            )}
          </div>
          <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
            {t.accounts.types[account.type] || account.type} • {account.currency}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        <span
          className={cn(
            'text-xs sm:text-sm font-mono font-bold tracking-tight tnum',
            Number(account.current_balance) < 0
              ? 'text-[#E11D48]'
              : 'text-[#0F172A] dark:text-[#F8FAFC]'
          )}
        >
          {maskCurrency(formatCurrency(account.current_balance, account.currency), isPrivate)}
        </span>
        <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#0F172A] dark:group-hover:text-[#FAFAFA] transition-colors" />
      </div>
    </Link>
  )
}
