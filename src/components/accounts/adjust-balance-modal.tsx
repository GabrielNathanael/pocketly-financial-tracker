'use client'

import React, { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Account } from '@/types/database'
import { adjustAccountBalance } from '@/actions/accounts'
import { formatCurrency } from '@/lib/utils/currency'
import { useLanguage } from '@/lib/i18n/language-context'
import { Scale, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'

interface AdjustBalanceModalProps {
  isOpen: boolean
  onClose: () => void
  account: Account
  onSuccess?: () => void
}

export function AdjustBalanceModal({
  isOpen,
  onClose,
  account,
  onSuccess,
}: AdjustBalanceModalProps) {
  const { t, language } = useLanguage()
  const currentBal = Number(account.current_balance) || 0
  const [actualBalanceInput, setActualBalanceInput] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const targetAmount = parseFloat(actualBalanceInput)
  const hasValidInput = !isNaN(targetAmount)
  const delta = hasValidInput ? targetAmount - currentBal : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasValidInput) {
      setError(language === 'en' ? 'Please enter a valid amount' : 'Masukkan nominal saldo riil yang valid')
      return
    }

    if (Math.abs(delta) < 0.0001) {
      setError(language === 'en' ? 'Actual balance is already equal to recorded balance' : 'Saldo riil sama dengan saldo saat ini')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await adjustAccountBalance({
        accountId: account.id,
        newRealBalance: targetAmount,
        notes: notes.trim() || null,
      })

      if (res.error) {
        setError(res.error)
        toast.error(t.accounts.adjustFailed, { description: res.error })
      } else {
        toast.success(t.accounts.adjustSuccess, {
          description: `${account.name}: ${formatCurrency(targetAmount, account.currency)}`,
        })
        onSuccess?.()
        onClose()
      }
    } catch (err) {
      const msg = (err as Error).message
      setError(msg)
      toast.error(t.accounts.adjustFailed, { description: msg })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.accounts.adjustBalanceModalTitle}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
          {t.accounts.adjustBalanceDesc}
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Current Recorded Balance */}
        <div className="p-3.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.accounts.recordedBalanceLabel}
            </span>
            <span className="text-xs text-[#0F172A] dark:text-[#FAFAFA] font-medium">
              {account.name}
            </span>
          </div>
          <span className="text-sm sm:text-base font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] tnum">
            {formatCurrency(currentBal, account.currency)}
          </span>
        </div>

        {/* Actual Real Physical Balance Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            {t.accounts.actualBalanceLabel} ({account.currency}) *
          </label>
          <Input
            type="number"
            step="any"
            placeholder="0"
            value={actualBalanceInput}
            onChange={(e) => {
              setActualBalanceInput(e.target.value)
              setError(null)
            }}
            className="font-mono text-base font-bold"
            autoFocus
          />
        </div>

        {/* Live Delta Preview */}
        {hasValidInput && Math.abs(delta) >= 0.0001 && (
          <div
            className={cn(
              'p-3 rounded-xl border flex items-center justify-between text-xs font-mono tnum',
              delta > 0
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
            )}
          >
            <div className="flex items-center gap-1.5 font-sans font-bold">
              <Scale className="w-3.5 h-3.5" />
              <span>{t.accounts.discrepancyDeltaLabel}</span>
            </div>
            <span className="font-bold font-mono">
              {delta > 0 ? '+' : ''}
              {formatCurrency(delta, account.currency)}
            </span>
          </div>
        )}

        {/* Notes (Optional) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
            {language === 'en' ? 'Reason / Note (Optional)' : 'Catatan Rekonsiliasi (Opsional)'}
          </label>
          <Input
            type="text"
            placeholder={t.accounts.adjustNotesPlaceholder}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-xs"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="cursor-pointer"
          >
            {t.common.cancel}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !hasValidInput || Math.abs(delta) < 0.0001}
            className="cursor-pointer font-bold gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{t.common.save}</span>
          </Button>
        </div>
      </form>
    </Modal>
  )
}
