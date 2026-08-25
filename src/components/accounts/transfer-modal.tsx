'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Account } from '@/types/database'
import { createTransfer } from '@/actions/transfers'
import { getLatestForexRates } from '@/actions/exchange-rate'
import { formatCurrency, getCrossRate, ForexRatesMap, DEFAULT_FALLBACK_RATES } from '@/lib/utils/currency'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowRightLeft, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface TransferModalProps {
  isOpen: boolean
  onClose: () => void
  accounts: Account[]
  defaultExchangeRate?: number
  onSuccess?: () => void
}

export function TransferModal({
  isOpen,
  onClose,
  accounts,
  onSuccess,
}: TransferModalProps) {
  const { t } = useLanguage()

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.transfer.modalTitle}
      maxWidth="md"
    >
      <TransferForm
        accounts={accounts}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Modal>
  )
}

interface TransferFormProps {
  accounts: Account[]
  onClose: () => void
  onSuccess?: () => void
}

function TransferForm({ accounts, onClose, onSuccess }: TransferFormProps) {
  const { language, t } = useLanguage()
  const [fromAccountId, setFromAccountId] = useState<string>(accounts[0]?.id || '')
  const [toAccountId, setToAccountId] = useState<string>(accounts[1]?.id || accounts[0]?.id || '')
  const [amount, setAmount] = useState<string>('')
  const [receivedAmount, setReceivedAmount] = useState<string>('')
  const [exchangeRate, setExchangeRate] = useState<string>('1')
  const [description, setDescription] = useState<string>('')
  const [transferDate, setTransferDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [rates, setRates] = useState<ForexRatesMap>(DEFAULT_FALLBACK_RATES)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isFetchingRates, setIsFetchingRates] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fromAccount = accounts.find((a) => a.id === fromAccountId) || accounts[0]
  const toAccount = accounts.find((a) => a.id === toAccountId) || accounts[1]
  const isCrossCurrency = fromAccount && toAccount && fromAccount.currency !== toAccount.currency

  // Fetch forex rates on mount
  useEffect(() => {
    let isMounted = true
    setIsFetchingRates(true)
    getLatestForexRates()
      .then((live) => {
        if (isMounted) setRates(live)
      })
      .finally(() => {
        if (isMounted) setIsFetchingRates(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  const recalculateAmounts = useCallback((fromId: string, toId: string, sentVal: string, curRates: ForexRatesMap) => {
    const fromA = accounts.find((a) => a.id === fromId)
    const toA = accounts.find((a) => a.id === toId)
    if (fromA && toA && fromA.currency !== toA.currency) {
      const calculatedRate = getCrossRate(fromA.currency, toA.currency, curRates)
      const formattedRate = calculatedRate < 1 ? calculatedRate.toFixed(6) : calculatedRate.toFixed(4)
      const numericRate = Number(formattedRate)
      setExchangeRate(String(numericRate))

      const numAmount = parseFloat(sentVal) || 0
      if (numAmount > 0) {
        const calculatedReceived = (numAmount * numericRate).toFixed(toA.currency === 'IDR' ? 0 : 2)
        setReceivedAmount(calculatedReceived)
      } else {
        setReceivedAmount('')
      }
    } else {
      setExchangeRate('1')
      setReceivedAmount(sentVal)
    }
  }, [accounts])

  const handleFromChange = (newFromId: string) => {
    setFromAccountId(newFromId)
    recalculateAmounts(newFromId, toAccountId, amount, rates)
  }

  const handleToChange = (newToId: string) => {
    setToAccountId(newToId)
    recalculateAmounts(fromAccountId, newToId, amount, rates)
  }

  const handleAmountChange = (val: string) => {
    setAmount(val)
    const numAmount = parseFloat(val) || 0
    const numRate = parseFloat(exchangeRate) || 1
    if (numAmount > 0) {
      const calculatedReceived = isCrossCurrency
        ? (numAmount * numRate).toFixed(toAccount?.currency === 'IDR' ? 0 : 2)
        : val
      setReceivedAmount(calculatedReceived)
    } else {
      setReceivedAmount('')
    }
  }

  const handleReceivedAmountChange = (val: string) => {
    setReceivedAmount(val)
    const numReceived = parseFloat(val) || 0
    const numAmount = parseFloat(amount) || 0

    if (numAmount > 0 && numReceived > 0) {
      const effectiveRate = numReceived / numAmount
      const formattedRate = effectiveRate < 1 ? effectiveRate.toFixed(6) : effectiveRate.toFixed(4)
      setExchangeRate(String(Number(formattedRate)))
    }
  }

  const handleExchangeRateChange = (val: string) => {
    setExchangeRate(val)
    const numRate = parseFloat(val) || 0
    const numAmount = parseFloat(amount) || 0

    if (numAmount > 0 && numRate > 0) {
      const calculatedReceived = (numAmount * numRate).toFixed(toAccount?.currency === 'IDR' ? 0 : 2)
      setReceivedAmount(calculatedReceived)
    }
  }

  const handleManualRateRefresh = async () => {
    setIsFetchingRates(true)
    try {
      const live = await getLatestForexRates()
      setRates(live)
      recalculateAmounts(fromAccountId, toAccountId, amount, live)
    } finally {
      setIsFetchingRates(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (fromAccountId === toAccountId) {
      const err = t.transfer.sameAccountError || 'Akun sumber dan tujuan tidak boleh sama'
      setError(err)
      toast.error(err)
      return
    }

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setError(t.transfer.amountLabel + ' > 0')
      return
    }

    if (fromAccount && Number(fromAccount.current_balance) < numAmount) {
      const err = language === 'en'
        ? `Insufficient balance in ${fromAccount.name} (Available: ${formatCurrency(fromAccount.current_balance, fromAccount.currency)}, Required: ${formatCurrency(numAmount, fromAccount.currency)})`
        : `Saldo ${fromAccount.name} tidak mencukupi (Tersedia: ${formatCurrency(fromAccount.current_balance, fromAccount.currency)}, Diperlukan: ${formatCurrency(numAmount, fromAccount.currency)})`
      setError(err)
      toast.error(t.transactions?.insufficientBalance || (language === 'en' ? 'Insufficient Balance' : 'Saldo Tidak Mencukupi'), { description: err })
      return
    }

    const numRate = isCrossCurrency ? parseFloat(exchangeRate) || 1 : 1

    setIsLoading(true)

    try {
      const res = await createTransfer({
        fromAccountId,
        toAccountId,
        amount: numAmount,
        exchangeRateUsed: numRate,
        description: description.trim() || null,
        transferDate: `${transferDate}T${new Date().toTimeString().split(' ')[0]}.000Z`,
      })

      if (res.error) {
        setError(res.error)
        toast.error(t.transfer.transferFailed || (language === 'en' ? 'Transfer Failed' : 'Gagal Transfer'), { description: res.error })
      } else {
        toast.success(
          isCrossCurrency
            ? (language === 'en' ? 'Currency exchange & transfer successful' : 'Tukar valas & transfer berhasil')
            : (language === 'en' ? 'Transfer completed successfully' : 'Transfer saldo berhasil')
        )
        onSuccess?.()
        onClose()
      }
    } catch (err) {
      const msg = (err as Error).message
      setError(msg)
      toast.error(language === 'en' ? 'An error occurred' : 'Terjadi Kesalahan', { description: msg })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      {/* Account Pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            {t.transfer.sourceLabel}
          </label>
          <Select value={fromAccountId} onValueChange={handleFromChange}>
            <SelectTrigger>
              <SelectValue placeholder={t.transfer.sourceLabel} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="truncate">{a.name}</span>
                    <span className="text-[10px] font-mono text-[#94A3B8] shrink-0">
                      ({formatCurrency(a.current_balance, a.currency)})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            {t.transfer.destLabel}
          </label>
          <Select value={toAccountId} onValueChange={handleToChange}>
            <SelectTrigger>
              <SelectValue placeholder={t.transfer.destLabel} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="truncate">{a.name}</span>
                    <span className="text-[10px] font-mono text-[#94A3B8] shrink-0">
                      ({formatCurrency(a.current_balance, a.currency)})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Amount Sent */}
      <Input
        label={`${t.transfer.amountLabel} (${fromAccount?.currency})`}
        type="number"
        step="any"
        placeholder="0"
        value={amount}
        onChange={(e) => handleAmountChange(e.target.value)}
        required
        autoFocus
        className="font-mono font-bold text-sm tnum"
        rightIcon={<span className="text-xs font-mono font-bold text-[#94A3B8]">{fromAccount?.currency}</span>}
      />

      {/* Cross-Currency Details */}
      {isCrossCurrency && (
        <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.transfer.conversionTitle}
            </span>
            <button
              type="button"
              onClick={handleManualRateRefresh}
              disabled={isFetchingRates}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-[#0F172A] dark:text-[#FAFAFA] hover:underline disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isFetchingRates ? 'animate-spin' : ''}`} />
              <span>{isFetchingRates ? 'Memperbarui...' : 'Sinkron Kurs Live'}</span>
            </button>
          </div>

          {/* Editable Received Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-[#E5E7EB] dark:border-[#27272A]">
            <Input
              label={`${t.transfer.receivedAmountLabel || (language === 'en' ? 'Received Amount' : 'Nominal Diterima')} (${toAccount?.currency})`}
              type="number"
              step="any"
              placeholder="0"
              value={receivedAmount}
              onChange={(e) => handleReceivedAmountChange(e.target.value)}
              required
              className="text-xs font-mono font-bold text-[#0D9488]"
            />

            <Input
              label={`${language === 'en' ? 'Exchange Rate' : 'Kurs'} (1 ${fromAccount?.currency} = ... ${toAccount?.currency})`}
              type="number"
              step="any"
              value={exchangeRate}
              onChange={(e) => handleExchangeRateChange(e.target.value)}
              className="text-xs font-mono"
            />
          </div>
        </div>
      )}

      {/* Date Picker */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {t.transfer.dateLabel}
        </label>
        <DatePicker value={transferDate} onChange={setTransferDate} />
      </div>

      {/* Description */}
      <Input
        label={t.transfer.noteLabel}
        type="text"
        placeholder={t.transfer.notePlaceholder}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {error && <p className="text-xs font-semibold text-[#E11D48]">{error}</p>}

      <div className="flex items-center gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
          {t.common.cancel}
        </Button>
        <Button type="submit" isLoading={isLoading} className="flex-1 font-bold">
          <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
          {t.transfer.executeBtn}
        </Button>
      </div>
    </form>
  )
}
