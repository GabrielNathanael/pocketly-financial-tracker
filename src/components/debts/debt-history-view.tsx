'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EnrichedDebtWithPayments, EnrichedDebtPayment, deleteDebtPayment } from '@/actions/debts'
import { Account } from '@/types/database'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { Button } from '@/components/ui/button'
import { DebtPaymentEditModal } from '@/components/debts/debt-payment-edit-modal'
import { useLanguage } from '@/lib/i18n/language-context'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Pencil,
  Trash2,
} from 'lucide-react'

interface DebtHistoryViewProps {
  debt: EnrichedDebtWithPayments
  accounts: Account[]
}

export function DebtHistoryView({ debt, accounts }: DebtHistoryViewProps) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [displayLimit, setDisplayLimit] = useState(30)
  const [editingPayment, setEditingPayment] = useState<EnrichedDebtPayment | null>(null)
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)

  const isDebt = debt.type === 'debt'
  const isPaid = debt.status === 'paid' || Number(debt.remaining_amount) <= 0

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

  const sortedPayments = [...debt.payments].sort(
    (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
  )

  return (
    <div className="flex flex-col gap-4 sm:gap-5 max-w-xl mx-auto w-full px-0.5">
      {/* Back to detail */}
      <Link
        href={`/debts/${debt.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{t.common.back}</span>
      </Link>

      {/* History header */}
      <div className="flex items-center justify-between gap-3 px-0.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center shrink-0">
            {isDebt ? (
              <ArrowDownRight className="w-4 h-4 text-destructive" />
            ) : (
              <ArrowUpRight className="w-4 h-4 text-success" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-foreground truncate">
              {t.debts.installmentsTitle}
            </h1>
            <span className="text-[10px] text-muted-foreground truncate">
              {debt.counterparty_name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono text-muted-foreground">{sortedPayments.length}</span>
          {isPaid && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t.debts.paidStatus}
            </span>
          )}
        </div>
      </div>

      {/* Payment installments list */}
      {sortedPayments.length === 0 ? (
        <div className="p-8 text-center bg-surface border border-border rounded-2xl text-foreground-muted text-xs">
          {t.debts.installmentsEmpty}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sortedPayments.slice(0, displayLimit).map((p, idx) => (
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
                    {sortedPayments.length - idx}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs sm:text-sm font-mono font-bold text-foreground tnum truncate group-hover:text-success transition-colors">
                      {formatCurrency(p.amount, debt.currency)}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] font-mono text-foreground-muted truncate">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{formatDate(p.payment_date, 'd MMM yyyy, HH:mm', language)}</span>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-full bg-success-muted text-success flex items-center justify-center text-xs font-bold shrink-0">
                    {sortedPayments.length - idx}
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

              {/* Edit / delete installment */}
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

          {/* Pagination */}
          {displayLimit < sortedPayments.length && (
            <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-surface border border-border text-xs">
              <span className="text-muted-foreground font-medium text-center sm:text-left">
                {t.common.showing} <span className="font-bold text-foreground">{Math.min(displayLimit, sortedPayments.length)}</span> / {sortedPayments.length}
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisplayLimit((prev) => prev + 30)}
                  className="flex-1 sm:flex-initial text-xs font-bold cursor-pointer"
                >
                  {t.common.loadMore} (+{Math.min(30, sortedPayments.length - displayLimit)})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDisplayLimit(sortedPayments.length)}
                  className="flex-1 sm:flex-initial text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {t.common.showAll}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

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
    </div>
  )
}
