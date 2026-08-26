'use client'

import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { Account, Category, CurrencyCode, RecurringFrequency, EnrichedRecurringTransaction } from '@/types/database'
import { createRecurringTransaction, updateRecurringTransaction } from '@/actions/recurring'
import { useLanguage } from '@/lib/i18n/language-context'
import { formatCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils/cn'
import { format } from 'date-fns'
import { AlertCircle, Wallet, AlignLeft } from 'lucide-react'

interface RecurringFormModalProps {
  isOpen: boolean
  onClose: () => void
  accounts: Account[]
  categories: Category[]
  editItem?: EnrichedRecurringTransaction | null
  onSuccess?: () => void
}

const CURRENCY_LIST = [
  { code: 'IDR', name: 'Rupiah Indonesia' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'SGD', name: 'Singapore Dollar' },
]

export function RecurringFormModal({
  isOpen,
  onClose,
  accounts,
  categories,
  editItem,
  onSuccess,
}: RecurringFormModalProps) {
  const { t, language } = useLanguage()

  const [name, setName] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<CurrencyCode>('IDR')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState<string>('none')
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly')
  const [intervalCount, setIntervalCount] = useState(1)
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [nextDueDate, setNextDueDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState('')
  const [autoProcess, setAutoProcess] = useState(false)
  const [notes, setNotes] = useState('')
  const [showMemo, setShowMemo] = useState(false)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Initialize or reset form values
  useEffect(() => {
    if (editItem) {
      setName(editItem.name)
      setType(editItem.type)
      setAmount(String(editItem.amount))
      setCurrency(editItem.currency)
      setAccountId(editItem.account_id)
      setCategoryId(editItem.category_id || 'none')
      setFrequency(editItem.frequency)
      setIntervalCount(editItem.interval_count || 1)
      setStartDate(editItem.start_date.split('T')[0])
      setNextDueDate(editItem.next_due_date.split('T')[0])
      setEndDate(editItem.end_date ? editItem.end_date.split('T')[0] : '')
      setAutoProcess(editItem.auto_process || false)
      setNotes(editItem.notes || '')
      setShowMemo(!!editItem.notes)
    } else {
      setName('')
      setType('expense')
      setAmount('')
      setCurrency('IDR')
      setAccountId(accounts[0]?.id || '')
      const defaultCat = categories.find((c) => c.type === 'expense')
      setCategoryId(defaultCat?.id || 'none')
      setFrequency('monthly')
      setIntervalCount(1)
      const today = format(new Date(), 'yyyy-MM-dd')
      setStartDate(today)
      setNextDueDate(today)
      setEndDate('')
      setAutoProcess(false)
      setNotes('')
      setShowMemo(false)
    }
    setErrorMsg(null)
  }, [editItem, isOpen, accounts, categories])

  // Sync category options when type changes
  const filteredCategories = categories.filter((c) => c.type === type)

  // Auto-switch currency when account is selected
  const handleAccountChange = (accId: string) => {
    setAccountId(accId)
    const selectedAcc = accounts.find((a) => a.id === accId)
    if (selectedAcc?.currency) {
      setCurrency(selectedAcc.currency)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const numAmount = parseFloat(amount)
    if (!name.trim()) {
      setErrorMsg(language === 'en' ? 'Please enter a name' : 'Nama jadwal tidak boleh kosong')
      return
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg(language === 'en' ? 'Please enter a valid amount' : 'Nominal harus lebih besar dari 0')
      return
    }
    if (!accountId) {
      setErrorMsg(language === 'en' ? 'Please select a source account' : 'Silakan pilih rekening sumber')
      return
    }

    setLoading(true)
    try {
      const finalCatId = categoryId && categoryId !== 'none' ? categoryId : null

      if (editItem) {
        const res = await updateRecurringTransaction(editItem.id, {
          name: name.trim(),
          type,
          amount: numAmount,
          currency,
          accountId,
          categoryId: finalCatId,
          frequency,
          intervalCount,
          startDate,
          nextDueDate,
          endDate: endDate || null,
          autoProcess,
          notes: showMemo && notes.trim() ? notes.trim() : null,
        })
        if (res.error) {
          setErrorMsg(res.error)
          return
        }
      } else {
        const res = await createRecurringTransaction({
          name: name.trim(),
          type,
          amount: numAmount,
          currency,
          accountId,
          categoryId: finalCatId,
          frequency,
          intervalCount,
          startDate,
          nextDueDate,
          endDate: endDate || null,
          isActive: true,
          autoProcess,
          notes: showMemo && notes.trim() ? notes.trim() : null,
        })
        if (res.error) {
          setErrorMsg(res.error)
          return
        }
      }

      onSuccess?.()
      onClose()
    } catch {
      setErrorMsg(language === 'en' ? 'An unexpected error occurred' : 'Terjadi kesalahan sistem')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editItem ? t.recurring.modalEditTitle : t.recurring.modalAddTitle}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Type Switcher */}
        <div className="grid grid-cols-2 p-1 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-xl border border-[#E5E7EB] dark:border-[#27272A]">
          <button
            type="button"
            onClick={() => {
              setType('expense')
              const firstExp = categories.find((c) => c.type === 'expense')
              setCategoryId(firstExp?.id || 'none')
            }}
            className={cn(
              'py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer',
              type === 'expense'
                ? 'bg-white dark:bg-[#121215] text-[#E11D48] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]'
            )}
          >
            {t.quickAdd.expense}
          </button>
          <button
            type="button"
            onClick={() => {
              setType('income')
              const firstInc = categories.find((c) => c.type === 'income')
              setCategoryId(firstInc?.id || 'none')
            }}
            className={cn(
              'py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer',
              type === 'income'
                ? 'bg-white dark:bg-[#121215] text-[#0D9488] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]'
            )}
          >
            {t.quickAdd.income}
          </button>
        </div>

        {/* Name Input with Memo Trigger Button */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
            {t.recurring.nameLabel} <span className="text-rose-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.recurring.namePlaceholder}
              required
              className="text-xs flex-1"
            />
            <button
              type="button"
              onClick={() => setShowMemo(!showMemo)}
              title={t.quickAdd.memoTitle}
              className={cn(
                'h-9 px-3 rounded-lg border transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-1.5 text-xs font-medium',
                showMemo
                  ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-[#FAFAFA] dark:text-[#0F172A]'
                  : 'bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] border-[#E5E7EB] dark:border-[#27272A]'
              )}
            >
              <AlignLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Memo</span>
            </button>
          </div>
        </div>

        {/* Expandable Free Text Memo Box (Matching Transaction Form) */}
        {showMemo && (
          <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] animate-in fade-in duration-150">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.quickAdd.memoPlaceholder || 'Catatan tambahan / nomor pelanggan...'}
              className="w-full p-2 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none"
            />
          </div>
        )}

        {/* Amount & Currency Selection Grid (Like Create Account) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
              {t.common.amount} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              required
              className="text-xs font-mono font-bold"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
              {t.common.currency}
            </label>
            <Select value={currency} onValueChange={(val) => setCurrency(val as CurrencyCode)}>
              <SelectTrigger className="w-full text-xs font-bold">
                <SelectValue>{currency}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_LIST.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Frequency Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
            {t.recurring.frequencyLabel}
          </label>
          <div className="grid grid-cols-4 gap-1 p-1 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-xl border border-[#E5E7EB] dark:border-[#27272A]">
            {(['daily', 'weekly', 'monthly', 'yearly'] as RecurringFrequency[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                className={cn(
                  'py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer capitalize',
                  frequency === f
                    ? 'bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#FAFAFA] shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]'
                )}
              >
                {f === 'daily'
                  ? t.recurring.frequencyDaily
                  : f === 'weekly'
                    ? t.recurring.frequencyWeekly
                    : f === 'monthly'
                      ? t.recurring.frequencyMonthly
                      : t.recurring.frequencyYearly}
              </button>
            ))}
          </div>
        </div>

        {/* Account Selection (Like Debt Payment Form) & Category Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Account */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
              {t.common.account} <span className="text-rose-500">*</span>
            </label>
            <Select value={accountId} onValueChange={handleAccountChange}>
              <SelectTrigger className="w-full min-w-0 text-xs">
                <SelectValue placeholder={t.common.account}>
                  {(() => {
                    const acc = accounts.find((a) => a.id === accountId)
                    return acc ? `${acc.name} (${formatCurrency(acc.current_balance, acc.currency)})` : t.common.account
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <div className="flex items-center justify-between gap-3 w-full">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-3.5 h-3.5 text-[#94A3B8]" />
                        <span>{a.name}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-[#64748B] dark:text-[#94A3B8] tnum">
                        {formatCurrency(a.current_balance, a.currency)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
              {t.common.category}
            </label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full min-w-0 text-xs">
                <SelectValue placeholder={t.common.category}>
                  {(() => {
                    const cat = filteredCategories.find((c) => c.id === categoryId)
                    return cat ? cat.name : t.common.custom
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-[#64748B]">{t.common.custom}</span>
                </SelectItem>
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <DynamicIcon name={cat.icon || 'Tag'} className="w-3.5 h-3.5 text-[#64748B]" />
                      <span>{cat.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date Pickers using DatePicker UI component */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
              {t.recurring.nextDueLabel} <span className="text-rose-500">*</span>
            </label>
            <DatePicker
              value={nextDueDate}
              onChange={setNextDueDate}
              placeholder={t.recurring.nextDueLabel}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
              {t.recurring.endDateLabel}
            </label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder={t.recurring.endDateLabel}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs cursor-pointer"
          >
            {t.common.cancel}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={loading}
            className="text-xs font-bold bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] cursor-pointer"
          >
            {loading ? t.common.loading : t.common.save}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
