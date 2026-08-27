'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Account } from '@/types/database'
import { AccountMutation } from '@/actions/accounts'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatNaturalForexRate } from '@/lib/utils/currency'
import { formatCategoryName } from '@/lib/utils/category-i18n'
import { usePrivacyMode, maskCurrency } from '@/lib/storage/privacy-mode'
import { formatDate } from '@/lib/utils/date'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowLeft, ArrowDownRight, ArrowUpRight, ArrowRightLeft, Scale } from 'lucide-react'
import { AccountEditTrigger } from '@/components/accounts/account-edit-trigger'
import { AdjustBalanceModal } from '@/components/accounts/adjust-balance-modal'
import { TransferModal } from '@/components/accounts/transfer-modal'
import { TransferDetailModal } from '@/components/accounts/transfer-detail-modal'
import { cn } from '@/lib/utils/cn'

interface AccountDetailViewProps {
  account: Account
  mutations: AccountMutation[]
  accounts?: Account[]
}

const BATCH_SIZE = 50

export function AccountDetailView({ account, mutations, accounts = [] }: AccountDetailViewProps) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const isPrivate = usePrivacyMode()
  const [displayLimit, setDisplayLimit] = useState(BATCH_SIZE)
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState<AccountMutation | null>(null)

  const getMutationTitle = (m: AccountMutation) => {
    if (m.type === 'transfer_out') {
      const targetName = m.counterpartyOrCategory || (language === 'en' ? 'Account' : 'Akun')
      if (m.isCross) {
        return (t.transfer.exchangeTo || 'Exchange to {name}').replace('{name}', targetName)
      }
      return (t.transfer.transferTo || 'Transfer to {name}').replace('{name}', targetName)
    }
    if (m.type === 'transfer_in') {
      const sourceName = m.counterpartyOrCategory || (language === 'en' ? 'Account' : 'Akun')
      if (m.isCross) {
        return (t.transfer.exchangeFrom || 'Exchange from {name}').replace('{name}', sourceName)
      }
      return (t.transfer.transferFrom || 'Transfer from {name}').replace('{name}', sourceName)
    }
    return formatCategoryName(m.title, language)
  }

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto">
      {/* Back button */}
      <Link
        href="/accounts"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors self-start"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{t.accounts.backToAccounts}</span>
      </Link>

      {/* Account Info Card */}
      <div className="p-4 sm:p-6 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
              <DynamicIcon name={account.icon || 'Wallet'} className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                {account.name}
              </h1>
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">
                {t.accounts.types[account.type] || account.type} • {account.currency}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap pt-1 sm:pt-0">
            {accounts.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTransferModalOpen(true)}
                className="flex-1 sm:flex-initial gap-1.5 text-xs font-bold cursor-pointer h-8 sm:h-9 px-2.5 sm:px-3 border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20]"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>Transfer</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdjustModalOpen(true)}
              className="flex-1 sm:flex-initial gap-1.5 text-xs font-bold cursor-pointer h-8 sm:h-9 px-2.5 sm:px-3 border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20]"
            >
              <Scale className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.accounts.adjustBalanceBtn}</span>
            </Button>
            <AccountEditTrigger account={account} />
          </div>
        </div>

        <div className="pt-3 border-t border-[#E5E7EB] dark:border-[#27272A]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
            {t.accounts.settledBalance}
          </span>
          <span className="text-2xl sm:text-3xl font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight tnum">
            {maskCurrency(formatCurrency(account.current_balance, account.currency), isPrivate)}
          </span>
        </div>
      </div>

      {/* Mutation History */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
            {t.accounts.historyTitle} ({mutations.length})
          </h2>
        </div>

        {mutations.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] rounded-xl text-[#94A3B8] text-xs">
            {t.accounts.historyEmpty}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {mutations.slice(0, displayLimit).map((m) => {
              const isPlus = m.type === 'income' || m.type === 'transfer_in'
              const isRegularTx = m.type === 'income' || m.type === 'expense'
              const formattedMutation = `${isPlus ? '+' : '-'}${formatCurrency(m.amount, m.currency)}`
              const displayTitle = getMutationTitle(m)
              
              const content = (
                <div
                  className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-all shadow-2xs group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      {m.type === 'transfer_out' ? (
                        <ArrowDownRight className="w-4 h-4 text-[#E11D48]" />
                      ) : m.type === 'transfer_in' ? (
                        <ArrowUpRight className="w-4 h-4 text-[#0D9488]" />
                      ) : (
                        <DynamicIcon name={m.icon || 'Tag'} className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate group-hover:text-[#0D9488] transition-colors">
                        {displayTitle}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                        {m.isCross && m.exchangeRateUsed && m.counterpartyCurrency ? (
                          <>
                            <span className="font-mono text-[#475569] dark:text-[#CBD5E1]">
                              {formatNaturalForexRate(
                                m.type === 'transfer_out' ? m.currency : m.counterpartyCurrency,
                                m.type === 'transfer_out' ? m.counterpartyCurrency : m.currency,
                                m.exchangeRateUsed
                              ).formattedText}
                            </span>
                            <span>•</span>
                          </>
                        ) : m.description ? (
                          <>
                            <span className="truncate max-w-40 sm:max-w-60 text-[#475569] dark:text-[#CBD5E1]">
                              {m.description}
                            </span>
                            <span>•</span>
                          </>
                        ) : null}
                        <span>{formatDate(m.date, 'dd MMM yyyy, HH:mm')}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={cn(
                      'text-xs sm:text-sm font-mono font-bold tracking-tight shrink-0 ml-3 tnum',
                      isPlus ? 'text-[#0D9488]' : 'text-[#0F172A] dark:text-[#F8FAFC]'
                    )}
                  >
                    {maskCurrency(formattedMutation, isPrivate)}
                  </span>
                </div>
              )

              if (isRegularTx) {
                return (
                  <Link key={m.id} href={`/transactions/${m.id}`} className="block">
                    {content}
                  </Link>
                )
              }

              return (
                <div key={m.id} onClick={() => setSelectedTransfer(m)} className="block">
                  {content}
                </div>
              )
            })}

            {/* Pagination Load More Controls */}
            {displayLimit < mutations.length && (
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs">
                <span className="text-[#64748B] dark:text-[#94A3B8] font-medium text-center sm:text-left">
                  {t.common.showing} <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA]">{Math.min(displayLimit, mutations.length)}</span> / {mutations.length}
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDisplayLimit((prev) => prev + BATCH_SIZE)}
                    className="flex-1 sm:flex-initial text-xs font-bold cursor-pointer"
                  >
                    {t.common.loadMore} (+{Math.min(BATCH_SIZE, mutations.length - displayLimit)})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDisplayLimit(mutations.length)}
                    className="flex-1 sm:flex-initial text-xs text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] cursor-pointer"
                  >
                    {t.common.showAll}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <AdjustBalanceModal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        account={account}
        onSuccess={() => {
          router.refresh()
        }}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        accounts={accounts}
        defaultFromAccountId={account.id}
        onSuccess={() => {
          router.refresh()
        }}
      />

      <TransferDetailModal
        isOpen={!!selectedTransfer}
        onClose={() => setSelectedTransfer(null)}
        mutation={selectedTransfer}
        currentAccountName={account.name}
      />
    </div>
  )
}
