'use client'

import React, { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { EnrichedBudget, Category } from '@/types/database'
import { setBudget, deleteBudget } from '@/actions/budgets'
import { CURRENCIES, CurrencyCode } from '@/lib/constants/currencies'
import { useLanguage } from '@/lib/i18n/language-context'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface BudgetFormModalProps {
  isOpen: boolean
  onClose: () => void
  budget?: EnrichedBudget | null
  categories?: Category[]
  periodStartDate: string
  onSuccess?: () => void
}

export function BudgetFormModal({
  isOpen,
  onClose,
  budget,
  categories = [],
  periodStartDate,
  onSuccess,
}: BudgetFormModalProps) {
  const { t } = useLanguage()

  if (!isOpen) return null

  const isEditing = !!budget && !budget.id.startsWith('virtual-') && (budget.amount || 0) > 0
  const modalTitle = budget?.category?.name
    ? `${t.budgets.modalTitle}: ${budget.category.name}`
    : t.budgets.modalTitle

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      maxWidth="sm"
    >
      <BudgetForm
        key={`${budget?.category_id || 'new'}-${budget?.currency || 'IDR'}`}
        budget={budget}
        categories={categories}
        periodStartDate={periodStartDate}
        isEditing={isEditing}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Modal>
  )
}

interface BudgetFormProps {
  budget?: EnrichedBudget | null
  categories: Category[]
  periodStartDate: string
  isEditing: boolean
  onClose: () => void
  onSuccess?: () => void
}

function BudgetForm({
  budget,
  categories,
  periodStartDate,
  isEditing,
  onClose,
  onSuccess,
}: BudgetFormProps) {
  const { t } = useLanguage()
  const [categoryId, setCategoryId] = useState<string>(budget?.category_id || (categories[0]?.id || ''))
  const [currency, setCurrency] = useState<CurrencyCode>(budget?.currency || 'IDR')
  const [amount, setAmount] = useState<string>(budget?.amount ? String(budget.amount) : '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const expenseCategories = categories.filter((c) => c.type === 'expense')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!categoryId) {
      setError(t.budgets.selectExpenseCategoryError || 'Pilih kategori pengeluaran')
      return
    }

    const numericAmount = parseFloat(amount)
    if (isNaN(numericAmount) || numericAmount < 0) {
      setError(t.budgets.validAmountError || 'Masukkan nominal batas anggaran yang valid (>= 0)')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await setBudget({
        categoryId,
        currency,
        amount: numericAmount,
        periodStartDate,
      })

      if (res.error) {
        setError(res.error)
      } else {
        onSuccess?.()
        onClose()
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!budget?.id || budget.id.startsWith('virtual-')) {
      onClose()
      return
    }

    setIsLoading(true)
    try {
      const res = await deleteBudget(budget.id)
      if (res.error) {
        setError(res.error)
      } else {
        onSuccess?.()
        onClose()
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Category Selector (if creating without predefined category) */}
      {!budget?.category && expenseCategories.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            {t.common.category}
          </label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t.common.category} />
            </SelectTrigger>
            <SelectContent>
              {expenseCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <DynamicIcon name={c.icon || 'Tag'} className="w-3.5 h-3.5 text-[#E11D48]" />
                    <span>{c.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Currency Selector Pills */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {t.common.currency}
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {CURRENCIES.map((cur) => (
            <button
              key={cur}
              type="button"
              onClick={() => setCurrency(cur)}
              className={cn(
                'py-2 px-3 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer border text-center',
                currency === cur
                  ? 'bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] border-transparent shadow-2xs'
                  : 'bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#64748B] dark:text-[#94A3B8] border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F1F3F5] dark:hover:bg-[#26262E]'
              )}
            >
              {cur}
            </button>
          ))}
        </div>
      </div>

      {/* Amount Input */}
      <Input
        label={`${t.budgets.modalCapLabel || 'Batas Anggaran Bulanan'} (${currency})`}
        type="number"
        step="any"
        placeholder="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        autoFocus
        className="font-mono font-bold text-sm tnum"
        rightIcon={<span className="text-xs font-mono font-bold text-[#94A3B8]">{currency}</span>}
      />

      {error && <p className="text-xs font-semibold text-[#E11D48]">{error}</p>}

      <div className="flex items-center gap-2 pt-2">
        {isEditing && (
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            disabled={isLoading}
            className="p-2.5"
            title={t.common.delete}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
          {t.common.cancel}
        </Button>
        <Button type="submit" isLoading={isLoading} className="flex-1">
          {t.budgets.saveLimit}
        </Button>
      </div>
    </form>
  )
}
