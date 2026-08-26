'use client'

import React, { useState, useMemo } from 'react'
import { Account, Category, EnrichedRecurringTransaction } from '@/types/database'
import { formatCurrency, convertAmount, ForexRatesMap } from '@/lib/utils/currency'
import { usePreferredCurrency } from '@/lib/storage/preferred-currency'
import { usePrivacyMode, maskCurrency } from '@/lib/storage/privacy-mode'
import { useLanguage } from '@/lib/i18n/language-context'
import { processRecurringPayment, toggleRecurringActive, deleteRecurringTransaction } from '@/actions/recurring'
import { RecurringFormModal } from '@/components/recurring/recurring-form-modal'
import { RecurringDetailModal } from '@/components/recurring/recurring-detail-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils/cn'
import { parseISO, differenceInCalendarDays, format } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Edit2,
  Trash2,
  Flame,
  TrendingUp,
  TrendingDown,
  Scale,
  Sparkles,
  Loader2,
} from 'lucide-react'

interface RecurringManagerProps {
  recurringTransactions: EnrichedRecurringTransaction[]
  accounts: Account[]
  categories: Category[]
  rates?: ForexRatesMap
}

type TabType = 'all' | 'expense' | 'income' | 'paused'

export function RecurringManager({
  recurringTransactions,
  accounts,
  categories,
  rates,
}: RecurringManagerProps) {
  const { t, language } = useLanguage()
  const displayCurrency = usePreferredCurrency()
  const isPrivate = usePrivacyMode()
  const dateFnsLocale = language === 'id' ? idLocale : enUS

  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<EnrichedRecurringTransaction | null>(null)
  const [detailRecurring, setDetailRecurring] = useState<EnrichedRecurringTransaction | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const today = new Date()

  // Calculate Monthly Normalized Recurring Commitment
  const { monthlyOutflow, monthlyInflow, netMonthly, dueSoonCount } = useMemo(() => {
    let outSum = 0
    let inSum = 0
    let dueSoon = 0

    recurringTransactions.forEach((item) => {
      if (!item.is_active) return

      let monthlyMultiplier = 1
      if (item.frequency === 'daily') monthlyMultiplier = 30
      else if (item.frequency === 'weekly') monthlyMultiplier = 4.33
      else if (item.frequency === 'yearly') monthlyMultiplier = 1 / 12

      const converted = convertAmount(
        item.amount,
        item.currency || item.account?.currency || 'IDR',
        displayCurrency,
        rates
      )

      if (item.type === 'expense') {
        outSum += converted * monthlyMultiplier
      } else {
        inSum += converted * monthlyMultiplier
      }

      try {
        const dueDate = parseISO(item.next_due_date)
        const daysDiff = differenceInCalendarDays(dueDate, today)
        if (daysDiff <= 7) {
          dueSoon += 1
        }
      } catch {
        // ignore
      }
    })

    return {
      monthlyOutflow: outSum,
      monthlyInflow: inSum,
      netMonthly: inSum - outSum,
      dueSoonCount: dueSoon,
    }
  }, [recurringTransactions, displayCurrency, rates, today])

  // Filter items based on tab and search query
  const filteredItems = useMemo(() => {
    return recurringTransactions.filter((item) => {
      if (activeTab === 'paused') {
        if (item.is_active) return false
      } else if (activeTab === 'expense') {
        if (item.type !== 'expense' || !item.is_active) return false
      } else if (activeTab === 'income') {
        if (item.type !== 'income' || !item.is_active) return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = item.name.toLowerCase().includes(q)
        const matchesCat = item.category?.name.toLowerCase().includes(q) || false
        const matchesAcc = item.account?.name.toLowerCase().includes(q) || false
        if (!matchesName && !matchesCat && !matchesAcc) return false
      }

      return true
    })
  }, [recurringTransactions, activeTab, searchQuery])

  // Handle Process / Pay Now Action
  const handleProcess = async (item: EnrichedRecurringTransaction) => {
    setProcessingId(item.id)
    try {
      const res = await processRecurringPayment(item.id)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(t.recurring.processSuccess)
      }
    } catch {
      toast.error(language === 'en' ? 'Failed to process payment' : 'Gagal memproses transaksi')
    } finally {
      setProcessingId(null)
    }
  }

  // Handle Toggle Active/Pause
  const handleToggleActive = async (item: EnrichedRecurringTransaction) => {
    setTogglingId(item.id)
    try {
      const res = await toggleRecurringActive(item.id, !item.is_active)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(
          !item.is_active
            ? language === 'en' ? 'Schedule resumed' : 'Jadwal diaktifkan kembali'
            : language === 'en' ? 'Schedule paused' : 'Jadwal berhasil dijeda'
        )
      }
    } catch {
      toast.error('Error toggling status')
    } finally {
      setTogglingId(null)
    }
  }

  // Handle Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      const res = await deleteRecurringTransaction(deletingId)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(t.recurring.deleteSuccess)
      }
    } catch {
      toast.error('Failed to delete schedule')
    } finally {
      setIsDeleting(false)
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
            {t.recurring.title}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono leading-relaxed mt-0.5">
            {t.recurring.subtitle}
          </p>
        </div>

        <Button
          onClick={() => {
            setEditingItem(null)
            setModalOpen(true)
          }}
          size="sm"
          className="gap-1.5 cursor-pointer text-xs font-bold bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t.recurring.addBtn}</span>
        </Button>
      </div>

      {/* Scorecard: 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: Monthly Outflow */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col justify-between gap-1.5 shadow-2xs">
          <div className="flex items-center justify-between gap-1 min-h-[22px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] leading-tight">
              {t.recurring.monthlyCommitment}
            </span>
            <TrendingDown className="w-3.5 h-3.5 text-[#E11D48] shrink-0" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold font-mono text-[#E11D48] tracking-tight tnum">
              -{maskCurrency(formatCurrency(monthlyOutflow, displayCurrency), isPrivate)}
            </h3>
            <span className="text-[10px] font-mono text-[#94A3B8] mt-0.5 block">
              /{language === 'en' ? 'month' : 'bulan'}
            </span>
          </div>
        </div>

        {/* Card 2: Monthly Inflow */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col justify-between gap-1.5 shadow-2xs">
          <div className="flex items-center justify-between gap-1 min-h-[22px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] leading-tight">
              {t.recurring.monthlyIncome}
            </span>
            <TrendingUp className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold font-mono text-[#0D9488] tracking-tight tnum">
              +{maskCurrency(formatCurrency(monthlyInflow, displayCurrency), isPrivate)}
            </h3>
            <span className="text-[10px] font-mono text-[#94A3B8] mt-0.5 block">
              /{language === 'en' ? 'month' : 'bulan'}
            </span>
          </div>
        </div>

        {/* Card 3: Net Cashflow */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col justify-between gap-1.5 shadow-2xs">
          <div className="flex items-center justify-between gap-1 min-h-[22px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] leading-tight">
              {t.recurring.netCommitment}
            </span>
            <Scale className="w-3.5 h-3.5 text-[#0F172A] dark:text-[#FAFAFA] shrink-0" />
          </div>
          <div>
            <h3
              className={cn(
                'text-sm sm:text-base font-bold font-mono tracking-tight tnum',
                netMonthly >= 0 ? 'text-[#0D9488]' : 'text-[#E11D48]'
              )}
            >
              {netMonthly >= 0 ? '+' : ''}
              {maskCurrency(formatCurrency(netMonthly, displayCurrency), isPrivate)}
            </h3>
            <span className="text-[10px] font-mono text-[#94A3B8] mt-0.5 block">
              {netMonthly >= 0
                ? language === 'en' ? 'Surplus cash' : 'Surplus arus kas'
                : language === 'en' ? 'Deficit' : 'Defisit tetap'}
            </span>
          </div>
        </div>

        {/* Card 4: Due in 7 Days */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col justify-between gap-1.5 shadow-2xs">
          <div className="flex items-center justify-between gap-1 min-h-[22px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] leading-tight">
              {t.recurring.dueSoonBadge}
            </span>
            <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-base sm:text-lg font-bold font-mono tracking-tight text-[#0F172A] dark:text-[#FAFAFA]">
                {dueSoonCount}
              </span>
              <span className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                {language === 'en' ? 'items' : 'tagihan'}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              {dueSoonCount > 0 ? (
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{language === 'en' ? 'Action required' : 'Perlu diselesaikan'}</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>{language === 'en' ? 'All settled' : 'Semua aman'}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Segmented Tabs without truncation */}
        <div className="flex items-center gap-1 p-1 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-xl border border-[#E5E7EB] dark:border-[#27272A] overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
              activeTab === 'all'
                ? 'bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#FAFAFA] shadow-xs'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            {t.recurring.tabAll}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('expense')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
              activeTab === 'expense'
                ? 'bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#FAFAFA] shadow-xs'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            {t.recurring.tabExpenses}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('income')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
              activeTab === 'income'
                ? 'bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#FAFAFA] shadow-xs'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            {t.recurring.tabIncome}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paused')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
              activeTab === 'paused'
                ? 'bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#FAFAFA] shadow-xs'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            {t.recurring.tabPaused}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.common.search}
            className="pl-8 text-xs h-9"
          />
        </div>
      </div>

      {/* Recurring Items List */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon="RefreshCw"
          title={t.recurring.emptyTitle}
          description={t.recurring.emptyDesc}
          actionLabel={t.recurring.addBtn}
          onAction={() => {
            setEditingItem(null)
            setModalOpen(true)
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const isIncome = item.type === 'income'
            let daysUntil = 0
            try {
              daysUntil = differenceInCalendarDays(parseISO(item.next_due_date), today)
            } catch {
              // ignore
            }

            const isDueNow = daysUntil <= 0
            const isDueSoon = daysUntil > 0 && daysUntil <= 7

            return (
              <div
                key={item.id}
                className={cn(
                  'p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#121215] border flex flex-col justify-between gap-4 transition-all shadow-2xs',
                  !item.is_active
                    ? 'border-[#E5E7EB] dark:border-[#27272A] opacity-60'
                    : isDueNow
                      ? 'border-rose-300 dark:border-rose-800/80 bg-rose-50/20 dark:bg-rose-950/10'
                      : isDueSoon
                        ? 'border-amber-300 dark:border-amber-700/80 bg-amber-50/20 dark:bg-amber-950/10'
                        : 'border-[#E5E7EB] dark:border-[#27272A] hover:border-[#0F172A] dark:hover:border-[#FAFAFA]'
                )}
              >
                {/* Card Clickable Top & Middle Area */}
                <div
                  onClick={() => {
                    setDetailRecurring(item)
                    setDetailModalOpen(true)
                  }}
                  className="cursor-pointer flex flex-col gap-4"
                >
                  {/* Card Top: Icon, Name, Category, Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border',
                          isIncome
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-[#0D9488]'
                            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-[#E11D48]'
                        )}
                      >
                        <DynamicIcon
                          name={item.category?.icon || (isIncome ? 'TrendingUp' : 'Receipt')}
                          className="w-5 h-5"
                        />
                      </div>

                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-[#0F172A] dark:text-[#FAFAFA] truncate">
                            {item.name}
                          </span>
                          {!item.is_active && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[#64748B] dark:text-[#94A3B8] shrink-0">
                              {t.recurring.statusPaused}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate mt-0.5">
                          <span>{item.category?.name || t.common.custom}</span>
                          <span>•</span>
                          <span>{item.account?.name || 'Account'} ({item.currency})</span>
                        </div>
                      </div>
                    </div>

                    {/* Frequency Badge */}
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] shrink-0">
                      {item.frequency === 'daily'
                        ? t.recurring.frequencyDaily
                        : item.frequency === 'weekly'
                          ? t.recurring.frequencyWeekly
                          : item.frequency === 'monthly'
                            ? t.recurring.frequencyMonthly
                            : t.recurring.frequencyYearly}
                    </span>
                  </div>

                  {/* Card Middle: Amount & Next Due Date */}
                  <div className="flex items-end justify-between gap-3 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A]">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8] block">
                        {t.recurring.nextDue}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
                        <span className="text-xs font-mono font-bold text-[#0F172A] dark:text-[#FAFAFA]">
                          {format(parseISO(item.next_due_date), 'dd MMM yyyy', { locale: dateFnsLocale })}
                        </span>
                      </div>

                      {/* Countdown indicator */}
                      {item.is_active && (
                        <div className="mt-1">
                          {daysUntil < 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>{t.recurring.overdue.replace('{days}', String(Math.abs(daysUntil)))}</span>
                            </span>
                          ) : daysUntil === 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 animate-pulse">
                              <Flame className="w-3 h-3 shrink-0" />
                              <span>{t.recurring.dueToday}</span>
                            </span>
                          ) : daysUntil <= 7 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                              <Clock className="w-3 h-3 shrink-0" />
                              <span>{t.recurring.dueInDays.replace('{days}', String(daysUntil))}</span>
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <span
                        className={cn(
                          'text-base sm:text-lg font-mono font-bold tracking-tight tnum',
                          isIncome ? 'text-[#0D9488]' : 'text-[#0F172A] dark:text-[#FAFAFA]'
                        )}
                      >
                        {isIncome ? '+' : '-'}{maskCurrency(formatCurrency(item.amount, item.currency), isPrivate)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="pt-2 border-t border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Toggle Active Button */}
                    <button
                      type="button"
                      disabled={togglingId === item.id}
                      onClick={() => handleToggleActive(item)}
                      className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] transition-colors cursor-pointer"
                      title={item.is_active ? t.recurring.pause : t.recurring.resume}
                    >
                      {togglingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : item.is_active ? (
                        <PauseCircle className="w-3.5 h-3.5" />
                      ) : (
                        <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem(item)
                        setModalOpen(true)
                      }}
                      className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] transition-colors cursor-pointer"
                      title={t.common.edit}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => setDeletingId(item.id)}
                      className="p-1.5 rounded-lg text-[#64748B] hover:text-rose-600 dark:text-[#94A3B8] dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                      title={t.common.delete}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Process / Log Now Action */}
                  <Button
                    size="sm"
                    disabled={processingId === item.id || !item.is_active}
                    onClick={() => handleProcess(item)}
                    className={cn(
                      'text-xs font-bold gap-1.5 cursor-pointer h-8 px-3.5 whitespace-nowrap shrink-0',
                      isDueNow
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A]'
                    )}
                  >
                    {processingId === item.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>{t.recurring.processNow}</span>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recurring Detail Modal */}
      <RecurringDetailModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setDetailRecurring(null)
        }}
        recurring={detailRecurring}
        rates={rates}
        onPayNow={(r) => handleProcess(r)}
        onEdit={(r) => {
          setEditingItem(r)
          setModalOpen(true)
        }}
        onToggleActive={(r) => handleToggleActive(r)}
        onDelete={(id) => setDeletingId(id)}
        isProcessing={processingId === detailRecurring?.id}
      />

      {/* Form Modal */}
      <RecurringFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingItem(null)
        }}
        accounts={accounts}
        categories={categories}
        editItem={editingItem}
        onSuccess={() => {
          toast.success(t.recurring.saveSuccess)
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={handleConfirmDelete}
        title={t.common.delete}
        message={t.recurring.deleteConfirm}
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  )
}
