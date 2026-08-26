'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { Button } from '@/components/ui/button'
import { EnrichedRecurringTransaction, EnrichedTransaction } from '@/types/database'
import { formatCurrency, ForexRatesMap } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { useLanguage } from '@/lib/i18n/language-context'
import { getRecurringPaymentHistory } from '@/actions/recurring'
import { cn } from '@/lib/utils/cn'
import { parseISO, differenceInCalendarDays } from 'date-fns'
import {
  Calendar,
  Sparkles,
  Edit2,
  Trash2,
  PauseCircle,
  PlayCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Zap,
  Wallet,
  History,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
} from 'lucide-react'

interface RecurringDetailModalProps {
  isOpen: boolean
  onClose: () => void
  recurring: EnrichedRecurringTransaction | null
  rates?: ForexRatesMap
  onPayNow: (recurring: EnrichedRecurringTransaction) => void
  onEdit: (recurring: EnrichedRecurringTransaction) => void
  onToggleActive: (recurring: EnrichedRecurringTransaction) => void
  onDelete: (id: string) => void
  isProcessing?: boolean
}

export function RecurringDetailModal({
  isOpen,
  onClose,
  recurring,
  rates,
  onPayNow,
  onEdit,
  onToggleActive,
  onDelete,
  isProcessing = false,
}: RecurringDetailModalProps) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [history, setHistory] = useState<EnrichedTransaction[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [displayLimit, setDisplayLimit] = useState(25)

  useEffect(() => {
    if (isOpen && recurring) {
      setIsLoadingHistory(true)
      getRecurringPaymentHistory(recurring.name, recurring.category_id || undefined, recurring.account_id)
        .then((data) => {
          setHistory(data as EnrichedTransaction[])
        })
        .catch(() => {
          setHistory([])
        })
        .finally(() => {
          setIsLoadingHistory(false)
        })
    }
  }, [isOpen, recurring])

  if (!recurring) return null

  const isExpense = recurring.type === 'expense'
  const isPaused = !recurring.is_active
  const amount = Number(recurring.amount)

  const today = new Date()
  let daysUntil = 0
  let isOverdue = false
  let isDueToday = false

  try {
    const dueDate = parseISO(recurring.next_due_date)
    daysUntil = differenceInCalendarDays(dueDate, today)
    isOverdue = daysUntil < 0
    isDueToday = daysUntil === 0
  } catch {
    // ignore
  }

  // Calculate annual commitment projection
  let annualMultiplier = 12
  if (recurring.frequency === 'daily') annualMultiplier = 365
  else if (recurring.frequency === 'weekly') annualMultiplier = 52
  else if (recurring.frequency === 'yearly') annualMultiplier = 1

  const annualTotal = amount * annualMultiplier

  const freqLabel =
    recurring.frequency === 'daily'
      ? language === 'en'
        ? 'Daily'
        : 'Harian'
      : recurring.frequency === 'weekly'
        ? language === 'en'
          ? 'Weekly'
          : 'Mingguan'
        : recurring.frequency === 'yearly'
          ? language === 'en'
            ? 'Yearly'
            : 'Tahunan'
          : language === 'en'
            ? 'Monthly'
            : 'Bulanan'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={recurring.name}
      description={recurring.notes || (language === 'en' ? 'Recurring Schedule & Payment History' : 'Rincian Jadwal Tagihan & Riwayat Pembayaran')}
      maxWidth="lg"
    >
      <div className="flex flex-col gap-5 pt-1">
        {/* Header Hero Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center shrink-0 shadow-xs">
              <DynamicIcon
                name={recurring.category?.icon || (isExpense ? 'CreditCard' : 'Wallet')}
                className="w-6 h-6 text-[#0F172A] dark:text-[#FAFAFA]"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-[#FAFAFA] truncate">
                  {recurring.name}
                </h2>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1',
                    isPaused
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                      : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  )}
                >
                  {isPaused ? (
                    <>
                      <PauseCircle className="w-3 h-3" />
                      <span>{language === 'en' ? 'Paused' : 'Dijeda'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{language === 'en' ? 'Active' : 'Aktif'}</span>
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                <span>{freqLabel}</span>
                {recurring.category && <span>• {recurring.category.name}</span>}
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#E5E7EB] dark:border-[#27272A]">
            <span
              className={cn(
                'text-lg sm:text-2xl font-black font-mono tracking-tight',
                isExpense ? 'text-[#E11D48]' : 'text-[#0D9488]'
              )}
            >
              {isExpense ? '-' : '+'}
              {formatCurrency(amount, recurring.currency)}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8]">
              / {freqLabel.toLowerCase()}
            </span>
          </div>
        </div>

        {/* Schedule & Timing Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="p-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {language === 'en' ? 'Next Due Date' : 'Jatuh Tempo Berikutnya'}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
              <span className="text-xs sm:text-sm font-bold font-mono text-[#0F172A] dark:text-[#FAFAFA]">
                {formatDate(recurring.next_due_date, 'd MMM yyyy', language)}
              </span>
            </div>
            <span
              className={cn(
                'text-[10px] font-bold mt-1 flex items-center gap-1',
                isOverdue
                  ? 'text-[#E11D48]'
                  : isDueToday
                    ? 'text-rose-600'
                    : daysUntil <= 7
                      ? 'text-amber-600'
                      : 'text-[#64748B] dark:text-[#94A3B8]'
              )}
            >
              {isOverdue && <AlertCircle className="w-3 h-3" />}
              {isOverdue
                ? t.recurring.overdue.replace('{days}', String(Math.abs(daysUntil)))
                : isDueToday
                  ? t.recurring.dueToday
                  : t.recurring.dueInDays.replace('{days}', String(daysUntil))}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {language === 'en' ? 'Payment Account' : 'Rekening Sumber'}
            </span>
            <div className="flex items-center gap-1.5 mt-1 min-w-0">
              <Wallet className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#FAFAFA] truncate">
                {recurring.account?.name || '-'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#94A3B8] mt-1">
              {recurring.currency}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {language === 'en' ? 'Annual Projection' : 'Estimasi Pengeluaran / Thn'}
            </span>
            <span className="text-xs sm:text-sm font-bold font-mono text-[#0F172A] dark:text-[#FAFAFA] mt-1">
              {formatCurrency(annualTotal, recurring.currency)}
            </span>
            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-1 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span>{recurring.auto_process ? (language === 'en' ? 'Auto Scheduled' : 'Otomatis Terjadwal') : (language === 'en' ? 'Manual Pay' : 'Pembayaran Manual')}</span>
            </span>
          </div>
        </div>

        {/* Payment History Timeline */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FAFAFA] flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-[#64748B]" />
              <span>{language === 'en' ? 'Payment History' : 'Riwayat Pembayaran'}</span>
            </h3>
            <span className="text-xs font-mono text-[#94A3B8]">
              {history.length} {language === 'en' ? 'transactions' : 'transaksi'}
            </span>
          </div>

          {isLoadingHistory ? (
            <div className="p-4 rounded-xl border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center gap-2 text-xs text-[#94A3B8]">
              <Loader2 className="w-4 h-4 animate-spin text-[#0F172A] dark:text-[#FAFAFA]" />
              <span>{language === 'en' ? 'Loading history...' : 'Memuat riwayat...'}</span>
            </div>
          ) : history.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#27272A] text-center text-xs text-[#94A3B8]">
              {language === 'en' ? 'No recorded transactions yet for this schedule.' : 'Belum ada riwayat transaksi tercatat untuk tagihan ini.'}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                {history.slice(0, displayLimit).map((tx) => {
                  const isTxExpense = tx.type === 'expense'
                  return (
                    <div
                      key={tx.id}
                      onClick={() => {
                        onClose()
                        router.push(`/transactions/${tx.id}`)
                      }}
                      className="p-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] hover:border-[#0F172A] dark:hover:border-[#FAFAFA] flex items-center justify-between gap-3 shadow-2xs group cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform',
                            isTxExpense
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          {isTxExpense ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA] truncate group-hover:text-[#0D9488] transition-colors">
                            {tx.description || recurring.name}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                            <span>{formatDate(tx.transaction_date, 'd MMM yyyy', language)}</span>
                            {tx.account && <span>• {tx.account.name}</span>}
                            <span className="text-[9px] text-[#0D9488] underline hidden sm:inline">Lihat Transaksi</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={cn(
                          'text-xs font-mono font-bold shrink-0',
                          isTxExpense ? 'text-[#E11D48]' : 'text-[#0D9488]'
                        )}
                      >
                        {isTxExpense ? '-' : '+'}
                        {formatCurrency(Number(tx.amount), tx.currency)}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Pagination Load More Controls */}
              {displayLimit < history.length && (
                <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-xs">
                  <span className="text-[#64748B] dark:text-[#94A3B8] font-medium text-center sm:text-left text-[11px]">
                    {t.common.showing} <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA]">{Math.min(displayLimit, history.length)}</span> / {history.length}
                  </span>
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDisplayLimit((prev) => prev + 25)}
                      className="flex-1 sm:flex-initial text-xs font-bold cursor-pointer h-7 px-2.5"
                    >
                      {t.common.loadMore} (+{Math.min(25, history.length - displayLimit)})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDisplayLimit(history.length)}
                      className="flex-1 sm:flex-initial text-xs text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] cursor-pointer h-7 px-2"
                    >
                      {t.common.showAll}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E5E7EB] dark:border-[#27272A]">
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose()
                onEdit(recurring)
              }}
              className="gap-1.5 cursor-pointer text-xs"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{t.common.edit}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onToggleActive(recurring)
              }}
              className="gap-1.5 cursor-pointer text-xs"
            >
              {isPaused ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
              <span>{isPaused ? (language === 'en' ? 'Activate' : 'Aktifkan') : (language === 'en' ? 'Pause' : 'Jeda')}</span>
            </Button>

            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                onClose()
                onDelete(recurring.id)
              }}
              className="gap-1.5 cursor-pointer text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.common.delete}</span>
            </Button>
          </div>

          <Button
            size="sm"
            onClick={() => {
              onClose()
              onPayNow(recurring)
            }}
            isLoading={isProcessing}
            className="gap-1.5 cursor-pointer text-xs font-bold bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A]"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'Pay Now' : 'Bayar Sekarang'}</span>
          </Button>
        </div>
      </div>
    </Modal>
  )
}
