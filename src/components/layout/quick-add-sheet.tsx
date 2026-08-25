'use client'

import React, { useState } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { Account, Category, TransactionType } from '@/types/database'
import { formatCurrency } from '@/lib/utils/currency'
import { createTransaction } from '@/actions/transactions'
import { useLanguage } from '@/lib/i18n/language-context'
import { getPinnedTemplates, savePinnedTemplate, PinnedTemplate } from '@/lib/storage/pinned-templates'
import { getDefaultAccountId } from '@/lib/storage/default-account'
import {
  Check,
  Delete,
  ArrowDownRight,
  ArrowUpRight,
  Pin,
  Star,
  Plus,
  Trash2,
  ListPlus,
  ChevronDown,
  AlignLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'

interface QuickAddSheetProps {
  isOpen: boolean
  onClose: () => void
  accounts: Account[]
  categories: Category[]
  onSuccess?: () => void
}

interface ItemRow {
  name: string
  price: string
}

export function QuickAddSheet({
  isOpen,
  onClose,
  accounts,
  categories,
  onSuccess,
}: QuickAddSheetProps) {
  const { t } = useLanguage()

  if (!isOpen) return null

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t.quickAdd.title}>
      <QuickAddSheetContent
        accounts={accounts}
        categories={categories}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </BottomSheet>
  )
}

interface QuickAddSheetContentProps {
  accounts: Account[]
  categories: Category[]
  onClose: () => void
  onSuccess?: () => void
}

function QuickAddSheetContent({
  accounts,
  categories,
  onClose,
  onSuccess,
}: QuickAddSheetContentProps) {
  const { language, t } = useLanguage()
  const defaultAccId = typeof window !== 'undefined' ? getDefaultAccountId() : null
  const initialAccountId =
    defaultAccId && accounts.some((a) => a.id === defaultAccId) ? defaultAccId : accounts[0]?.id || ''
  const defaultCats = categories.filter((c) => c.type === 'expense')
  const initialCategoryId = defaultCats[0]?.id || categories[0]?.id || ''

  const [type, setType] = useState<TransactionType>('expense')
  const [amountStr, setAmountStr] = useState<string>('0')
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCategoryId)
  const [description, setDescription] = useState<string>('')
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [isPinned, setIsPinned] = useState<boolean>(false)

  // Sub-items list
  const [items, setItems] = useState<ItemRow[]>([])
  const [showItemsBreakdown, setShowItemsBreakdown] = useState<boolean>(false)

  // Free text memo
  const [freeTextMemo, setFreeTextMemo] = useState<string>('')
  const [showFreeMemo, setShowFreeMemo] = useState<boolean>(false)

  // Popover controls
  const [isAccountPopoverOpen, setIsAccountPopoverOpen] = useState(false)
  const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = useState(false)

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [pinnedTemplates, setPinnedTemplates] = useState<PinnedTemplate[]>(getPinnedTemplates)

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

  // Quick Calculator Keypad
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

  const handleApplyTemplate = (tpl: PinnedTemplate) => {
    setType(tpl.type)
    setSelectedAccountId(tpl.accountId)
    setSelectedCategoryId(tpl.categoryId)
    setAmountStr(String(tpl.amount))
    setDescription(tpl.description || tpl.name)
    setTxDate(new Date().toISOString().split('T')[0])
    setIsPinned(true)
  }

  // Save Transaction
  const handleSave = async () => {
    if (numericAmount <= 0) {
      setError(t.quickAdd.nominal + ' > 0')
      return
    }

    if (!selectedAccountId) {
      setError(t.quickAdd.selectAccount)
      return
    }

    if (!selectedCategoryId) {
      setError(t.quickAdd.selectCategory)
      return
    }

    // Strict Non-Negative Balance Guard for Expense
    if (type === 'expense' && activeAccount) {
      const currentBal = Number(activeAccount.current_balance) || 0
      if (currentBal - numericAmount < 0) {
        const err = language === 'en'
          ? `Insufficient balance in ${activeAccount.name} (Available: ${formatCurrency(currentBal, activeAccount.currency)}, Required: ${formatCurrency(numericAmount, activeAccount.currency)})`
          : `Saldo ${activeAccount.name} tidak mencukupi (Tersedia: ${formatCurrency(currentBal, activeAccount.currency)}, Dibutuhkan: ${formatCurrency(numericAmount, activeAccount.currency)})`
        setError(err)
        toast.error(t.transactions.insufficientBalance || (language === 'en' ? 'Insufficient Balance' : 'Saldo Tidak Mencukupi'), { description: err })
        return
      }
    }

    setIsLoading(true)
    setError(null)

    // Build compound description if items or memo exist
    const defaultTypeLabel = type === 'expense'
      ? (language === 'en' ? 'Expense' : 'Pengeluaran')
      : (language === 'en' ? 'Income' : 'Pemasukan')
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
      const res = await createTransaction({
        accountId: selectedAccountId,
        categoryId: selectedCategoryId,
        type,
        amount: numericAmount,
        currency: currentCurrency,
        description: finalDesc,
        transactionDate: `${txDate}T${new Date().toTimeString().split(' ')[0]}.000Z`,
      })

      if (res.error) {
        setError(res.error)
        toast.error(t.transactions.createFailed || (language === 'en' ? 'Failed to Record Transaction' : 'Gagal Mencatat Transaksi'), { description: res.error })
      } else {
        toast.success(language === 'en' ? 'Transaction recorded successfully' : 'Transaksi berhasil dicatat')
        // Save as pinned template if toggle is active
        if (isPinned) {
          const name = description.trim() || activeCategory?.name || 'Quick Template'
          savePinnedTemplate({
            name,
            accountId: selectedAccountId,
            accountName: activeAccount?.name,
            categoryId: selectedCategoryId,
            categoryName: activeCategory?.name,
            categoryIcon: activeCategory?.icon,
            type,
            amount: numericAmount,
            currency: currentCurrency,
            description: description.trim() || null,
          })
        }

        onSuccess?.()
        onClose()
      }
    } catch (err) {
      const msg = (err as Error).message
      setError(msg)
      toast.error('Terjadi Kesalahan', { description: msg })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Pinned Templates Shortcuts */}
      {pinnedTemplates.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar scroll-smooth">
          <Star className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
          {pinnedTemplates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleApplyTemplate(tpl)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F1F3F5] dark:bg-[#1A1A20] hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#FAFAFA] border border-[#E5E7EB] dark:border-[#27272A] shrink-0 cursor-pointer active:scale-95 transition-all"
            >
              <span className="whitespace-nowrap font-medium">{tpl.name}</span>
              <span className="font-mono font-bold text-[11px] tnum opacity-90">
                {formatCurrency(tpl.amount, tpl.currency)}
              </span>
            </button>
          ))}
        </div>
      )}

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
      <div className="flex flex-col items-center justify-center py-2 px-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] relative">
        <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {t.quickAdd.nominal} ({currentCurrency})
        </span>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[#0F172A] dark:text-[#F8FAFC] tnum">
            {formatCurrency(numericAmount, currentCurrency)}
          </span>
        </div>

        {/* Pin Toggle Button located in the top-right corner of Amount display */}
        <button
          type="button"
          onClick={() => setIsPinned(!isPinned)}
          title={isPinned ? 'Sematkan aktif (akan tersimpan ke transaksi cepat saat disimpan)' : 'Sematkan transaksi ini saat disimpan'}
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

      {/* 3. Date Picker (Placed above Account & Category) */}
      <DatePicker value={txDate} onChange={setTxDate} />

      {/* 4. Account Popover */}
      <PopoverPrimitive.Root open={isAccountPopoverOpen} onOpenChange={setIsAccountPopoverOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors text-left cursor-pointer w-full"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <DynamicIcon name={activeAccount?.icon || 'Wallet'} className="w-4 h-4 text-[#0F172A] dark:text-[#FAFAFA] shrink-0" />
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
              <DynamicIcon name={activeCategory?.icon || 'Tag'} className="w-4 h-4 text-[#0F172A] dark:text-[#FAFAFA] shrink-0" />
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

      {/* 6. Description Input with Compact Side Action Buttons for (+ Rincian) & (+ Catatan) */}
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

      {/* 9. Precision 4-Column Tactical Keypad */}
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
          className="py-2.5 rounded-lg bg-[#E2E8F0] dark:bg-[#27272A] flex items-center justify-center hover:bg-[#CBD5E1] dark:hover:bg-[#334155] text-[#0F172A] dark:text-[#F8FAFC] border border-[#CBD5E1] dark:border-[#334155] cursor-pointer"
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
          className="py-2.5 rounded-lg bg-[#E2E8F0] dark:bg-[#27272A] font-mono font-bold text-xs sm:text-sm hover:bg-[#CBD5E1] dark:hover:bg-[#334155] text-[#0F172A] dark:text-[#F8FAFC] border border-[#CBD5E1] dark:border-[#334155] cursor-pointer"
        >
          +000
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
          onClick={() => setAmountStr('0')}
          className="py-2.5 rounded-lg bg-[#E2E8F0] dark:bg-[#27272A] font-mono font-bold text-xs hover:bg-[#CBD5E1] dark:hover:bg-[#334155] text-[#0F172A] dark:text-[#F8FAFC] border border-[#CBD5E1] dark:border-[#334155] cursor-pointer"
        >
          C
        </button>

        <button
          type="button"
          onClick={() => handleKeypadPress('0')}
          className="col-span-2 py-2.5 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-sm sm:text-base hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] cursor-pointer"
        >
          0
        </button>

        <Button
          type="button"
          onClick={handleSave}
          isLoading={isLoading}
          disabled={numericAmount <= 0}
          className="col-span-2 py-2.5 h-auto font-bold text-xs rounded-lg"
        >
          <Check className="w-3.5 h-3.5 mr-1" />
          {t.quickAdd.recordBtn}
        </Button>
      </div>

      {error && (
        <p className="text-xs font-semibold text-[#E11D48] text-center">{error}</p>
      )}
    </div>
  )
}
