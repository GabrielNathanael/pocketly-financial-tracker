'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Account, Category, EnrichedTransaction } from '@/types/database'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { deleteTransaction } from '@/actions/transactions'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatCurrency } from '@/lib/utils/currency'
import { savePinnedTemplate } from '@/lib/storage/pinned-templates'
import { useLanguage } from '@/lib/i18n/language-context'
import { formatCategoryName } from '@/lib/utils/category-i18n'
import { useUndo } from '@/lib/context/undo-context'
import { toast } from 'sonner'
import {
  ArrowLeft,
  History,
  Edit2,
  Trash2,
  Pin,
  Check,
  Calendar,
  Wallet,
  Tag,
  FileText,
  ListPlus,
  ArrowUpRight,
  ArrowDownRight,
  Hash,
} from 'lucide-react'
import { format } from 'date-fns'

interface TransactionDetailViewProps {
  transaction: EnrichedTransaction
  accounts: Account[]
  categories: Category[]
}

export function TransactionDetailView({
  transaction,
  accounts,
  categories,
}: TransactionDetailViewProps) {
  const router = useRouter()
  const { language, t } = useLanguage()
  const { queueDelete } = useUndo()
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isPinned, setIsPinned] = useState(false)

  const account = accounts.find((a) => a.id === transaction.account_id) || transaction.account
  const category = categories.find((c) => c.id === transaction.category_id) || transaction.category

  // Parse items and memo from description
  const rawDesc = transaction.description || ''
  let memoText = ''
  let itemsList: string[] = []

  const memoMatch = rawDesc.match(/\[Memo:\s*([^\]]+)\]/)
  if (memoMatch) {
    memoText = memoMatch[1].trim()
  }

  const itemsMatch = rawDesc.match(/\[Items:\s*([^\]]+)\]/)
  if (itemsMatch) {
    itemsList = itemsMatch[1].split(',').map((it) => it.trim()).filter(Boolean)
  }

  const cleanDescription = rawDesc
    .replace(/\[Memo:\s*[^\]]+\]/g, '')
    .replace(/\[Items:\s*[^\]]+\]/g, '')
    .replace(/\[Tukar Valas:\s*[^\]]+\]/g, '')
    .replace(/#[a-zA-Z0-9_\-]+/g, '')
    .trim()

  const allTags = Array.from(
    new Set([
      ...(transaction.tags || []),
      ...(rawDesc.match(/#[a-zA-Z0-9_\-]+/g)?.map((t) => t.replace(/^#/, '').toLowerCase()) || []),
    ])
  )

  const handlePin = () => {
    const name = cleanDescription || memoText || category?.name || 'Template'
    savePinnedTemplate({
      name,
      accountId: transaction.account_id,
      accountName: account?.name,
      categoryId: transaction.category_id,
      categoryName: category?.name,
      categoryIcon: category?.icon,
      type: transaction.type,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      description: transaction.description,
    })
    setIsPinned(true)
    setTimeout(() => setIsPinned(false), 3000)
  }

  const handleDelete = () => {
    setShowDeleteConfirm(false)
    router.push('/transactions')

    queueDelete({
      id: transaction.id,
      title: transaction.description || category?.name || (language === 'en' ? 'Transaction' : 'Transaksi'),
      onExecuteDelete: async () => {
        const res = await deleteTransaction(transaction.id)
        if (res?.error) {
          toast.error(t.transactions.deleteFailed, { description: res.error })
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

  if (isEditing) {
    return (
      <div className="flex flex-col gap-5 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.common.cancel}</span>
          </button>
        </div>

        <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4">
          <div>
            <h1 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              {t.transactions.editTitle}
            </h1>
            <span className="text-[10px] font-mono text-[#94A3B8]">ID: {transaction.id}</span>
          </div>

          <TransactionForm
            initialData={{ ...transaction, tags: allTags }}
            accounts={accounts}
            categories={categories}
            onSuccess={() => {
              setIsEditing(false)
              router.refresh()
            }}
          />
        </div>
      </div>
    )
  }

  const isExpense = transaction.type === 'expense'

  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/transactions"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.transactions.backToLedger}</span>
        </Link>

        <Link
          href={`/transactions/${transaction.id}/audit-log`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA] hover:underline"
        >
          <History className="w-3.5 h-3.5" />
          <span>{t.transactions.auditTrail}</span>
        </Link>
      </div>

      {/* Hero Detail Card */}
      <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs flex flex-col gap-4">
        {/* Amount & Type Header */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
            {isExpense ? t.quickAdd.expense : t.quickAdd.income}
          </span>
          <h1
            className={`text-3xl sm:text-4xl font-mono font-bold tracking-tight mt-0.5 tnum ${
              isExpense ? 'text-[#E11D48]' : 'text-[#0D9488]'
            }`}
          >
            {isExpense ? '-' : '+'}
            {formatCurrency(Number(transaction.amount), transaction.currency)}
          </h1>
        </div>

        {/* Info Items Stack (Account, Category, Date) */}
        <div className="flex flex-col gap-2.5 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A]">
          {/* Account */}
          <div className="p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
              <DynamicIcon name={account?.icon || 'Wallet'} className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                {t.common.account}
              </span>
              <span className="text-xs font-bold text-[#0F172A] dark:text-[#FAFAFA] truncate">
                {account?.name || 'Account'} ({transaction.currency})
              </span>
            </div>
          </div>

          {/* Category */}
          <div className="p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex items-center gap-3">
            <div
              className="w-8 h-8 rounded flex items-center justify-center shrink-0 text-white"
              style={{ backgroundColor: category?.color || '#3B82F6' }}
            >
              <DynamicIcon name={category?.icon || 'Tag'} className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                {t.common.category}
              </span>
              <span className="text-xs font-bold text-[#0F172A] dark:text-[#FAFAFA] truncate">
                {formatCategoryName(category?.name || 'Category', language)}
              </span>
            </div>
          </div>
        </div>

        {/* Date */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-xs">
          <Calendar className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] shrink-0" />
          <span className="font-medium text-[#0F172A] dark:text-[#FAFAFA]">
            {format(new Date(transaction.transaction_date), 'EEEE, dd MMMM yyyy')}
          </span>
        </div>

        {/* Notes / Description */}
        {cleanDescription && (
          <div className="flex flex-col gap-1 p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              <FileText className="w-3 h-3" />
              <span>{t.common.note}</span>
            </div>
            <p className="text-xs text-[#0F172A] dark:text-[#FAFAFA]">{cleanDescription}</p>
          </div>
        )}

        {/* Free Text Memo */}
        {memoText && (
          <div className="flex flex-col gap-1 p-3 rounded-lg bg-[#F0FDF4] dark:bg-[#052E16]/30 border border-[#BBF7D0] dark:border-[#166534]/40">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#15803D] dark:text-[#4ADE80]">
              <FileText className="w-3 h-3" />
              <span>{t.transactions.memoTitle || (language === 'en' ? 'Additional Notes (Memo)' : 'Catatan Tambahan (Memo)')}</span>
            </div>
            <p className="text-xs text-[#0F172A] dark:text-[#FAFAFA]">{memoText}</p>
          </div>
        )}

        {/* Tags (#tags) */}
        {allTags.length > 0 && (
          <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              <Hash className="w-3 h-3" />
              <span>{t.transactions.tagLabel}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {allTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs font-bold text-[#0F172A] dark:text-[#FAFAFA] shadow-2xs"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sub-items List Breakdown */}
        {itemsList.length > 0 && (
          <div className="flex flex-col gap-2 p-3.5 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              <ListPlus className="w-3.5 h-3.5" />
              <span>{language === 'en' ? `Item Breakdown (${itemsList.length})` : `Rincian Belanja (${itemsList.length})`}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {itemsList.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs"
                >
                  <span className="text-[#0F172A] dark:text-[#FAFAFA]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons: Pin, Edit, Delete */}
        <div className="flex items-center gap-2 pt-3 border-t border-[#E5E7EB] dark:border-[#27272A]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePin}
            className="gap-1.5 flex-1"
          >
            {isPinned ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#0D9488]" />
                <span>{language === 'en' ? 'Pinned' : 'Tersimpan'}</span>
              </>
            ) : (
              <>
                <Pin className="w-3.5 h-3.5" />
                <span>{language === 'en' ? 'Pin' : 'Sematkan'}</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="gap-1.5 flex-1"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{t.common.edit}</span>
          </Button>

          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="gap-1.5 px-3 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={t.transactions.deleteConfirmTitle}
        message={t.transactions.deleteConfirmMsg}
        isLoading={isDeleting}
      />
    </div>
  )
}
