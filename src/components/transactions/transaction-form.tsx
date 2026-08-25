'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Account, Category, EnrichedTransaction, TransactionType, CurrencyCode } from '@/types/database'
import { createTransaction, updateTransaction, deleteTransaction } from '@/actions/transactions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CategoryPicker } from '@/components/categories/category-picker'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowDownRight, ArrowUpRight, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface TransactionFormProps {
  initialData?: EnrichedTransaction | null
  accounts: Account[]
  categories: Category[]
  onSuccess?: () => void
}

export function TransactionForm({
  initialData,
  accounts,
  categories,
  onSuccess,
}: TransactionFormProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const isEditing = !!initialData

  const [type, setType] = useState<TransactionType>(initialData?.type || 'expense')
  const [amount, setAmount] = useState<string>(initialData?.amount ? String(initialData.amount) : '')
  const [accountId, setAccountId] = useState<string>(initialData?.account_id || (accounts[0]?.id ?? ''))
  const [categoryId, setCategoryId] = useState<string>(initialData?.category_id || '')
  const [currency, setCurrency] = useState<CurrencyCode>(initialData?.currency || 'IDR')
  const [description, setDescription] = useState<string>(initialData?.description || '')
  const [date, setDate] = useState<string>(
    initialData?.transaction_date ? initialData.transaction_date.split('T')[0] : new Date().toISOString().split('T')[0]
  )

  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAccountChange = (accId: string) => {
    setAccountId(accId)
    const acc = accounts.find((a) => a.id === accId)
    if (acc) {
      setCurrency(acc.currency)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numericAmount = parseFloat(amount)

    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError(t.quickAdd.amountTitle + ' > 0')
      return
    }
    if (!accountId) {
      setError(t.quickAdd.selectAccount)
      return
    }
    if (!categoryId) {
      setError(t.quickAdd.selectCategory)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const payload = {
        accountId,
        categoryId,
        type,
        amount: numericAmount,
        currency,
        description: description.trim() || null,
        transactionDate: `${date}T${new Date().toTimeString().split(' ')[0]}.000Z`,
      }

      if (isEditing && initialData) {
        const res = await updateTransaction(initialData.id, payload)
        if (res.error) {
          setError(res.error)
          return
        }
      } else {
        const res = await createTransaction(payload)
        if (res.error) {
          setError(res.error)
          return
        }
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/transactions')
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

    try {
      const res = await deleteTransaction(initialData.id)
      if (res.error) {
        setError(res.error)
      } else {
        setShowDeleteConfirm(false)
        router.push('/transactions')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Type switch */}
      <div className="grid grid-cols-2 p-1 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-lg border border-[#E5E7EB] dark:border-[#27272A]">
        <button
          type="button"
          onClick={() => setType('expense')}
          className={cn(
            'flex items-center justify-center gap-1.5 py-2 rounded-md font-bold text-xs transition-colors cursor-pointer',
            type === 'expense'
              ? 'bg-[#E11D48] text-white'
              : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
          )}
        >
          <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
          {t.quickAdd.expense}
        </button>
        <button
          type="button"
          onClick={() => setType('income')}
          className={cn(
            'flex items-center justify-center gap-1.5 py-2 rounded-md font-bold text-xs transition-colors cursor-pointer',
            type === 'income'
              ? 'bg-[#0D9488] text-white'
              : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
          )}
        >
          <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
          {t.quickAdd.income}
        </button>
      </div>

      {/* Amount Input */}
      <Input
        label={t.common.amount}
        type="number"
        step="any"
        placeholder="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        className="font-mono font-bold text-base tnum"
        rightIcon={<span className="text-xs font-mono font-bold text-[#94A3B8]">{currency}</span>}
      />

      {/* Account Selection via Radix UI Select */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {t.common.account}
        </label>
        <Select value={accountId} onValueChange={handleAccountChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category Picker Grid */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {t.common.category}
        </label>
        <CategoryPicker
          categories={categories}
          selectedId={categoryId}
          onSelect={setCategoryId}
          typeFilter={type}
        />
      </div>

      {/* Date Picker */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {t.common.date}
        </label>
        <DatePicker value={date} onChange={setDate} />
      </div>

      {/* Description */}
      <Input
        label={t.common.note}
        type="text"
        placeholder={t.quickAdd.notePlaceholder}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {error && <p className="text-xs font-semibold text-[#E11D48]">{error}</p>}

      {/* Submit and Delete */}
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
          {isEditing ? t.common.save : t.quickAdd.recordBtn}
        </Button>
      </div>

      {isEditing && (
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          isLoading={isDeleting}
          title={t.transactions.deleteConfirmTitle}
          message={t.transactions.deleteConfirmMsg}
        />
      )}
    </form>
  )
}
