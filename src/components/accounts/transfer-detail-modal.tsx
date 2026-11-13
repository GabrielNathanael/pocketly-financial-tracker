'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AccountMutation } from '@/actions/accounts'
import { deleteTransfer } from '@/actions/transfers'
import { formatCurrency, formatNaturalForexRate } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowRightLeft, ArrowUpRight, ArrowDownRight, Calendar, FileText, CheckCircle2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface TransferDetailModalProps {
  isOpen: boolean
  onClose: () => void
  mutation: AccountMutation | null
  currentAccountName: string
  onSuccess?: () => void
}

export function TransferDetailModal({
  isOpen,
  onClose,
  mutation,
  currentAccountName,
  onSuccess,
}: TransferDetailModalProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  if (!isOpen || !mutation) return null

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await deleteTransfer(mutation.id)
      if (res?.error) {
        toast.error(t.transfer.deleteFailed, {
          description: res.error,
        })
      } else {
        toast.success(t.transfer.deleteSuccess)
        setShowDeleteConfirm(false)
        onClose()
        onSuccess?.()
        router.refresh()
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const isOutgoing = mutation.type === 'transfer_out'
  const counterparty = mutation.counterpartyOrCategory || t.transfer.unknownAccount
  const fromName = isOutgoing ? currentAccountName : counterparty
  const toName = isOutgoing ? counterparty : currentAccountName

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mutation.isCross ? t.transfer.forexDetailTitle : t.transfer.detailTitle}
      maxWidth="sm"
    >
      <div className="flex flex-col gap-4">
        {/* Hero Amount & Status */}
        <div className="p-4 rounded-xl bg-canvas dark:bg-surface-subtle border border-border flex flex-col items-center justify-center text-center gap-1.5">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success-muted text-success text-[10px] font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" />
            <span>{t.transfer.completed}</span>
          </div>
          <span className="text-2xl font-mono font-bold text-foreground tracking-tight tnum mt-1">
            {formatCurrency(mutation.amount, mutation.currency)}
          </span>
          <span className="text-xs text-foreground-secondary">
            {mutation.title}
          </span>
        </div>

        {/* Transfer Route Card */}
        <div className="p-3.5 rounded-xl bg-surface border border-border flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-destructive-muted text-destructive flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                  {t.transfer.sourceLabel}
                </span>
                <span className="text-xs font-bold text-foreground">
                  {fromName}
                </span>
              </div>
            </div>

            <ArrowRightLeft className="w-4 h-4 text-foreground-muted" />

            <div className="flex items-center gap-2 text-right">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                  {t.transfer.destLabel}
                </span>
                <span className="text-xs font-bold text-foreground">
                  {toName}
                </span>
              </div>
              <div className="w-7 h-7 rounded-lg bg-success-muted text-success flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Cross Currency Exchange Details */}
          {mutation.isCross && mutation.exchangeRateUsed && mutation.counterpartyCurrency && (
            <div className="pt-2.5 border-t border-border flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between text-foreground-secondary">
                <span>{t.transfer.exchangeRateDetailLabel}</span>
                <span className="font-mono font-bold text-foreground">
                  {formatNaturalForexRate(
                    mutation.type === 'transfer_out' ? mutation.currency : mutation.counterpartyCurrency,
                    mutation.type === 'transfer_out' ? mutation.counterpartyCurrency : mutation.currency,
                    mutation.exchangeRateUsed
                  ).formattedText}
                </span>
              </div>
              {mutation.receivedAmount && (
                <div className="flex items-center justify-between text-foreground-secondary">
                  <span>{t.transfer.receivedAmountLabel}</span>
                  <span className="font-mono font-bold text-success">
                    {formatCurrency(mutation.receivedAmount, mutation.counterpartyCurrency)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Metadata Details */}
        <div className="p-3.5 rounded-xl bg-surface border border-border flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between text-foreground-secondary">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{t.transfer.dateLabel}</span>
            </div>
            <span className="font-medium text-foreground">
              {formatDate(mutation.date, 'dd MMMM yyyy, HH:mm')}
            </span>
          </div>

          {mutation.description && (
            <div className="flex items-start justify-between gap-3 pt-2 border-t border-border text-foreground-secondary">
              <div className="flex items-center gap-1.5 shrink-0">
                <FileText className="w-3.5 h-3.5" />
                <span>{t.transfer.noteLabel}</span>
              </div>
              <span className="font-medium text-right text-foreground leading-relaxed break-all">
                {mutation.description}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="flex-1 cursor-pointer font-bold"
          >
            {t.common.close}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="flex-1 cursor-pointer font-bold gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.common.delete}</span>
          </Button>
        </div>
      </div>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title={t.transfer.deleteConfirmTitle}
        message={t.transfer.deleteConfirmMessage}
      />
    </Modal>
  )
}
