'use client'

import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Debt, Account } from '@/types/database'
import { addDebtPayment } from '@/actions/debts'
import { formatCurrency } from '@/lib/utils/currency'
import { useLanguage } from '@/lib/i18n/language-context'
import { getDefaultAccountId } from '@/lib/storage/default-account'
import { Wallet } from 'lucide-react'

interface DebtPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  debt: Debt | null
  accounts: Account[]
  onSuccess?: () => void
}

export function DebtPaymentModal({
  isOpen,
  onClose,
  debt,
  accounts,
  onSuccess,
}: DebtPaymentModalProps) {
  const { t } = useLanguage()

  const [amount, setAmount] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-select default account whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const savedDefaultId = getDefaultAccountId()
      const initialAcc = accounts.find((a) => a.id === savedDefaultId) || accounts[0]
      if (initialAcc) {
        setSelectedAccountId(initialAcc.id)
      }
    }
  }, [isOpen, accounts])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!debt) return

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
      const res = await addDebtPayment({
        debtId: debt.id,
        amount: numericAmount,
        paymentDate: `${paymentDate}T${new Date().toTimeString().split(' ')[0]}.000Z`,
        accountId: selectedAccountId,
      })

      if (res.error) {
        setError(res.error)
      } else {
        setAmount('')
        onSuccess?.()
        onClose()
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const savedDefaultId = typeof window !== 'undefined' ? getDefaultAccountId() : null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t.debts.paymentModalTitle}: ${debt?.counterparty_name || ''}`}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between text-xs font-mono">
          <span className="font-sans text-[#64748B] dark:text-[#94A3B8]">{t.debts.remainingTagihan}:</span>
          <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] tnum">
            {formatCurrency(debt?.remaining_amount, debt?.currency)}
          </span>
        </div>

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
          rightIcon={<span className="text-xs font-mono font-bold text-[#94A3B8]">{debt?.currency}</span>}
        />

        {/* Payment Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            {t.debts.paymentDate}
          </label>
          <DatePicker value={paymentDate} onChange={setPaymentDate} />
        </div>

        {/* Rekening Transaksi (Mandatory) */}
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
            {debt?.type === 'debt'
              ? 'Saldo rekening yang dipilih akan otomatis berkurang sesuai nominal pembayaran ini.'
              : 'Saldo rekening yang dipilih akan otomatis bertambah sesuai penerimaan pembayaran ini.'}
          </p>
        </div>

        {error && <p className="text-xs font-semibold text-[#E11D48]">{error}</p>}

        <div className="flex items-center gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            {t.common.cancel}
          </Button>
          <Button type="submit" isLoading={isLoading} className="flex-1 font-bold">
            {t.debts.savePayment}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
