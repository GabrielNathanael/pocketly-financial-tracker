'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EnrichedRecurringTransaction, EnrichedSavingsGoal, Account } from '@/types/database'
import { EnrichedDebtWithPayments } from '@/actions/debts'
import { processRecurringPayment } from '@/actions/recurring'
import { useLanguage } from '@/lib/i18n/language-context'
import { formatCurrency, convertAmount } from '@/lib/utils/currency'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CalendarClock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Repeat,
  Scale,
  Target,
  Search,
  Filter,
  Check,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { differenceInCalendarDays, parseISO, format } from 'date-fns'
import { toast } from 'sonner'

interface DueCenterViewProps {
  recurringTransactions: EnrichedRecurringTransaction[]
  debts: EnrichedDebtWithPayments[]
  goals: EnrichedSavingsGoal[]
  accounts: Account[]
  exchangeRate?: number
}

interface DueItem {
  id: string
  source: 'recurring' | 'debt' | 'goal'
  rawId: string
  title: string
  subtitle: string
  amount: number
  currency: string
  dueDate: string
  daysDiff: number
  icon: string
  color?: string
  link: string
  ctaText: string
  accountName?: string
  categoryName?: string
}

export function DueCenterView({
  recurringTransactions,
  debts,
  goals,
  accounts,
  exchangeRate = 15800,
}: DueCenterViewProps) {
  const { t, language } = useLanguage()
  const router = useRouter()
  const [filterSource, setFilterSource] = useState<'all' | 'recurring' | 'debt' | 'goal'>('all')
  const [filterUrgency, setFilterUrgency] = useState<'all' | 'overdue' | 'today' | 'soon' | 'later'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  const today = new Date()
  const items: DueItem[] = []

  // 1. Process Recurring Transactions
  recurringTransactions.forEach((rec) => {
    if (!rec.is_active) return
    const dueDate = parseISO(rec.next_due_date)
    const daysDiff = differenceInCalendarDays(dueDate, today)

    items.push({
      id: `rec-${rec.id}`,
      rawId: rec.id,
      source: 'recurring',
      title: rec.name,
      subtitle: rec.category?.name || t.dueCenter.recurringBill,
      amount: Number(rec.amount),
      currency: rec.currency,
      dueDate: rec.next_due_date,
      daysDiff,
      icon: rec.category?.icon || 'Repeat',
      color: rec.category?.color || '#6366F1',
      link: '/recurring',
      ctaText: t.dueCenter.payBill,
      accountName: rec.account?.name,
      categoryName: rec.category?.name,
    })
  })

  // 2. Process Debts
  debts.forEach((debt) => {
    if (debt.status !== 'active' || !debt.due_date) return
    const dueDate = parseISO(debt.due_date)
    const daysDiff = differenceInCalendarDays(dueDate, today)
    const remainingAmount = Number(debt.remaining_amount)

    items.push({
      id: `debt-${debt.id}`,
      rawId: debt.id,
      source: 'debt',
      title: `${debt.type === 'debt' ? (language === 'en' ? 'Pay Debt' : 'Bayar Utang') : (language === 'en' ? 'Collect Loan' : 'Tagih Piutang')}: ${debt.counterparty_name}`,
      subtitle: debt.notes || t.dueCenter.debtDue,
      amount: remainingAmount,
      currency: debt.currency,
      dueDate: debt.due_date,
      daysDiff,
      icon: 'Scale',
      color: debt.type === 'debt' ? '#E11D48' : '#10B981',
      link: `/debts/${debt.id}`,
      ctaText: t.dueCenter.payInstallment,
    })
  })

  // 3. Process Goals
  goals.forEach((goal) => {
    if (goal.status !== 'in_progress' || !goal.target_date) return
    const dueDate = parseISO(goal.target_date)
    const daysDiff = differenceInCalendarDays(dueDate, today)
    const remainingAmount = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount))

    items.push({
      id: `goal-${goal.id}`,
      rawId: goal.id,
      source: 'goal',
      title: goal.name,
      subtitle: t.dueCenter.goalDue,
      amount: remainingAmount,
      currency: goal.currency,
      dueDate: goal.target_date,
      daysDiff,
      icon: goal.icon || 'Target',
      color: goal.color || '#0D9488',
      link: '/goals',
      ctaText: t.dueCenter.depositGoal,
      categoryName: goal.category?.name,
    })
  })

  // Sort by urgency: most overdue first, then closest due date
  items.sort((a, b) => a.daysDiff - b.daysDiff)

  // Compute urgency counts
  const overdueCount = items.filter((i) => i.daysDiff < 0).length
  const todayCount = items.filter((i) => i.daysDiff === 0).length
  const soonCount = items.filter((i) => i.daysDiff > 0 && i.daysDiff <= 7).length
  const laterCount = items.filter((i) => i.daysDiff > 7).length

  // Filter by source, urgency, and search query
  const filteredItems = items.filter((item) => {
    if (filterSource !== 'all' && item.source !== filterSource) return false
    
    if (filterUrgency === 'overdue' && item.daysDiff >= 0) return false
    if (filterUrgency === 'today' && item.daysDiff !== 0) return false
    if (filterUrgency === 'soon' && (item.daysDiff <= 0 || item.daysDiff > 7)) return false
    if (filterUrgency === 'later' && item.daysDiff <= 7) return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        (item.accountName && item.accountName.toLowerCase().includes(q))
      )
    }
    return true
  })

  // Direct Pay Recurring handler
  const handleQuickPayRecurring = async (recurringId: string) => {
    setProcessingId(recurringId)
    try {
      const res = await processRecurringPayment(recurringId)
      if (res.error) {
        toast.error('Gagal Memproses Tagihan', { description: res.error })
      } else {
        toast.success(language === 'en' ? 'Bill payment recorded successfully!' : 'Pembayaran tagihan berhasil dicatat!')
        router.refresh()
      }
    } catch (err: any) {
      toast.error('Terjadi Kesalahan', { description: err.message })
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
          <span>{language === 'en' ? 'Due Dates & Financial Center' : 'Pusat Tagihan & Jatuh Tempo'}</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">
          {t.dueCenter.subtitle}
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-xs">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'en' ? 'Search by bill name, counterparty, account...' : 'Cari nama tagihan, akun, catatan...'}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#FAFAFA] transition-colors"
          />
        </div>

        {/* Dropdown Filters Container */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Source Select */}
          <div className="flex-1 sm:flex-none min-w-[160px]">
            <Select value={filterSource} onValueChange={(val: any) => setFilterSource(val)}>
              <SelectTrigger className="px-3 py-2 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] text-xs font-semibold">
                <SelectValue placeholder={language === 'en' ? 'All Sources' : 'Semua Sumber'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === 'en' ? `All Sources (${items.length})` : `Semua Sumber (${items.length})`}
                </SelectItem>
                <SelectItem value="recurring">
                  {language === 'en' ? `Recurring Bills (${items.filter((i) => i.source === 'recurring').length})` : `Tagihan Rutin (${items.filter((i) => i.source === 'recurring').length})`}
                </SelectItem>
                <SelectItem value="debt">
                  {language === 'en' ? `Debts & Loans (${items.filter((i) => i.source === 'debt').length})` : `${t.debts.title} (${items.filter((i) => i.source === 'debt').length})`}
                </SelectItem>
                <SelectItem value="goal">
                  {language === 'en' ? `Savings Goals (${items.filter((i) => i.source === 'goal').length})` : `Target Goals (${items.filter((i) => i.source === 'goal').length})`}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Urgency Select */}
          <div className="flex-1 sm:flex-none min-w-[160px]">
            <Select value={filterUrgency} onValueChange={(val: any) => setFilterUrgency(val)}>
              <SelectTrigger className="px-3 py-2 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] text-xs font-semibold">
                <SelectValue placeholder={language === 'en' ? 'All Urgencies' : 'Semua Urgensi'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === 'en' ? 'All Urgencies' : 'Semua Urgensi'}
                </SelectItem>
                <SelectItem value="overdue">
                  {language === 'en' ? `Overdue (${overdueCount})` : `Terlewat (${overdueCount})`}
                </SelectItem>
                <SelectItem value="today">
                  {language === 'en' ? `Due Today (${todayCount})` : `Jatuh Tempo Hari Ini (${todayCount})`}
                </SelectItem>
                <SelectItem value="soon">
                  {language === 'en' ? `Due in 7 Days (${soonCount})` : `7 Hari Ke Depan (${soonCount})`}
                </SelectItem>
                <SelectItem value="later">
                  {language === 'en' ? `Later > 7 Days (${laterCount})` : `Mendatang > 7 Hari (${laterCount})`}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Schedule List */}
      {filteredItems.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              {t.dueCenter.allClear}
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 max-w-md">
              {language === 'en'
                ? 'No upcoming financial dues or obligations match your filter.'
                : 'Tidak ada tagihan atau komitmen keuangan yang perlu dibayar pada filter ini.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          {filteredItems.map((item) => {
            const isOverdue = item.daysDiff < 0
            const isToday = item.daysDiff === 0
            const isUrgent = item.daysDiff <= 7

            return (
              <div
                key={item.id}
                className={cn(
                  'p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 shadow-2xs hover:shadow-sm',
                  isOverdue
                    ? 'bg-rose-50/40 dark:bg-rose-950/15 border-rose-200 dark:border-rose-900/40'
                    : isToday
                    ? 'bg-amber-50/40 dark:bg-amber-950/15 border-amber-200 dark:border-amber-900/40'
                    : 'bg-white dark:bg-[#121215] border-[#E5E7EB] dark:border-[#27272A]'
                )}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                      style={{ backgroundColor: item.color || '#6366F1' }}
                    >
                      <DynamicIcon name={item.icon} className="w-5 h-5" />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate mt-0.5">
                        {item.subtitle}
                        {item.accountName && ` • ${item.accountName}`}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 flex items-center gap-1',
                      isOverdue
                        ? 'bg-rose-500 text-white'
                        : isToday
                        ? 'bg-amber-500 text-white'
                        : isUrgent
                        ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                        : 'bg-gray-100 dark:bg-[#27272A] text-[#64748B] dark:text-[#94A3B8]'
                    )}
                  >
                    {isOverdue && <AlertTriangle className="w-3 h-3" />}
                    {isToday && <Clock className="w-3 h-3" />}
                    <span>
                      {isOverdue
                        ? t.dueCenter.overdueAlert.replace('{days}', String(Math.abs(item.daysDiff)))
                        : isToday
                        ? t.dueCenter.todayAlert
                        : t.dueCenter.daysLeft.replace('{days}', String(item.daysDiff))}
                    </span>
                  </span>
                </div>

                {/* Amount & Action Row */}
                <div className="pt-3 border-t border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-[#94A3B8] block leading-none">
                      {language === 'en' ? 'Amount Due' : 'Nominal Tagihan'}
                    </span>
                    <span className="font-mono font-black text-sm sm:text-base text-[#0F172A] dark:text-[#F8FAFC] mt-0.5 block">
                      {formatCurrency(item.amount, item.currency)}
                    </span>
                  </div>

                  {item.source === 'recurring' ? (
                    <button
                      type="button"
                      disabled={processingId === item.rawId}
                      onClick={() => handleQuickPayRecurring(item.rawId)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] text-xs font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      {processingId === item.rawId ? (
                        <span>{language === 'en' ? 'Processing...' : 'Memproses...'}</span>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{t.dueCenter.payBill}</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <Link
                      href={item.link}
                      className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] text-xs font-bold hover:bg-[#F1F3F5] dark:hover:bg-[#26262E] active:scale-95 transition-all cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs"
                    >
                      <span>{item.ctaText}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
