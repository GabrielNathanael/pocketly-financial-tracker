'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Account } from '@/types/database'
import { AccountCard } from '@/components/accounts/account-card'
import { AccountForm } from '@/components/accounts/account-form'
import { TransferModal } from '@/components/accounts/transfer-modal'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { formatCurrency, convertAmount } from '@/lib/utils/currency'
import { useLanguage } from '@/lib/i18n/language-context'
import { Plus, ArrowRightLeft } from 'lucide-react'

interface AccountsManagerProps {
  accounts: Account[]
  exchangeRate: number
}

export function AccountsManager({ accounts, exchangeRate }: AccountsManagerProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isTransferOpen, setIsTransferOpen] = useState(false)

  let totalIdr = 0
  for (const acc of accounts) {
    if (acc.is_active) {
      totalIdr += convertAmount(Number(acc.current_balance), acc.currency, 'IDR', exchangeRate)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Top Banner Card */}
      <div className="p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider block">
            {t.accounts.aggregateLiquidity}
          </span>
          <h2 className="text-2xl sm:text-3xl font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight mt-0.5 tnum">
            {formatCurrency(totalIdr, 'IDR')}
          </h2>
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 block">
            {t.accounts.acrossAccounts.replace('{n}', String(accounts.length))}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {accounts.length >= 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTransferOpen(true)}
              className="gap-1.5"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              {t.dashboard.transferBtn}
            </Button>
          )}
          <Button size="sm" onClick={() => setIsAddOpen(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            {t.accounts.newAccount}
          </Button>
        </div>
      </div>

      {/* Account List Grid */}
      {accounts.length === 0 ? (
        <EmptyState
          icon="Wallet"
          title={t.accounts.emptyTitle}
          description={t.accounts.emptyDesc}
          actionLabel={'+ ' + t.accounts.newAccount}
          onAction={() => setIsAddOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {accounts.map((acc) => (
            <AccountCard key={acc.id} account={acc} />
          ))}
        </div>
      )}

      {/* Create Account Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title={t.accounts.modalTitle}
        maxWidth="md"
      >
        <AccountForm
          onSuccess={() => {
            setIsAddOpen(false)
            router.refresh()
          }}
        />
      </Modal>

      {/* Transfer Modal */}
      {accounts.length >= 2 && (
        <TransferModal
          isOpen={isTransferOpen}
          onClose={() => setIsTransferOpen(false)}
          accounts={accounts}
          defaultExchangeRate={exchangeRate}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  )
}
