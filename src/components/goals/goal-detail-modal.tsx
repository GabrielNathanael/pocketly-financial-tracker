'use client'

import React, { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { Button } from '@/components/ui/button'
import { EnrichedSavingsGoal, EnrichedSavingsGoalDeposit } from '@/types/database'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils/cn'
import { parseISO, differenceInCalendarDays, differenceInCalendarMonths } from 'date-fns'
import {
  Calendar,
  Sparkles,
  Trophy,
  Target,
  Edit2,
  Trash2,
  PauseCircle,
  PlayCircle,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  CheckCircle2,
  Clock,
} from 'lucide-react'

interface GoalDetailModalProps {
  isOpen: boolean
  onClose: () => void
  goal: EnrichedSavingsGoal | null
  onDeposit: (goal: EnrichedSavingsGoal) => void
  onEdit: (goal: EnrichedSavingsGoal) => void
  onTogglePause: (goal: EnrichedSavingsGoal) => void
  onDelete: (goalId: string) => void
}

export function GoalDetailModal({
  isOpen,
  onClose,
  goal,
  onDeposit,
  onEdit,
  onTogglePause,
  onDelete,
}: GoalDetailModalProps) {
  const { t, language } = useLanguage()
  const [selectedDeposit, setSelectedDeposit] = useState<EnrichedSavingsGoalDeposit | null>(null)
  const [displayLimit, setDisplayLimit] = useState(25)

  if (!goal) return null

  const targetAmt = Number(goal.target_amount)
  const currentAmt = Number(goal.current_amount)
  const remainingAmt = Math.max(0, targetAmt - currentAmt)
  const progressPct = targetAmt > 0 ? Math.min(100, Math.round((currentAmt / targetAmt) * 1000) / 10) : 0
  const isCompleted = goal.status === 'completed' || currentAmt >= targetAmt
  const isPaused = goal.status === 'paused'

  const today = new Date()
  let daysLeft = 0
  let monthsLeft = 0
  let monthlyNeeded = 0

  if (goal.target_date) {
    try {
      const targetDateObj = parseISO(goal.target_date)
      daysLeft = differenceInCalendarDays(targetDateObj, today)
      monthsLeft = Math.max(1, differenceInCalendarMonths(targetDateObj, today))
      if (remainingAmt > 0 && monthsLeft > 0) {
        monthlyNeeded = remainingAmt / monthsLeft
      }
    } catch {
      // ignore
    }
  }

  const deposits = goal.deposits || []

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={goal.name}
      description={goal.notes || (language === 'en' ? 'Savings Goal Overview & Mutation History' : 'Detail Target Tabungan & Riwayat Mutasi')}
      maxWidth="lg"
    >
      <div className="flex flex-col gap-5 pt-1">
        {/* Header Hero Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                style={{ backgroundColor: goal.color || '#0D9488' }}
              >
                <DynamicIcon name={goal.icon || 'Target'} className="w-6 h-6" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-[#FAFAFA] truncate">
                    {goal.name}
                  </h2>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1',
                      isCompleted
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : isPaused
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                          : 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300'
                    )}
                  >
                    {isCompleted ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{language === 'en' ? 'Completed' : 'Tercapai'}</span>
                      </>
                    ) : isPaused ? (
                      <>
                        <PauseCircle className="w-3 h-3" />
                        <span>{language === 'en' ? 'Paused' : 'Dijeda'}</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3" />
                        <span>{language === 'en' ? 'In Progress' : 'Berjalan'}</span>
                      </>
                    )}
                  </span>
                </div>
                {goal.category && (
                  <span className="text-xs text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1 mt-0.5">
                    <DynamicIcon name={goal.category.icon || 'Tag'} className="w-3.5 h-3.5" />
                    <span>{goal.category.name}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-[#0F172A] dark:text-[#FAFAFA]">
                {progressPct}%
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex flex-col gap-1.5">
            <div className="h-3 w-full rounded-full bg-[#E5E7EB] dark:bg-[#27272A] overflow-hidden p-0.5">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: goal.color || '#0D9488',
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-mono font-bold">
              <span className="text-[#0D9488]">
                {formatCurrency(currentAmt, goal.currency)}
              </span>
              <span className="text-[#64748B] dark:text-[#94A3B8]">
                {formatCurrency(targetAmt, goal.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Financial Metrics Stack (Vertical) */}
        <div className="flex flex-col gap-2.5">
          <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {language === 'en' ? 'Remaining Needed' : 'Sisa Kekurangan'}
            </span>
            <span className="text-xs sm:text-sm font-bold font-mono text-[#0F172A] dark:text-[#FAFAFA]">
              {formatCurrency(remainingAmt, goal.currency)}
            </span>
          </div>

          <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {language === 'en' ? 'Target Date' : 'Tenggat Waktu'}
            </span>
            <span className="text-xs sm:text-sm font-bold font-mono text-[#0F172A] dark:text-[#FAFAFA]">
              {goal.target_date ? formatDate(goal.target_date, 'd MMM yyyy', language) : '-'}
            </span>
          </div>

          <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {language === 'en' ? 'Est. Monthly Saving' : 'Estimasi / Bulan'}
            </span>
            <span className="text-xs sm:text-sm font-bold font-mono text-[#0D9488]">
              {monthlyNeeded > 0 ? formatCurrency(monthlyNeeded, goal.currency) : (language === 'en' ? 'Target Reached' : 'Tercapai')}
            </span>
          </div>
        </div>

        {/* Deposit & Withdrawal History */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FAFAFA] flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-[#64748B]" />
              <span>{language === 'en' ? 'Deposit & Withdrawal History' : 'Riwayat Setoran & Penarikan'}</span>
            </h3>
            <span className="text-xs font-mono text-[#94A3B8]">
              {deposits.length} {language === 'en' ? 'entries' : 'riwayat'}
            </span>
          </div>

          {deposits.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#27272A] text-center text-xs text-[#94A3B8]">
              {language === 'en' ? 'No deposits recorded yet. Click "+ Deposit" to add funds.' : 'Belum ada riwayat setoran. Klik "+ Setor" untuk menabung.'}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                {deposits.slice(0, displayLimit).map((dep) => {
                  const isDeposit = dep.type === 'deposit'
                  return (
                    <div
                      key={dep.id}
                      onClick={() => setSelectedDeposit(dep)}
                      className="p-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] hover:border-[#0F172A] dark:hover:border-[#FAFAFA] flex items-center gap-3 shadow-2xs group transition-all cursor-pointer"
                    >
                      <div
                        className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform',
                          isDeposit
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                        )}
                      >
                        {isDeposit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA] truncate group-hover:text-[#0D9488] transition-colors">
                            {isDeposit ? (language === 'en' ? 'Deposit' : 'Setoran') : (language === 'en' ? 'Withdrawal' : 'Penarikan')}
                            {dep.account && ` • ${dep.account.name}`}
                          </span>
                          <span
                            className={cn(
                              'text-xs font-mono font-bold shrink-0',
                              isDeposit ? 'text-[#0D9488]' : 'text-[#E11D48]'
                            )}
                          >
                            {isDeposit ? '+' : '-'}
                            {formatCurrency(Number(dep.amount), dep.currency)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                          <span className="whitespace-nowrap shrink-0">{formatDate(dep.deposit_date, 'd MMM yyyy', language)}</span>
                          {dep.notes && <span className="truncate">({dep.notes})</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination Load More Controls */}
              {displayLimit < deposits.length && (
                <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-xs">
                  <span className="text-[#64748B] dark:text-[#94A3B8] font-medium text-center sm:text-left text-[11px]">
                    {t.common.showing} <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA]">{Math.min(displayLimit, deposits.length)}</span> / {deposits.length}
                  </span>
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDisplayLimit((prev) => prev + 25)}
                      className="flex-1 sm:flex-initial text-xs font-bold cursor-pointer h-7 px-2.5"
                    >
                      {t.common.loadMore} (+{Math.min(25, deposits.length - displayLimit)})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDisplayLimit(deposits.length)}
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
        <div className="flex flex-col gap-2 pt-3 border-t border-[#E5E7EB] dark:border-[#27272A] w-full">
          <Button
            size="sm"
            onClick={() => {
              onClose()
              onDeposit(goal)
            }}
            className="w-full py-2.5 h-auto cursor-pointer text-xs font-bold bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'en' ? 'Deposit / Withdraw' : 'Setor / Tarik Dana'}</span>
          </Button>

          <div className="grid grid-cols-3 gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose()
                onEdit(goal)
              }}
              className="gap-1.5 cursor-pointer text-xs justify-center py-2 h-auto rounded-xl w-full"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{t.common.edit}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onTogglePause(goal)
              }}
              className="gap-1.5 cursor-pointer text-xs justify-center py-2 h-auto rounded-xl w-full"
            >
              {isPaused ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
              <span>{isPaused ? (language === 'en' ? 'Resume' : 'Lanjutkan') : (language === 'en' ? 'Pause' : 'Jeda')}</span>
            </Button>

            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                onClose()
                onDelete(goal.id)
              }}
              className="gap-1.5 cursor-pointer text-xs justify-center py-2 h-auto rounded-xl w-full"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.common.delete}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Deposit Slip Sub-Modal */}
      {selectedDeposit && (
        <Modal
          isOpen={!!selectedDeposit}
          onClose={() => setSelectedDeposit(null)}
          title={selectedDeposit.type === 'deposit' ? (language === 'en' ? 'Deposit Receipt' : 'Rincian Setoran Celengan') : (language === 'en' ? 'Withdrawal Receipt' : 'Rincian Penarikan Celengan')}
          description={`${goal.name} • ${formatDate(selectedDeposit.deposit_date, 'd MMMM yyyy', language)}`}
          maxWidth="sm"
        >
          <div className="flex flex-col gap-4 pt-1">
            {/* Amount Badge Card */}
            <div className="p-4 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col items-center justify-center text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                {selectedDeposit.type === 'deposit' ? (language === 'en' ? 'Allocated Funds' : 'Nominal Setoran') : (language === 'en' ? 'Withdrawn Funds' : 'Nominal Penarikan')}
              </span>
              <span
                className={cn(
                  'text-2xl font-black font-mono mt-1',
                  selectedDeposit.type === 'deposit' ? 'text-[#0D9488]' : 'text-[#E11D48]'
                )}
              >
                {selectedDeposit.type === 'deposit' ? '+' : '-'}
                {formatCurrency(Number(selectedDeposit.amount), selectedDeposit.currency)}
              </span>
            </div>

            {/* Info Grid */}
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A]">
                <span className="text-[#64748B] dark:text-[#94A3B8]">{language === 'en' ? 'Savings Target' : 'Target Celengan'}</span>
                <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA]">{goal.name}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A]">
                <span className="text-[#64748B] dark:text-[#94A3B8]">{language === 'en' ? 'Source Account' : 'Rekening Sumber'}</span>
                <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA]">{selectedDeposit.account?.name || '-'}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A]">
                <span className="text-[#64748B] dark:text-[#94A3B8]">{language === 'en' ? 'Transaction Date' : 'Tanggal & Waktu'}</span>
                <span className="font-mono font-bold text-[#0F172A] dark:text-[#FAFAFA]">{formatDate(selectedDeposit.deposit_date, 'd MMM yyyy, HH:mm', language)}</span>
              </div>
              {selectedDeposit.notes && (
                <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A]">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">{language === 'en' ? 'Notes / Memo' : 'Catatan Alokasi'}</span>
                  <span className="font-medium text-[#0F172A] dark:text-[#FAFAFA]">{selectedDeposit.notes}</span>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDeposit(null)}
              className="w-full mt-2 cursor-pointer"
            >
              {language === 'en' ? 'Close' : 'Tutup'}
            </Button>
          </div>
        </Modal>
      )}
    </Modal>
  )
}
