'use client'

import React, { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EnrichedBudget } from '@/types/database'
import { setBudget } from '@/actions/budgets'
import { useLanguage } from '@/lib/i18n/language-context'

interface BudgetFormModalProps {
  isOpen: boolean
  onClose: () => void
  budget: EnrichedBudget | null
  periodStartDate: string
  onSuccess?: () => void
}

export function BudgetFormModal({
  isOpen,
  onClose,
  budget,
  periodStartDate,
  onSuccess,
}: BudgetFormModalProps) {
  const { t } = useLanguage()

  if (!isOpen || !budget) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t.budgets.modalTitle}: ${budget.category?.name || t.common.category}`}
      maxWidth="sm"
    >
      <BudgetForm
        key={budget.category_id}
        budget={budget}
        periodStartDate={periodStartDate}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Modal>
  )
}

interface BudgetFormProps {
  budget: EnrichedBudget
  periodStartDate: string
  onClose: () => void
  onSuccess?: () => void
}

function BudgetForm({
  budget,
  periodStartDate,
  onClose,
  onSuccess,
}: BudgetFormProps) {
  const { t } = useLanguage()
  const [amount, setAmount] = useState<string>(budget.amount ? String(budget.amount) : '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const numericAmount = parseFloat(amount)
    if (isNaN(numericAmount) || numericAmount < 0) {
      setError('Please enter a valid amount (>= 0)')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await setBudget({
        categoryId: budget.category_id,
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label={t.budgets.modalCapLabel}
        type="number"
        step="any"
        placeholder="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        autoFocus
        className="font-mono font-bold text-sm tnum"
      />

      {error && <p className="text-xs font-semibold text-[#E11D48]">{error}</p>}

      <div className="flex items-center gap-2 pt-2">
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
