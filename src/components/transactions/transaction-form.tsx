'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Account, Category, EnrichedTransaction, TransactionType } from '@/types/database'
import { createTransaction, updateTransaction, deleteTransaction } from '@/actions/transactions'
import { DatePicker } from '@/components/ui/date-picker'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useLanguage } from '@/lib/i18n/language-context'
import { useUndo } from '@/lib/context/undo-context'
import { formatCurrency } from '@/lib/utils/currency'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ListPlus,
  AlignLeft,
  Plus,
  Trash2,
  Delete,
  Pin,
  Save,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import { savePinnedTemplate } from '@/lib/storage/pinned-templates'

interface ItemRow {
  name: string
  price: string
}

interface TransactionFormProps {
  initialData?: EnrichedTransaction | null
  accounts: Account[]
  categories: Category[]
  onSuccess?: () => void
}

function parseTransactionDescription(rawDesc?: string | null) {
  if (!rawDesc) return { baseDescription: '', items: [] as ItemRow[], memo: '' }

  let desc = rawDesc
  let memo = ''
  const items: ItemRow[] = []

  // Extract memo
  const memoMatch = desc.match(/\[Memo:\s*([^\]]+)\]/)
  if (memoMatch) {
    memo = memoMatch[1].trim()
    desc = desc.replace(memoMatch[0], '').trim()
  }

  // Extract items
  const itemsMatch = desc.match(/\[Items:\s*([^\]]+)\]/)
  if (itemsMatch) {
    const rawItems = itemsMatch[1].split(',')
    for (const rawItem of rawItems) {
      const itemParts = rawItem.trim().match(/^(.+?)\s*\((?:[^0-9]*)([0-9.,]+)\)$/)
      if (itemParts) {
        const cleanPrice = itemParts[2].replace(/[.,]/g, '')
        items.push({ name: itemParts[1].trim(), price: cleanPrice })
      } else if (rawItem.trim()) {
        items.push({ name: rawItem.trim(), price: '' })
      }
    }
    desc = desc.replace(itemsMatch[0], '').trim()
  }

  return {
    baseDescription: desc,
    items,
    memo,
  }
}

export function TransactionForm({
  initialData,
  accounts,
  categories,
  onSuccess,
}: TransactionFormProps) {
  const router = useRouter()
  const { language, t } = useLanguage()
  const { queueDelete } = useUndo()
  const isEditing = !!initialData

  const parsed = parseTransactionDescription(initialData?.description)

  const [type, setType] = useState<TransactionType>(initialData?.type || 'expense')
  const [amountStr, setAmountStr] = useState<string>(
    initialData?.amount ? String(Math.round(Number(initialData.amount))) : '0'
  )
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    initialData?.account_id || (accounts[0]?.id ?? '')
  )
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    initialData?.category_id ||
      (categories.find((c) => c.type === (initialData?.type || 'expense'))?.id ?? categories[0]?.id ?? '')
  )
  const [description, setDescription] = useState<string>(parsed.baseDescription)
  const [txDate, setTxDate] = useState<string>(
    initialData?.transaction_date
      ? initialData.transaction_date.split('T')[0]
      : new Date().toISOString().split('T')[0]
  )
  const [isPinned, setIsPinned] = useState<boolean>(false)

  // Sub-items breakdown
  const [items, setItems] = useState<ItemRow[]>(parsed.items)
  const [showItemsBreakdown, setShowItemsBreakdown] = useState<boolean>(parsed.items.length > 0)

  // Free text memo
  const [freeTextMemo, setFreeTextMemo] = useState<string>(parsed.memo)
  const [showFreeMemo, setShowFreeMemo] = useState<boolean>(!!parsed.memo)

  // Popover controls
  const [isAccountPopoverOpen, setIsAccountPopoverOpen] = useState(false)
  const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0]
  const activeCategory = categories.find((c) => c.id === selectedCategoryId) || categories[0]
  const currentCurrency = activeAccount?.currency || 'IDR'

  const filteredCategories = categories.filter((c) => c.type === type)

  // Sub-items calculation
  const itemsTotal = items.reduce((sum, item) => {
    const p = parseFloat(item.price) || 0
    return sum + p
  }, 0)

  // Numeric amount
  const numericAmount = showItemsBreakdown && items.length > 0 ? itemsTotal : parseFloat(amountStr) || 0

  // Quick Keypad Press
  const handleKeypadPress = (val: string) => {
    if (showItemsBreakdown) return
    setError(null)
    if (amountStr === '0') {
      if (val === '000') return
      setAmountStr(val)
    } else {
      if (amountStr.length >= 12) return
      setAmountStr((prev) => prev + val)
    }
  }

  const handleKeypadBackspace = () => {
    if (showItemsBreakdown) return
    setError(null)
    if (amountStr.length <= 1) {
      setAmountStr('0')
    } else {
      setAmountStr((prev) => prev.slice(0, -1))
    }
  }

  // Type change
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType)
    const matchingCats = categories.filter((c) => c.type === newType)
    if (matchingCats.length > 0) {
      setSelectedCategoryId(matchingCats[0].id)
    }
  }

  // Sub-items CRUD
  const handleAddItem = () => {
    setItems((prev) => [...prev, { name: '', price: '' }])
  }

  const handleUpdateItem = (index: number, field: keyof ItemRow, value: string) => {
    setItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Save / Update Transaction
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (numericAmount <= 0) {
      setError(t.quickAdd.nominal + ' > 0')
      return
    }

    if (!selectedAccountId || !activeAccount) {
      setError(t.quickAdd.selectAccount)
      return
    }

    if (!selectedCategoryId) {
      setError(t.quickAdd.selectCategory)
      return
    }

    // Client-side Strict Non-Negative Balance Guard for Expense
    if (!isEditing && type === 'expense' && activeAccount) {
      const currentBal = Number(activeAccount.current_balance) || 0
      if (currentBal - numericAmount < 0) {
        const err =
          language === 'en'
            ? `Insufficient balance in ${activeAccount.name} (Available: ${formatCurrency(currentBal, activeAccount.currency)}, Required: ${formatCurrency(numericAmount, activeAccount.currency)})`
            : `Saldo ${activeAccount.name} tidak mencukupi (Tersedia: ${formatCurrency(currentBal, activeAccount.currency)}, Dibutuhkan: ${formatCurrency(numericAmount, activeAccount.currency)})`
        setError(err)
        toast.error(
          t.transactions.insufficientBalance ||
            (language === 'en' ? 'Insufficient Balance' : 'Saldo Tidak Mencukupi'),
          { description: err }
        )
        return
      }
    }

    setIsLoading(true)
    setError(null)

    // Build compound description if items or memo exist
    const defaultTypeLabel =
      type === 'expense'
        ? language === 'en'
          ? 'Expense'
          : 'Pengeluaran'
        : language === 'en'
          ? 'Income'
          : 'Pemasukan'
    let finalDesc = description.trim() || activeCategory?.name || defaultTypeLabel

    if (showItemsBreakdown && items.length > 0) {
      const validItems = items.filter((i) => i.name.trim() && parseFloat(i.price) > 0)
      if (validItems.length > 0) {
        const itemsSummary = validItems
          .map((i) => `${i.name.trim()} (${formatCurrency(parseFloat(i.price), currentCurrency)})`)
          .join(', ')
        finalDesc += ` [Items: ${itemsSummary}]`
      }
    }

    if (showFreeMemo && freeTextMemo.trim()) {
      finalDesc += ` [Memo: ${freeTextMemo.trim()}]`
    }

    try {
      const payload = {
        accountId: selectedAccountId,
        categoryId: selectedCategoryId,
        type,
        amount: numericAmount,
        currency: currentCurrency,
        description: finalDesc,
        transactionDate: `${txDate}T${new Date().toTimeString().split(' ')[0]}.000Z`,
      }

      if (isPinned) {
        savePinnedTemplate({
          name: description.trim() || activeCategory?.name || (type === 'expense' ? 'Pengeluaran' : 'Pemasukan'),
          accountId: selectedAccountId,
          accountName: activeAccount?.name,
          categoryId: selectedCategoryId,
          categoryName: activeCategory?.name,
          categoryIcon: activeCategory?.icon,
          type,
          amount: numericAmount,
          currency: currentCurrency,
          description: finalDesc,
        })
      }

      if (isEditing && initialData) {
        const res = await updateTransaction(initialData.id, payload)
        if (res.error) {
          setError(res.error)
          toast.error(
            t.transactions.updateFailed ||
              (language === 'en' ? 'Failed to Update Transaction' : 'Gagal Mengubah Transaksi'),
            { description: res.error }
          )
          return
        }
        toast.success(
          language === 'en' ? 'Transaction updated successfully' : 'Transaksi berhasil diperbarui'
        )
      } else {
        const res = await createTransaction(payload)
        if (res.error) {
          setError(res.error)
          toast.error(
            t.transactions.createFailed ||
              (language === 'en' ? 'Failed to Record Transaction' : 'Gagal Mencatat Transaksi'),
            { description: res.error }
          )
          return
        }
        toast.success(
          language === 'en' ? 'Transaction recorded successfully' : 'Transaksi berhasil dicatat'
        )
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/transactions')
      }
    } catch (err) {
      const msg = (err as Error).message
      setError(msg)
      toast.error(language === 'en' ? 'An error occurred' : 'Terjadi Kesalahan', {
        description: msg,
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Delete Transaction with Undo Snackbar
  const handleDelete = () => {
    if (!initialData) return
    setShowDeleteConfirm(false)
    router.push('/transactions')

    queueDelete({
      id: initialData.id,
      title: description || activeCategory?.name || (language === 'en' ? 'Transaction' : 'Transaksi'),
      onExecuteDelete: async () => {
        const res = await deleteTransaction(initialData.id)
        if (res?.error) {
          toast.error(
            t.transactions.deleteFailed ||
              (language === 'en' ? 'Failed to Delete Transaction' : 'Gagal Menghapus Transaksi'),
            { description: res.error }
          )
        } else {
          router.refresh()
        }
      },
      onUndo: () => {
        toast.success(t.undo.transactionRestored)
        router.refresh()
      },
    })
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-3 max-w-lg mx-auto w-full">
      {/* 1. Header: Segmented Type Switcher */}
      <div className="grid grid-cols-2 p-0.5 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-lg border border-[#E5E7EB] dark:border-[#27272A]">
        <button
          type="button"
          onClick={() => handleTypeChange('expense')}
          className={cn(
            'flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer',
            type === 'expense'
              ? 'bg-[#E11D48] text-white shadow-2xs'
              : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
          )}
        >
          <ArrowDownRight className="w-3.5 h-3.5" />
          <span>{t.quickAdd.expense}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange('income')}
          className={cn(
            'flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer',
            type === 'income'
              ? 'bg-[#0D9488] text-white shadow-2xs'
              : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
          )}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>{t.quickAdd.income}</span>
        </button>
      </div>

      {/* 2. Amount Display with Toggleable Pin Button on Top-Right */}
      <div className="flex flex-col items-center justify-center py-2.5 px-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] relative">
        <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {t.quickAdd.nominal} ({currentCurrency})
        </span>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[#0F172A] dark:text-[#F8FAFC] tnum">
            {formatCurrency(numericAmount, currentCurrency)}
          </span>
        </div>

        {/* Pin Toggle Button in Top-Right corner */}
        <button
          type="button"
          onClick={() => setIsPinned(!isPinned)}
          title={isPinned ? 'Sematkan aktif' : 'Sematkan transaksi ini'}
          className={cn(
            'absolute right-2.5 top-2.5 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1',
            isPinned
              ? 'bg-[#FEF3C7] dark:bg-[#78350F]/50 text-[#D97706] border border-[#FDE68A] dark:border-[#92400E] shadow-2xs'
              : 'text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20]'
          )}
        >
          <Pin className={cn('w-3.5 h-3.5', isPinned && 'fill-current')} />
          {isPinned && <span>Sematkan</span>}
        </button>
      </div>

      {/* 3. Date Picker */}
      <DatePicker value={txDate} onChange={setTxDate} />

      {/* 4. Account Popover */}
      <PopoverPrimitive.Root open={isAccountPopoverOpen} onOpenChange={setIsAccountPopoverOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors text-left cursor-pointer w-full"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <DynamicIcon
                name={activeAccount?.icon || 'Wallet'}
                className="w-4 h-4 text-[#0F172A] dark:text-[#FAFAFA] shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] uppercase font-bold text-[#64748B] dark:text-[#94A3B8] leading-none">
                  {t.quickAdd.account}
                </span>
                <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate mt-0.5">
                  {activeAccount?.name || t.quickAdd.selectAccount}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-mono text-[#94A3B8]">({currentCurrency})</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
            </div>
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            className="z-50 w-64 p-1 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-xl animate-in fade-in-0 zoom-in-95"
          >
            <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setSelectedAccountId(a.id)
                    setIsAccountPopoverOpen(false)
                  }}
                  className={cn(
                    'flex items-center justify-between p-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer',
                    a.id === selectedAccountId
                      ? 'bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A]'
                      : 'hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] text-[#0F172A] dark:text-[#F8FAFC]'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <DynamicIcon name={a.icon || 'Wallet'} className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{a.name}</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-80 shrink-0 ml-1">
                    {a.currency}
                  </span>
                </button>
              ))}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      {/* 5. Category Popover */}
      <PopoverPrimitive.Root open={isCategoryPopoverOpen} onOpenChange={setIsCategoryPopoverOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors text-left cursor-pointer w-full"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <DynamicIcon
                name={activeCategory?.icon || 'Tag'}
                className="w-4 h-4 text-[#0F172A] dark:text-[#FAFAFA] shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] uppercase font-bold text-[#64748B] dark:text-[#94A3B8] leading-none">
                  {t.quickAdd.category}
                </span>
                <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate mt-0.5">
                  {activeCategory?.name || t.quickAdd.selectCategory}
                </span>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            className="z-50 w-64 p-1 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-xl animate-in fade-in-0 zoom-in-95"
          >
            <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
              {filteredCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(c.id)
                    setIsCategoryPopoverOpen(false)
                  }}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer',
                    c.id === selectedCategoryId
                      ? 'bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A]'
                      : 'hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] text-[#0F172A] dark:text-[#F8FAFC]'
                  )}
                >
                  <DynamicIcon name={c.icon || 'Tag'} className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      {/* 6. Description Input with Action Buttons for (+ Rincian) & (+ Catatan) */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t.quickAdd.notePlaceholder}
          className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#FAFAFA]"
        />

        <button
          type="button"
          onClick={() => setShowItemsBreakdown(!showItemsBreakdown)}
          title={t.quickAdd.itemizedBreakdownTitle}
          className={cn(
            'p-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 flex items-center justify-center relative',
            showItemsBreakdown
              ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-[#FAFAFA] dark:text-[#0F172A]'
              : 'bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] border-[#E5E7EB] dark:border-[#27272A]'
          )}
        >
          <ListPlus className="w-4 h-4" />
          {items.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] text-[9px] font-bold flex items-center justify-center">
              {items.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowFreeMemo(!showFreeMemo)}
          title={t.quickAdd.memoTitle}
          className={cn(
            'p-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 flex items-center justify-center',
            showFreeMemo
              ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-[#FAFAFA] dark:text-[#0F172A]'
              : 'bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] border-[#E5E7EB] dark:border-[#27272A]'
          )}
        >
          <AlignLeft className="w-4 h-4" />
        </button>
      </div>

      {/* 7. Expandable Sub-items Breakdown Drawer */}
      {showItemsBreakdown && (
        <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] truncate">
              {t.quickAdd.itemizedBreakdownTitle}
            </span>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-[11px] font-bold text-[#0F172A] dark:text-[#FAFAFA] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.quickAdd.addItem}</span>
            </button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-3 text-xs text-[#94A3B8]">
              {t.quickAdd.emptyItems}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-0.5">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder={`Item ${idx + 1}`}
                    value={item.name}
                    onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8]"
                  />
                  <input
                    type="number"
                    placeholder="0"
                    value={item.price}
                    onChange={(e) => handleUpdateItem(idx, 'price', e.target.value)}
                    className="w-20 sm:w-24 px-2 py-1.5 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1.5 text-[#94A3B8] hover:text-[#E11D48] active:scale-90 transition-all cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. Expandable Free Text Memo Drawer */}
      {showFreeMemo && (
        <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
          <textarea
            rows={2}
            value={freeTextMemo}
            onChange={(e) => setFreeTextMemo(e.target.value)}
            placeholder={t.quickAdd.memoPlaceholder}
            className="w-full p-2 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none"
          />
        </div>
      )}

      {/* 9. Keypad */}
      <div className="grid grid-cols-4 gap-1.5 pt-1">
        {['1', '2', '3'].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleKeypadPress(n)}
            className="py-2.5 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-sm sm:text-base hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] cursor-pointer"
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={handleKeypadBackspace}
          className="py-2.5 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] flex items-center justify-center text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] border border-[#E5E7EB] dark:border-[#27272A] cursor-pointer"
        >
          <Delete className="w-4 h-4" />
        </button>

        {['4', '5', '6'].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleKeypadPress(n)}
            className="py-2.5 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-sm sm:text-base hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] cursor-pointer"
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleKeypadPress('000')}
          className="py-2.5 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-xs hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] cursor-pointer"
        >
          .000
        </button>

        {['7', '8', '9'].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleKeypadPress(n)}
            className="py-2.5 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-sm sm:text-base hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] cursor-pointer"
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleKeypadPress('0')}
          className="py-2.5 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-sm sm:text-base hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] cursor-pointer"
        >
          0
        </button>
      </div>

      {error && <p className="text-xs font-semibold text-[#E11D48] text-center">{error}</p>}

      {/* 10. Actions Bar: Save, Cancel, Delete */}
      <div className="flex items-center justify-between gap-2.5 mt-2 pt-3 border-t border-[#E5E7EB] dark:border-[#27272A]">
        {isEditing ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.common.delete}</span>
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] bg-[#F1F3F5] dark:bg-[#1A1A20] hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] border border-[#E5E7EB] dark:border-[#27272A] active:scale-95 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>{t.common.cancel}</span>
          </button>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isLoading ? t.common.loading : t.common.save}</span>
          </button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={t.transactions.deleteConfirmTitle}
        message={t.transactions.deleteConfirmMsg}
        confirmText={t.common.delete}
        variant="danger"
        isLoading={false}
      />
    </form>
  )
}
