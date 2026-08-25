'use client'

import React, { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Debt, Account } from '@/types/database'
import { EnrichedDebtPayment, updateDebtPayment } from '@/actions/debts'
import { useLanguage } from '@/lib/i18n/language-context'
import { getDefaultAccountId } from '@/lib/storage/default-account'
import { Wallet } from 'lucide-react'

interface DebtPaymentEditModalProps {
  isOpen: boolean
  onClose: () => void
  payment: EnrichedDebtPayment | null
  debt: Debt | null
  accounts: Account[]
  onSuccess?: () => void
}

export function DebtPaymentEditModal({
  isOpen,
  onClose,
  payment,
  debt,
  accounts,
  onSuccess,
}: DebtPaymentEditModalProps) {
  const { t } = useLanguage()

  if (!isOpen || !payment || !debt) {
    return null
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.debts.editPaymentModalTitle || 'Ubah Cicilan'}
      maxWidth="sm"
    >
      <DebtPaymentEditForm
        key={payment.id}
        payment={payment}
        debt={debt}
        accounts={accounts}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Modal>
  )
}

interface DebtPaymentEditFormProps {
  payment: EnrichedDebtPayment
  debt: Debt
  accounts: Account[]
  onClose: () => void
  onSuccess?: () => void
}

function DebtPaymentEditForm({
  payment,
  debt,
  accounts,
  onClose,
  onSuccess,
}: DebtPaymentEditFormProps) {
  const { t } = useLanguage()
  const savedDefaultId = typeof window !== 'undefined' ? getDefaultAccountId() : null

  const initialAccountId =
    payment.transaction?.account_id ||
    (payment.linked_transaction_id ? savedDefaultId || accounts[0]?.id || '' : savedDefaultId || accounts[0]?.id || '')

  const [amount, setAmount] = useState<string>(String(payment.amount))
  const [paymentDate, setPaymentDate] = useState<string>(
    payment.payment_date ? payment.payment_date.split('T')[0] : new Date().toISOString().split('T')[0]
  )
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccountId)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const numericAmount = parseFloat(amount)
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError(t.debts.paymentAmount + ' > 0')
      return
    }

    if (!selectedAccountId) {
      setError('Pilih rekening transaksi')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await updateDebtPayment({
        paymentId: payment.id,
        debtId: debt.id,
        amount: numericAmount,
        paymentDate: `${paymentDate}T${new Date().toTimeString().split(' ')[0]}.000Z`,
        accountId: selectedAccountId,
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <Input
        label={t.debts.paymentAmount}
        type="number"
        step="any"
        placeholder="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        autoFocus
        className="font-mono font-bold text-sm tnum"
        rightIcon={<span className="text-xs font-mono font-bold text-[#94A3B8]">{debt.currency}</span>}
      />

      {/* Payment Date */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {t.debts.paymentDate}
        </label>
        <DatePicker value={paymentDate} onChange={setPaymentDate} />
      </div>

      {/* Rekening Transaksi (Mandatory - No Checkbox) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {t.debts.selectLinkedAccount}
        </label>
        <Select
          value={selectedAccountId}
          onValueChange={setSelectedAccountId}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t.debts.selectLinkedAccount} />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => {
              const isDef = a.id === savedDefaultId
              return (
                <SelectItem key={a.id} value={a.id}>
                  <div className="flex items-center gap-2">
                    <Wallet className="w-3.5 h-3.5 text-[#94A3B8]" />
                    <span>{a.name}</span>
                    <span className="text-[10px] font-mono text-[#94A3B8]">({a.currency})</span>
                    {isDef && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A]">
                        Default
                      </span>
                    )}
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
          {debt.type === 'debt'
            ? 'Saldo rekening yang dipilih akan otomatis disinkronkan ke mutasi saldo akun ini.'
            : 'Saldo rekening yang dipilih akan otomatis bertambah sesuai penerimaan pembayaran ini.'}
        </p>
      </div>

      {error && <p className="text-xs font-semibold text-[#E11D48]">{error}</p>}

      <div className="flex items-center gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
          {t.common.cancel}
        </Button>
        <Button type="submit" isLoading={isLoading} className="flex-1 font-bold">
          {t.debts.updatePayment || 'Simpan'}
        </Button>
      </div>
    </form>
  )
}
