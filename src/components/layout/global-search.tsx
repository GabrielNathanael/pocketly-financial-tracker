'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { Account, Category, EnrichedTransaction, Debt } from '@/types/database'
import { formatCurrency } from '@/lib/utils/currency'
import { getCleanDescription } from '@/lib/utils/description'
import { useLanguage } from '@/lib/i18n/language-context'
import { Search, ArrowRight } from 'lucide-react'

interface GlobalSearchProps {
  isOpen: boolean
  onClose: () => void
  accounts: Account[]
  categories: Category[]
  transactions?: EnrichedTransaction[]
  debts?: Debt[]
}

export function GlobalSearch({
  isOpen,
  onClose,
  accounts = [],
  categories = [],
  transactions = [],
  debts = [],
}: GlobalSearchProps) {
  const { t } = useLanguage()

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.common.search}
      description={t.transactions.searchPlaceholder}
      maxWidth="lg"
    >
      <GlobalSearchContent
        accounts={accounts}
        categories={categories}
        transactions={transactions}
        debts={debts}
        onClose={onClose}
      />
    </Modal>
  )
}

interface GlobalSearchContentProps {
  accounts: Account[]
  categories: Category[]
  transactions: EnrichedTransaction[]
  debts: Debt[]
  onClose: () => void
}

function GlobalSearchContent({
  accounts,
  categories,
  transactions,
  debts,
  onClose,
}: GlobalSearchContentProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')

  const navRoutes = useMemo(
    () => [
      { name: t.nav.home, href: '/dashboard', icon: 'LayoutDashboard' },
      { name: t.nav.transactions, href: '/transactions', icon: 'Receipt' },
      { name: t.nav.budget, href: '/budget', icon: 'PieChart' },
      { name: t.nav.accounts, href: '/accounts', icon: 'Wallet' },
      { name: t.nav.debts, href: '/debts', icon: 'Scale' },
      { name: t.nav.categories, href: '/categories', icon: 'Tags' },
      { name: t.nav.netWorth, href: '/net-worth', icon: 'Coins' },
      { name: t.nav.guide, href: '/guide', icon: 'BookOpen' },
      { name: t.nav.settings, href: '/settings', icon: 'Settings' },
    ],
    [t]
  )

  const q = query.trim().toLowerCase()

  const filteredRoutes = useMemo(() => {
    if (!q) return navRoutes.slice(0, 4)
    return navRoutes.filter((r) => r.name.toLowerCase().includes(q))
  }, [navRoutes, q])

  const filteredAccounts = useMemo(() => {
    if (!q) return []
    return accounts.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 4)
  }, [accounts, q])

  const filteredCategories = useMemo(() => {
    if (!q) return []
    return categories.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 4)
  }, [categories, q])

  const filteredTransactions = useMemo(() => {
    if (!q) return []
    return transactions
      .filter(
        (tx) =>
          tx.category?.name.toLowerCase().includes(q) ||
          (tx.description && getCleanDescription(tx.description).toLowerCase().includes(q))
      )
      .slice(0, 6)
  }, [transactions, q])

  const filteredDebts = useMemo(() => {
    if (!q) return []
    return debts
      .filter((d) => d.counterparty_name.toLowerCase().includes(q))
      .slice(0, 4)
  }, [debts, q])

  const handleSelect = (href: string) => {
    onClose()
    router.push(href)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search Input Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.transactions.searchPlaceholder}
          autoFocus
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#FAFAFA] transition-colors"
        />
      </div>

      {/* Results List */}
      <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
        {/* Navigation Section */}
        {filteredRoutes.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] px-2">
              Menu
            </span>
            {filteredRoutes.map((r) => (
              <button
                key={r.href}
                onClick={() => handleSelect(r.href)}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-[#F1F3F5] dark:bg-[#1A1A20] flex items-center justify-center text-[#475569] dark:text-[#94A3B8]">
                    <DynamicIcon name={r.icon} className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {r.name}
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}

        {/* Accounts */}
        {filteredAccounts.length > 0 && (
          <div className="flex flex-col gap-1 pt-1 border-t border-[#E5E7EB] dark:border-[#27272A]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] px-2">
              {t.accounts.title}
            </span>
            {filteredAccounts.map((a) => (
              <button
                key={a.id}
                onClick={() => handleSelect(`/accounts/${a.id}`)}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-[#F1F3F5] dark:bg-[#1A1A20] flex items-center justify-center text-[#475569] dark:text-[#94A3B8]">
                    <DynamicIcon name={a.icon || 'Wallet'} className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {a.name}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] tnum">
                  {formatCurrency(a.current_balance, a.currency)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Categories */}
        {filteredCategories.length > 0 && (
          <div className="flex flex-col gap-1 pt-1 border-t border-[#E5E7EB] dark:border-[#27272A]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] px-2">
              {t.categories.title}
            </span>
            {filteredCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelect('/categories')}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-[#F1F3F5] dark:bg-[#1A1A20] flex items-center justify-center text-[#475569] dark:text-[#94A3B8]">
                    <DynamicIcon name={c.icon || 'Tag'} className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {c.name}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#94A3B8] uppercase">
                  {c.type}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Transactions */}
        {filteredTransactions.length > 0 && (
          <div className="flex flex-col gap-1 pt-1 border-t border-[#E5E7EB] dark:border-[#27272A]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] px-2">
              {t.transactions.title}
            </span>
            {filteredTransactions.map((tx) => (
              <button
                key={tx.id}
                onClick={() => handleSelect(`/transactions/${tx.id}`)}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded bg-[#F1F3F5] dark:bg-[#1A1A20] flex items-center justify-center text-[#475569] dark:text-[#94A3B8] shrink-0">
                    <DynamicIcon name={tx.category?.icon || 'Tag'} className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                      {tx.category?.name || 'Transaksi'}
                    </span>
                    {getCleanDescription(tx.description) && (
                      <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] truncate">
                        {getCleanDescription(tx.description)}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`text-xs font-mono font-bold tnum shrink-0 ${
                    tx.type === 'income' ? 'text-[#0D9488]' : 'text-[#E11D48]'
                  }`}
                >
                  {tx.type === 'income' ? '+' : '-'}
                  {formatCurrency(tx.amount, tx.currency)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Debts */}
        {filteredDebts.length > 0 && (
          <div className="flex flex-col gap-1 pt-1 border-t border-[#E5E7EB] dark:border-[#27272A]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] px-2">
              {t.debts.title}
            </span>
            {filteredDebts.map((d) => (
              <button
                key={d.id}
                onClick={() => handleSelect(`/debts/${d.id}`)}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-[#F1F3F5] dark:bg-[#1A1A20] flex items-center justify-center text-[#475569] dark:text-[#94A3B8]">
                    <DynamicIcon name="Scale" className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {d.counterparty_name}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] tnum">
                  {formatCurrency(d.remaining_amount, d.currency)}
                </span>
              </button>
            ))}
          </div>
        )}

        {q &&
          filteredRoutes.length === 0 &&
          filteredAccounts.length === 0 &&
          filteredCategories.length === 0 &&
          filteredTransactions.length === 0 &&
          filteredDebts.length === 0 && (
            <div className="py-8 text-center text-xs text-[#94A3B8]">
              Tidak ada hasil ditemukan untuk &ldquo;{query}&rdquo;
            </div>
          )}
      </div>
    </div>
  )
}
