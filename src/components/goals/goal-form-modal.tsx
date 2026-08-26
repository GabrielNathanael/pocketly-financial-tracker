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
import { AVAILABLE_ICONS } from '@/lib/constants/default-categories'
import { Category, CurrencyCode, GoalStatus, EnrichedSavingsGoal } from '@/types/database'
import { createSavingsGoal, updateSavingsGoal } from '@/actions/goals'
import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils/cn'
import { format, addMonths } from 'date-fns'
import { AlertCircle, AlignLeft } from 'lucide-react'

interface GoalFormModalProps {
  isOpen: boolean
  onClose: () => void
  categories: Category[]
  editItem?: EnrichedSavingsGoal | null
  onSuccess?: () => void
}

const CURRENCY_LIST = [
  { code: 'IDR', name: 'Rupiah Indonesia' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'SGD', name: 'Singapore Dollar' },
]

const GOAL_COLORS = [
  '#0D9488',
  '#0F172A',
  '#3B82F6',
  '#8B5CF6',
  '#E11D48',
  '#F59E0B',
  '#10B981',
  '#EC4899',
]

export function GoalFormModal({
  isOpen,
  onClose,
  categories,
  editItem,
  onSuccess,
}: GoalFormModalProps) {
  const { t, language } = useLanguage()

  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [initialSaved, setInitialSaved] = useState('')
  const [currency, setCurrency] = useState<CurrencyCode>('IDR')
  const [targetDate, setTargetDate] = useState(format(addMonths(new Date(), 6), 'yyyy-MM-dd'))
  const [categoryId, setCategoryId] = useState<string>('none')
  const [icon, setIcon] = useState('Target')
  const [color, setColor] = useState('#0D9488')
  const [status, setStatus] = useState<GoalStatus>('in_progress')
  const [notes, setNotes] = useState('')
  const [showMemo, setShowMemo] = useState(false)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Filter only expense categories
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  useEffect(() => {
    if (editItem) {
      setName(editItem.name)
      setTargetAmount(String(editItem.target_amount))
      setInitialSaved(String(editItem.current_amount))
      setCurrency(editItem.currency)
      setTargetDate(editItem.target_date.split('T')[0])
      setCategoryId(editItem.category_id || 'none')
      setIcon(editItem.icon || 'Target')
      setColor(editItem.color || '#0D9488')
      setStatus(editItem.status)
      setNotes(editItem.notes || '')
      setShowMemo(!!editItem.notes)
    } else {
      setName('')
      setTargetAmount('')
      setInitialSaved('')
      setCurrency('IDR')
      setTargetDate(format(addMonths(new Date(), 6), 'yyyy-MM-dd'))
      setCategoryId('none')
      setIcon('Target')
      setColor('#0D9488')
      setStatus('in_progress')
      setNotes('')
      setShowMemo(false)
    }
    setErrorMsg(null)
  }, [editItem, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const numTarget = parseFloat(targetAmount)
    const numInitial = initialSaved ? parseFloat(initialSaved) : 0

    if (!name.trim()) {
      setErrorMsg(language === 'en' ? 'Please enter goal name' : 'Nama target tidak boleh kosong')
      return
    }
    if (isNaN(numTarget) || numTarget <= 0) {
      setErrorMsg(language === 'en' ? 'Target amount must be greater than 0' : 'Nominal target harus lebih dari 0')
      return
    }

    setLoading(true)
    try {
      const finalCatId = categoryId && categoryId !== 'none' ? categoryId : null

      if (editItem) {
        const res = await updateSavingsGoal(editItem.id, {
          name: name.trim(),
          targetAmount: numTarget,
          currency,
          targetDate,
          categoryId: finalCatId,
          icon,
          color,
          status,
          notes: showMemo && notes.trim() ? notes.trim() : null,
        })
        if (res.error) {
          setErrorMsg(res.error)
          return
        }
      } else {
        const res = await createSavingsGoal({
          name: name.trim(),
          targetAmount: numTarget,
          initialSaved: numInitial,
          currency,
          targetDate,
          categoryId: finalCatId,
          icon,
          color,
          status,
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
      title={editItem ? t.goals.modalEditTitle : t.goals.modalAddTitle}
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

        {/* Goal Name Input with Memo Trigger */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
            {t.goals.nameLabel} <span className="text-rose-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.goals.namePlaceholder}
              required
              className="text-xs flex-1"
            />
            <button
              type="button"
              onClick={() => setShowMemo(!showMemo)}
              title="Catatan Tambahan"
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

        {/* Expandable Memo Drawer */}
        {showMemo && (
          <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] animate-in fade-in duration-150">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Rencana alokasi, link wishlist, atau catatan impian..."
              className="w-full p-2 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none"
            />
          </div>
        )}

        {/* Target Amount & Currency Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
              {t.goals.targetAmountLabel} <span className="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              step="any"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
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

        {/* Initial Saved Amount (Only for new goals) */}
        {!editItem && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
              {t.goals.initialSavedLabel}
            </label>
            <Input
              type="number"
              step="any"
              value={initialSaved}
              onChange={(e) => setInitialSaved(e.target.value)}
              placeholder="0"
              className="text-xs font-mono"
            />
          </div>
        )}

        {/* Stacked Target Date & Expense Category */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
            {t.goals.targetDateLabel} <span className="text-rose-500">*</span>
          </label>
          <DatePicker
            value={targetDate}
            onChange={setTargetDate}
            placeholder={t.goals.targetDateLabel}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
            {t.common.category}
          </label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-full min-w-0 text-xs">
              <SelectValue placeholder={t.common.category}>
                {(() => {
                  const cat = expenseCategories.find((c) => c.id === categoryId)
                  return cat ? cat.name : t.common.custom
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="text-[#64748B]">{t.common.custom}</span>
              </SelectItem>
              {expenseCategories.map((cat) => (
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

        {/* Icon Picker Grid & Color Theme (Matching Category Form Style) */}
        <div className="flex flex-col gap-2 p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            {t.categories.iconLabel} & {language === 'en' ? 'Color Theme' : 'Warna Tema'}
          </span>

          {/* Icon Picker Grid matching Category Form */}
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-36 overflow-y-auto p-0.5">
            {AVAILABLE_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setIcon(ic)}
                className={cn(
                  'p-2 rounded-lg border flex items-center justify-center transition-colors cursor-pointer',
                  icon === ic
                    ? 'border-[#0F172A] bg-[#0F172A] text-white dark:border-[#FAFAFA] dark:bg-[#FAFAFA] dark:text-[#0F172A]'
                    : 'border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F3F5] dark:hover:bg-[#26262E]'
                )}
              >
                <DynamicIcon name={ic} className="w-4 h-4" />
              </button>
            ))}
          </div>

          {/* Color palette */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A]">
            {GOAL_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => setColor(col)}
                style={{ backgroundColor: col }}
                className={cn(
                  'w-5 h-5 rounded-full transition-all cursor-pointer shrink-0',
                  color === col ? 'ring-2 ring-offset-2 ring-[#0F172A] dark:ring-[#FAFAFA] scale-110' : 'opacity-80 hover:opacity-100'
                )}
              />
            ))}
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
