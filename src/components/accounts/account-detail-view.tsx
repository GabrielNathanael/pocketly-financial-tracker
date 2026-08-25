'use client'

import React from 'react'
import Link from 'next/link'
import { Account } from '@/types/database'
import { AccountMutation } from '@/actions/accounts'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowLeft, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { AccountEditTrigger } from '@/components/accounts/account-edit-trigger'

interface AccountDetailViewProps {
  account: Account
  mutations: AccountMutation[]
}

export function AccountDetailView({ account, mutations }: AccountDetailViewProps) {
  const { t, language } = useLanguage()

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto">
      {/* Top Back Nav */}
      <div className="flex items-center justify-between">
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.accounts.backToAccounts}</span>
        </Link>
      </div>

      {/* Account Balance Card */}
      <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center">
              <DynamicIcon name={account.icon || 'Wallet'} className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {account.name}
              </h1>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                {t.accounts.types[account.type] || account.type} • {account.currency}
              </span>
            </div>
          </div>

          <AccountEditTrigger account={account} />
        </div>

        <div className="pt-3 border-t border-[#E5E7EB] dark:border-[#27272A]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
            {t.accounts.settledBalance}
          </span>
          <span className="text-2xl sm:text-3xl font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight tnum">
            {formatCurrency(account.current_balance, account.currency)}
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
            {mutations.map((m) => {
              const isPlus = m.type === 'income' || m.type === 'transfer_in'
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
                      {m.type === 'transfer_out' ? (
                        <ArrowDownRight className="w-4 h-4 text-[#E11D48]" />
                      ) : m.type === 'transfer_in' ? (
                        <ArrowUpRight className="w-4 h-4 text-[#0D9488]" />
                      ) : (
                        <DynamicIcon name={m.icon || 'Tag'} className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                        {m.title}
                      </span>
                      <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                        {m.description || m.counterpartyOrCategory}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 ml-3">
                    <span
                      className={`text-xs sm:text-sm font-mono font-bold tnum ${
                        isPlus ? 'text-[#0D9488]' : 'text-[#0F172A] dark:text-[#F8FAFC]'
                      }`}
                    >
                      {isPlus ? '+' : '-'}
                      {formatCurrency(m.amount, m.currency)}
                    </span>
                    <span className="text-[10px] font-mono text-[#94A3B8]">
                      {formatDate(m.date, 'd MMM yyyy', language)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
