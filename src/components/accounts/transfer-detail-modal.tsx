'use client'

import React from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { AccountMutation } from '@/actions/accounts'
import { formatCurrency, formatNaturalForexRate } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowRightLeft, ArrowUpRight, ArrowDownRight, Calendar, FileText, CheckCircle2 } from 'lucide-react'

interface TransferDetailModalProps {
  isOpen: boolean
  onClose: () => void
  mutation: AccountMutation | null
  currentAccountName: string
}

export function TransferDetailModal({
  isOpen,
  onClose,
  mutation,
  currentAccountName,
}: TransferDetailModalProps) {
  const { t, language } = useLanguage()

  if (!isOpen || !mutation) return null

  const isOutgoing = mutation.type === 'transfer_out'
  const counterparty = mutation.counterpartyOrCategory || (language === 'en' ? 'Account' : 'Akun')
  const fromName = isOutgoing ? currentAccountName : counterparty
  const toName = isOutgoing ? counterparty : currentAccountName

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mutation.isCross ? (language === 'en' ? 'Forex Transfer Details' : 'Rincian Transfer Valas') : (language === 'en' ? 'Transfer Details' : 'Rincian Transfer')}
      maxWidth="sm"
    >
      <div className="flex flex-col gap-4">
        {/* Hero Amount & Status */}
        <div className="p-4 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col items-center justify-center text-center gap-1.5">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" />
            <span>{language === 'en' ? 'Completed' : 'Berhasil'}</span>
          </div>
          <span className="text-2xl font-mono font-bold text-[#0F172A] dark:text-[#FAFAFA] tracking-tight tnum mt-1">
            {formatCurrency(mutation.amount, mutation.currency)}
          </span>
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            {mutation.title}
          </span>
        </div>

        {/* Transfer Route Card */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                  {t.transfer.sourceLabel}
                </span>
                <span className="text-xs font-bold text-[#0F172A] dark:text-[#FAFAFA]">
                  {fromName}
                </span>
              </div>
            </div>

            <ArrowRightLeft className="w-4 h-4 text-[#94A3B8]" />

            <div className="flex items-center gap-2 text-right">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                  {t.transfer.destLabel}
                </span>
                <span className="text-xs font-bold text-[#0F172A] dark:text-[#FAFAFA]">
                  {toName}
                </span>
              </div>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Cross Currency Exchange Details */}
          {mutation.isCross && mutation.exchangeRateUsed && mutation.counterpartyCurrency && (
            <div className="pt-2.5 border-t border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8]">
                <span>{language === 'en' ? 'Exchange Rate' : 'Nilai Kurs'}</span>
                <span className="font-mono font-bold text-[#0F172A] dark:text-[#FAFAFA]">
                  {formatNaturalForexRate(
                    mutation.type === 'transfer_out' ? mutation.currency : mutation.counterpartyCurrency,
                    mutation.type === 'transfer_out' ? mutation.counterpartyCurrency : mutation.currency,
                    mutation.exchangeRateUsed
                  ).formattedText}
                </span>
              </div>
              {mutation.receivedAmount && (
                <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8]">
                  <span>{language === 'en' ? 'Received Amount' : 'Nominal Diterima'}</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(mutation.receivedAmount, mutation.counterpartyCurrency)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Metadata Details */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8]">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{t.transfer.dateLabel}</span>
            </div>
            <span className="font-medium text-[#0F172A] dark:text-[#FAFAFA]">
              {formatDate(mutation.date, 'dd MMMM yyyy, HH:mm')}
            </span>
          </div>

          {mutation.description && (
            <div className="flex items-start justify-between gap-3 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A] text-[#64748B] dark:text-[#94A3B8]">
              <div className="flex items-center gap-1.5 shrink-0">
                <FileText className="w-3.5 h-3.5" />
                <span>{t.transfer.noteLabel}</span>
              </div>
              <span className="font-medium text-right text-[#0F172A] dark:text-[#FAFAFA] leading-relaxed break-all">
                {mutation.description}
              </span>
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="w-full cursor-pointer font-bold"
        >
          {t.common.close}
        </Button>
      </div>
    </Modal>
  )
}
