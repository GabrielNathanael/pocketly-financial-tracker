'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EnrichedDebtWithPayments, EnrichedDebtPayment } from '@/actions/debts'
import { Account } from '@/types/database'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DebtForm } from '@/components/debts/debt-form'
import { DebtPaymentModal } from '@/components/debts/debt-payment-modal'
import { DebtPaymentEditModal } from '@/components/debts/debt-payment-edit-modal'
import { deleteDebtPayment, deleteDebt } from '@/actions/debts'
import { useLanguage } from '@/lib/i18n/language-context'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Trash2,
  Calendar,
  Edit2,
  CheckCircle2,
  Clock,
  FileText,
  Pencil,
} from 'lucide-react'

interface DebtDetailViewProps {
  debt: EnrichedDebtWithPayments
  accounts: Account[]
}

export function DebtDetailView({ debt, accounts }: DebtDetailViewProps) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<EnrichedDebtPayment | null>(null)
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)
  const [showDeleteDebtConfirm, setShowDeleteDebtConfirm] = useState(false)
  const [deleteTransactions, setDeleteTransactions] = useState(false)
  const [displayLimit, setDisplayLimit] = useState(30)
  const [isDeletingDebt, setIsDeletingDebt] = useState(false)

  const isDebt = debt.type === 'debt'
  const isPaid = debt.status === 'paid' || Number(debt.remaining_amount) <= 0
  const progress =
    Number(debt.initial_amount) > 0
      ? ((Number(debt.initial_amount) - Number(debt.remaining_amount)) / Number(debt.initial_amount)) * 100
      : 100

  const totalPaid = Number(debt.initial_amount) - Number(debt.remaining_amount)

  const handleDeletePayment = async (paymentId: string) => {
    setDeletingPaymentId(paymentId)
    try {
      const res = await deleteDebtPayment(paymentId, debt.id)
      if (res?.error) {
        toast.error(t.debts.deletePaymentFailed, { description: res.error })
      } else {
        toast.success(t.debts.deletePaymentSuccess)
        router.refresh()
      }
    } catch (err) {
      const msg = (err as Error).message
      toast.error(t.common.error, { description: msg })
    } finally {
      setDeletingPaymentId(null)
    }
  }

  const handleDeleteDebt = async () => {
    setIsDeletingDebt(true)
    setShowDeleteDebtConfirm(false)
    try {
      const res = await deleteDebt(debt.id, { deleteTransactions })
      if (res?.error) {
        toast.error(t.debts.deleteDebtFailed, { description: res.error })
      } else {
        toast.success(t.debts.deleteDebtSuccess)
        router.push('/debts')
      }
    } catch (err) {
      const msg = (err as Error).message
      toast.error(t.common.error, { description: msg })
    } finally {
      setIsDeletingDebt(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5 max-w-xl mx-auto w-full px-0.5">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/debts"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.debts.backToDebts}</span>
        </Link>
      </div>

      {/* Main Debt Overview Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-surface border border-border flex flex-col gap-4 sm:gap-5 shadow-2xs">
        {/* Header with Type & Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-surface-subtle border border-border text-foreground flex items-center justify-center shrink-0">
              {isDebt ? (
                <ArrowDownRight className="w-5 h-5 text-destructive" />
              ) : (
                <ArrowUpRight className="w-5 h-5 text-success" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-foreground truncate">
                {debt.counterparty_name}
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                {isDebt ? t.debts.debtType : t.debts.receivableType}
              </span>
            </div>
          </div>

          <Badge variant={isPaid ? 'success' : isDebt ? 'danger' : 'info'} className="shrink-0">
            {isPaid ? t.debts.paidStatus : t.debts.activeStatus}
          </Badge>
        </div>

        {/* Progress Bar & Summary */}
        <div className="flex flex-col gap-1.5">
          <div className="w-full bg-surface-muted h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isPaid ? 'bg-success' : isDebt ? 'bg-destructive' : 'bg-info'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono text-muted-foreground">
            <span>{progress.toFixed(0)}% {t.debts.settledPct} ({formatCurrency(totalPaid, debt.currency)})</span>
            {debt.due_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {t.debts.dueOn} {formatDate(debt.due_date, 'd MMM yyyy', language)}
              </span>
            )}
          </div>
        </div>

        {/* Amount Stack */}
        <div className="flex flex-col gap-2.5 pt-2 sm:pt-3 border-t border-border font-mono tnum text-xs">
          <div className="p-3 sm:p-3.5 rounded-xl bg-surface-subtle border border-border">
            <span className="text-[10px] font-sans text-foreground-muted uppercase tracking-wider block">
              {t.debts.remainingTagihan}
            </span>
            <span
              className={`text-sm sm:text-base font-bold tracking-tight ${
                isPaid ? 'text-foreground-muted' : isDebt ? 'text-destructive' : 'text-success'
              }`}
            >
              {formatCurrency(debt.remaining_amount, debt.currency)}
            </span>
          </div>

          <div className="p-3 sm:p-3.5 rounded-xl bg-surface-subtle border border-border">
            <span className="text-[10px] font-sans text-foreground-muted uppercase tracking-wider block">
              {t.debts.principalLabel}
            </span>
            <span className="text-sm sm:text-base font-bold text-foreground tracking-tight">
              {formatCurrency(debt.initial_amount, debt.currency)}
            </span>
          </div>
        </div>

        {/* Terms Notes */}
        {debt.notes && (
          <div className="p-3 rounded-xl bg-surface-subtle border border-border text-xs text-foreground-secondary flex items-start gap-2.5">
            <FileText className="w-4 h-4 text-foreground-muted shrink-0 mt-0.5" />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
                {t.debts.termsLabel}
              </span>
              <span className="mt-0.5 leading-relaxed wrap-break-word">{debt.notes}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          {!isPaid && (
            <Button
              onClick={() => setIsPaymentOpen(true)}
              className="gap-1.5 flex-1 font-bold whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>{t.debts.recordPayment}</span>
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => setIsEditOpen(true)}
            className="gap-1.5 flex-1 whitespace-nowrap"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{t.common.edit}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDeleteTransactions(true)
              setShowDeleteDebtConfirm(true)
            }}
            className="px-3 shrink-0"
          >
            <span className="hidden sm:inline">{t.debts.deleteAndRollback}</span>
            <span className="sm:hidden">Rollback</span>
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setDeleteTransactions(false)
              setShowDeleteDebtConfirm(true)
            }}
            className="px-3 shrink-0"
            title={t.common.delete}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Payment Installments History */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
            {t.debts.installmentsTitle} ({debt.payments.length})
          </h2>
          {isPaid && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success">
              <CheckCircle2 className="w-3.5 h-3.5" /> Lunas Sepenuhnya
            </span>
          )}
        </div>

        {debt.payments.length === 0 ? (
          <div className="p-8 text-center bg-surface border border-border rounded-2xl text-foreground-muted text-xs">
            {t.debts.installmentsEmpty}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {debt.payments
              .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
              .slice(0, displayLimit)
              .map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-surface border border-border hover:border-border-strong transition-colors gap-3"
                >
                  {p.linked_transaction_id ? (
                    <Link
                      href={`/transactions/${p.linked_transaction_id}`}
                      className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80 transition-opacity cursor-pointer group"
                    >
                      <div className="w-7 h-7 rounded-full bg-success-muted text-success flex items-center justify-center text-xs font-bold shrink-0 group-hover:scale-105 transition-transform">
                        {debt.payments.length - idx}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm font-mono font-bold text-foreground tnum truncate group-hover:text-success transition-colors">
                          {formatCurrency(p.amount, debt.currency)}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] font-mono text-foreground-muted truncate">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{formatDate(p.payment_date, 'd MMM yyyy, HH:mm', language)}</span>
                          <span className="text-[9px] text-success underline ml-1 hidden sm:inline">Lihat Transaksi</span>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-full bg-success-muted text-success flex items-center justify-center text-xs font-bold shrink-0">
                        {debt.payments.length - idx}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm font-mono font-bold text-foreground tnum truncate">
                          {formatCurrency(p.amount, debt.currency)}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] font-mono text-foreground-muted truncate">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{formatDate(p.payment_date, 'd MMM yyyy, HH:mm', language)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions for installment: Edit & Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingPayment(p)}
                      className="h-auto w-auto p-1.5 text-foreground-muted hover:text-foreground rounded-md"
                      title={t.common.edit}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <button
                      type="button"
                      disabled={deletingPaymentId === p.id}
                      onClick={() => handleDeletePayment(p.id)}
                      className="p-1.5 text-foreground-muted hover:text-destructive rounded-md transition-colors cursor-pointer"
                      title={t.common.delete}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

            {/* Pagination Load More Controls */}
            {displayLimit < debt.payments.length && (
              <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-surface border border-border text-xs">
                <span className="text-muted-foreground font-medium text-center sm:text-left">
                  {t.common.showing} <span className="font-bold text-foreground">{Math.min(displayLimit, debt.payments.length)}</span> / {debt.payments.length}
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDisplayLimit((prev) => prev + 30)}
                    className="flex-1 sm:flex-initial text-xs font-bold cursor-pointer"
                  >
                    {t.common.loadMore} (+{Math.min(30, debt.payments.length - displayLimit)})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDisplayLimit(debt.payments.length)}
                    className="flex-1 sm:flex-initial text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {t.common.showAll}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Debt Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={t.debts.editModalTitle}
        maxWidth="md"
      >
        <DebtForm
          initialData={debt}
          onSuccess={() => {
            setIsEditOpen(false)
            router.refresh()
          }}
        />
      </Modal>

      {/* Payment Create Modal */}
      <DebtPaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        debt={debt}
        accounts={accounts}
        onSuccess={() => {
          setIsPaymentOpen(false)
          router.refresh()
        }}
      />

      {/* Payment Edit Modal */}
      <DebtPaymentEditModal
        isOpen={Boolean(editingPayment)}
        onClose={() => setEditingPayment(null)}
        payment={editingPayment}
        debt={debt}
        accounts={accounts}
        onSuccess={() => {
          setEditingPayment(null)
          router.refresh()
        }}
      />

      {/* Delete Debt Confirm Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDebtConfirm}
        onClose={() => setShowDeleteDebtConfirm(false)}
        onConfirm={handleDeleteDebt}
        title={t.debts.deleteConfirmTitle || 'Hapus Catatan Utang/Piutang'}
        message={deleteTransactions ? t.debts.deleteRollbackConfirmMsg : t.debts.deleteKeepConfirmMsg}
        isLoading={isDeletingDebt}
      />
    </div>
  )
}
