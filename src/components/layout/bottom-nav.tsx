'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Receipt,
  Plus,
  PieChart,
  Menu,
  Wallet,
  Scale,
  Tags,
  Coins,
  Settings,
  X,
  LogOut,
  Search,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { QuickAddSheet } from '@/components/layout/quick-add-sheet'
import { GlobalSearch } from '@/components/layout/global-search'
import { Account, Category, EnrichedTransaction, Debt } from '@/types/database'
import { logout } from '@/actions/auth'
import { useLanguage } from '@/lib/i18n/language-context'

interface BottomNavProps {
  accounts?: Account[]
  categories?: Category[]
  transactions?: EnrichedTransaction[]
  debts?: Debt[]
}

export function BottomNav({
  accounts = [],
  categories = [],
  transactions = [],
  debts = [],
}: BottomNavProps) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Global keyboard shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const navItems = [
    { label: t.nav.home, href: '/dashboard', icon: LayoutDashboard, isActive: pathname === '/dashboard' },
    {
      label: t.nav.transactions,
      href: '/transactions',
      icon: Receipt,
      isActive: pathname.startsWith('/transactions'),
    },
    {
      label: t.nav.quickLog,
      isAction: true,
      onClick: () => setIsQuickAddOpen(true),
      icon: Plus,
    },
    {
      label: t.nav.budget,
      href: '/budget',
      icon: PieChart,
      isActive: pathname.startsWith('/budget'),
    },
    {
      label: t.nav.more,
      isMore: true,
      onClick: () => setIsMoreMenuOpen(true),
      icon: Menu,
      isActive:
        pathname.startsWith('/accounts') ||
        pathname.startsWith('/debts') ||
        pathname.startsWith('/categories') ||
        pathname.startsWith('/net-worth') ||
        pathname.startsWith('/guide') ||
        pathname.startsWith('/settings'),
    },
  ]

  const moreLinks = [
    { label: t.nav.accounts, href: '/accounts', icon: Wallet, desc: t.nav.accountsDesc },
    { label: t.nav.debts, href: '/debts', icon: Scale, desc: t.nav.debtsDesc },
    { label: t.nav.categories, href: '/categories', icon: Tags, desc: t.nav.categoriesDesc },
    { label: t.nav.netWorth, href: '/net-worth', icon: Coins, desc: t.nav.netWorthDesc },
    { label: t.nav.guide, href: '/guide', icon: BookOpen, desc: t.nav.guideDesc },
    { label: t.nav.settings, href: '/settings', icon: Settings, desc: t.nav.settingsDesc },
  ]

  return (
    <>
      {/* Mobile Bottom Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#121215] border-t border-[#E5E7EB] dark:border-[#27272A] pb-safe md:hidden">
        <div className="flex items-center justify-around h-14 px-1">
          {navItems.map((item, idx) => {
            if (item.isAction) {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={item.onClick}
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white dark:bg-[#FAFAFA] dark:hover:bg-[#E2E8F0] dark:text-[#0F172A] active:scale-95 transition-all cursor-pointer"
                  aria-label={t.nav.quickLog}
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </button>
              )
            }

            if (item.isMore) {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={item.onClick}
                  className={cn(
                    'flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-semibold transition-colors cursor-pointer',
                    item.isActive
                      ? 'text-[#0F172A] dark:text-[#FAFAFA]'
                      : 'text-[#94A3B8] dark:text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                  )}
                >
                  <item.icon className="w-4 h-4 mb-0.5" />
                  <span>{item.label}</span>
                </button>
              )
            }

            return (
              <Link
                key={idx}
                href={item.href!}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-semibold transition-colors cursor-pointer',
                  item.isActive
                    ? 'text-[#0F172A] dark:text-[#FAFAFA]'
                    : 'text-[#94A3B8] dark:text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                )}
              >
                <item.icon className="w-4 h-4 mb-0.5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Desktop Header */}
      <header className="hidden md:flex items-center justify-between fixed top-0 left-0 right-0 z-40 h-14 bg-white dark:bg-[#121215] border-b border-[#E5E7EB] dark:border-[#27272A] px-6 lg:px-8">
        {/* Brand with logo.png */}
        <div className="flex items-center shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
            <Image
              src="/logo.png"
              alt="Pocketly"
              width={28}
              height={28}
              className="w-7 h-7 object-contain group-hover:scale-105 transition-transform"
              priority
            />
            <span className="font-extrabold text-base tracking-tight text-[#0F172A] dark:text-[#FAFAFA]">
              Pocketly
            </span>
          </Link>
        </div>

        {/* Centered Navigation Menu */}
        <nav className="flex items-center justify-center gap-1 text-xs mx-auto overflow-x-auto no-scrollbar">
          <Link
            href="/dashboard"
            className={cn(
              'px-2.5 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap',
              pathname === '/dashboard'
                ? 'bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#0F172A] dark:text-[#FAFAFA]'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            {t.nav.overview}
          </Link>
          <Link
            href="/transactions"
            className={cn(
              'px-2.5 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap',
              pathname.startsWith('/transactions')
                ? 'bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#0F172A] dark:text-[#FAFAFA]'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            {t.nav.transactions}
          </Link>
          <Link
            href="/budget"
            className={cn(
              'px-2.5 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap',
              pathname.startsWith('/budget')
                ? 'bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#0F172A] dark:text-[#FAFAFA]'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            {t.nav.budget}
          </Link>
          <Link
            href="/accounts"
            className={cn(
              'px-2.5 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap',
              pathname.startsWith('/accounts')
                ? 'bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#0F172A] dark:text-[#FAFAFA]'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            {t.accounts.title}
          </Link>
          <Link
            href="/debts"
            className={cn(
              'px-2.5 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap',
              pathname.startsWith('/debts')
                ? 'bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#0F172A] dark:text-[#FAFAFA]'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            {t.debts.title}
          </Link>
          <Link
            href="/categories"
            className={cn(
              'px-2.5 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap',
              pathname.startsWith('/categories')
                ? 'bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#0F172A] dark:text-[#FAFAFA]'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            {t.categories.title}
          </Link>
          <Link
            href="/net-worth"
            className={cn(
              'px-2.5 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap',
              pathname.startsWith('/net-worth')
                ? 'bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#0F172A] dark:text-[#FAFAFA]'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            {t.netWorth.title.split(' ')[0]}
          </Link>
          <Link
            href="/guide"
            className={cn(
              'px-2.5 py-1.5 rounded-md font-semibold transition-colors whitespace-nowrap flex items-center gap-1',
              pathname.startsWith('/guide')
                ? 'bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#0F172A] dark:text-[#FAFAFA]'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t.nav.guide.split(' ')[0]}</span>
          </Link>
        </nav>

        {/* Right-hand side action cluster with aligned heights */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Global Search Button */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="h-8.5 px-3 rounded-lg inline-flex items-center gap-2 text-xs text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA] bg-[#F8F9FA] dark:bg-[#1A1A20] hover:bg-[#F1F3F5] dark:hover:bg-[#26262E] border border-[#E5E7EB] dark:border-[#27272A] transition-colors cursor-pointer"
            title="Cari (Ctrl + K)"
          >
            <Search className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span className="font-medium">{t.common.search}</span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-[#121215] text-[#64748B] dark:text-[#94A3B8] border border-[#E5E7EB] dark:border-[#27272A]">
              ⌘K
            </kbd>
          </button>

          {/* Quick Add Button */}
          <button
            onClick={() => setIsQuickAddOpen(true)}
            className="h-8.5 px-3.5 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] dark:bg-[#FAFAFA] dark:hover:bg-[#E2E8F0] text-white dark:text-[#0F172A] text-xs font-bold transition-all active:scale-95 inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{t.nav.quickLog}</span>
          </button>

          {/* Settings Shortcut */}
          <Link
            href="/settings"
            className="h-8.5 w-8.5 rounded-lg inline-flex items-center justify-center text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA] bg-[#F8F9FA] dark:bg-[#1A1A20] hover:bg-[#F1F3F5] dark:hover:bg-[#26262E] border border-[#E5E7EB] dark:border-[#27272A] transition-colors cursor-pointer"
            title={t.nav.settings}
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* More Slide-over Sheet (Mobile) */}
      {isMoreMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden">
          <div
            className="fixed inset-0 bg-[#0F172A]/70 dark:bg-black/80"
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <div className="relative w-full bg-white dark:bg-[#121215] rounded-t-xl border-t border-[#E5E7EB] dark:border-[#27272A] p-5 z-10 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm uppercase tracking-wider text-[#0F172A] dark:text-[#FAFAFA]">
                {t.nav.more}
              </h3>
              <button
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-1 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Search button */}
            <button
              onClick={() => {
                setIsMoreMenuOpen(false)
                setIsSearchOpen(true)
              }}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] hover:bg-[#F1F3F5] dark:hover:bg-[#26262E] transition-colors border border-[#E5E7EB] dark:border-[#27272A] mb-3 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Search className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8]" />
                <span className="text-xs font-bold text-[#0F172A] dark:text-[#FAFAFA]">
                  {t.nav.globalSearch}
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#94A3B8]">Ctrl+K</span>
            </button>

            <div className="grid grid-cols-1 gap-2 mb-5">
              {moreLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] hover:bg-[#F1F3F5] dark:hover:bg-[#26262E] transition-colors border border-[#E5E7EB] dark:border-[#27272A]"
                >
                  <div className="w-8 h-8 rounded-md bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#FAFAFA] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center shrink-0">
                    <link.icon className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="text-xs font-bold text-[#0F172A] dark:text-[#FAFAFA] truncate">{link.label}</div>
                    <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">{link.desc}</div>
                  </div>
                </Link>
              ))}
            </div>

            <form action={logout}>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#FFF1F2] dark:bg-[#881337]/20 text-[#BE123C] dark:text-[#FB7185] font-bold text-xs hover:bg-[#FFE4E6] dark:hover:bg-[#881337]/30 transition-colors border border-[#FECDD3] dark:border-[#9F1239]/40 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t.nav.signOut}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Global Search Modal */}
      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        accounts={accounts}
        categories={categories}
        transactions={transactions}
        debts={debts}
      />

      {/* Quick Add Bottom Sheet */}
      <QuickAddSheet
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        accounts={accounts}
        categories={categories}
      />
    </>
  )
}
