'use client'

import React from 'react'
import { useLanguage } from '@/lib/i18n/language-context'

interface TransactionsHeaderProps {
  count: number
}

export function TransactionsHeader({ count }: TransactionsHeaderProps) {
  const { language, t } = useLanguage()

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
          {t.transactions.title}
        </h1>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
          {language === 'en'
            ? `${count} ledger entries matching current filters`
            : `${count} catatan transaksi sesuai filter`}
        </p>
      </div>
    </div>
  )
}
