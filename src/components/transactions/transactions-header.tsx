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
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {t.transactions.title}
        </h1>
        <p className="text-xs text-foreground-secondary font-mono">
          {language === 'en'
            ? `${count} ledger entries matching current filters`
            : `${count} catatan transaksi sesuai filter`}
        </p>
      </div>
    </div>
  )
}
