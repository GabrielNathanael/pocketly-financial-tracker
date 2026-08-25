'use client'

import React from 'react'
import Link from 'next/link'
import { EnrichedTransaction } from '@/types/database'
import { TransactionCard } from '@/components/transactions/transaction-card'
import { EmptyState } from '@/components/ui/empty-state'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowRight } from 'lucide-react'

interface RecentTransactionsProps {
  transactions: EnrichedTransaction[]
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
          {t.dashboard.recentTransactionsTitle}
        </h2>
        <Link
          href="/transactions"
          className="text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] flex items-center gap-0.5"
        >
          <span>{t.dashboard.allTransactions}</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          icon="Receipt"
          title={t.dashboard.noTransactions}
          description={t.dashboard.noTransactionsDesc}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {transactions.map((tx) => (
            <TransactionCard key={tx.id} transaction={tx} />
          ))}
        </div>
      )}
    </div>
  )
}
