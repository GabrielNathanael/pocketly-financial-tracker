'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Debt, DebtType, CurrencyCode } from '@/types/database'
import { createDebt, updateDebt, deleteDebt } from '@/actions/debts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CURRENCY_LIST } from '@/lib/constants/currencies'
import { useLanguage } from '@/lib/i18n/language-context'
import { toast } from 'sonner'
import { Trash2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface DebtFormProps {
  initialData?: Debt | null
  onSuccess?: () => void
}

export function DebtForm({ initialData, onSuccess }: DebtFormProps) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const isEditing = !!initialData

  const [type, setType] = useState<DebtType>(initialData?.type || 'debt')
  const [counterpartyName, setCounterpartyName] = useState(initialData?.counterparty_name || '')
  const [initialAmount, setInitialAmount] = useState<string>(
    initialData?.initial_amount ? String(initialData.initial_amount) : ''
  )
  const [currency, setCurrency] = useState<CurrencyCode>(initialData?.currency || 'IDR')
  const [dueDate, setDueDate] = useState<string>(initialData?.due_date || '')
  const [notes, setNotes] = useState<string>(initialData?.notes || '')

  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!counterpartyName.trim()) {
      setError(t.debts.counterpartyLabel + ' is required')
      return
    }

    const numericAmount = parseFloat(initialAmount)
    if (!isEditing && (isNaN(numericAmount) || numericAmount <= 0)) {
      setError(t.debts.principalLabel + ' must be > 0')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      if (isEditing && initialData) {
        const res = await updateDebt(initialData.id, {
          counterpartyName,
          dueDate: dueDate || null,
          notes: notes || null,
        })
        if (res.error) {
          setError(res.error)
          return
        }
      } else {
        const res = await createDebt({
          type,
          counterpartyName,
          initialAmount: numericAmount,
          currency,
          dueDate: dueDate || null,
          notes: notes || null,
        })
        if (res.error) {
          setError(res.error)
          return
        }
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/debts')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!initialData) return
    setIsDeleting(true)
    setShowDeleteConfirm(false)
    setError(null)

    try {
      const res = await deleteDebt(initialData.id)
      if (res.error) {
        setError(res.error)
      } else {
        toast.success(
          language === 'en' ? 'Debt record deleted successfully' : 'Catatan utang berhasil dihapus'
        )
        if (onSuccess) {
          onSuccess()
        } else {
          router.push('/debts')
        }
      }
    } catch (err) {
      const msg = (err as Error).message
      setError(msg)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}
      {/* Type toggle */}
      {!isEditing && (
        <div className="grid grid-cols-2 p-1 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-lg border border-[#E5E7EB] dark:border-[#27272A]">
          <button
            type="button"
            onClick={() => setType('debt')}
            className={cn(
              'py-2 rounded-md font-bold text-xs transition-colors cursor-pointer text-center',
              type === 'debt'
                ? 'bg-[#E11D48] text-white'
                : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            )}
          >
            {t.debts.debtType}
          </button>
          <button
            type="button"
            onClick={() => setType('receivable')}
            className={cn(
              'py-2 rounded-md font-bold text-xs transition-colors cursor-pointer text-center',
              type === 'receivable'
                ? 'bg-[#0D9488] text-white'
                : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            )}
          >
            {t.debts.receivableType}
          </button>
        </div>
      )}

      <Input
        label={t.debts.counterpartyLabel}
        type="text"
        placeholder={t.debts.counterpartyPlaceholder}
        value={counterpartyName}
        onChange={(e) => setCounterpartyName(e.target.value)}
        required
      />

      {!isEditing && (
        <div className="grid grid-cols-3 gap-2.5">
          <div className="col-span-2">
            <Input
              label={t.debts.principalLabel}
              type="number"
              step="any"
              placeholder="0"
              value={initialAmount}
              onChange={(e) => setInitialAmount(e.target.value)}
              required
              className="font-mono font-bold text-sm tnum"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.common.currency}
            </label>
            <Select value={currency} onValueChange={(val) => setCurrency(val as CurrencyCode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_LIST.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Due Date Picker */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {t.debts.dueDateLabel}
        </label>
        <DatePicker value={dueDate} onChange={setDueDate} placeholder={t.debts.dueDatePlaceholder} />
      </div>

      <Input
        label={t.debts.termsLabel}
        type="text"
        placeholder={t.debts.termsPlaceholder}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {error && <p className="text-xs font-semibold text-[#E11D48]">{error}</p>}

      <div className="flex items-center gap-2 pt-2">
        {isEditing && (
          <Button
            type="button"
            variant="danger"
            onClick={() => setShowDeleteConfirm(true)}
            className="px-3"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
        <Button type="submit" isLoading={isLoading} className="flex-1">
          {isEditing ? t.debts.saveRecord : t.debts.createRecord}
        </Button>
      </div>

      {isEditing && (
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          isLoading={isDeleting}
          title={t.debts.deleteConfirmTitle}
          message={t.debts.deleteConfirmMsg}
        />
      )}
    </form>
  )
}
