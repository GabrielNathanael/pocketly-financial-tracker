'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Account, AccountType, CurrencyCode } from '@/types/database'
import { createAccount, updateAccount, deleteAccount } from '@/actions/accounts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AVAILABLE_ICONS } from '@/lib/constants/default-categories'
import { CURRENCY_LIST } from '@/lib/constants/currencies'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { getDefaultAccountId, setDefaultAccountId } from '@/lib/storage/default-account'
import { useLanguage } from '@/lib/i18n/language-context'
import { toast } from 'sonner'
import { Trash2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface AccountFormProps {
  initialData?: Account | null
  onSuccess?: () => void
}

export function AccountForm({ initialData, onSuccess }: AccountFormProps) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const isEditing = !!initialData

  const [name, setName] = useState(initialData?.name || '')
  const [type, setType] = useState<AccountType>(initialData?.type || 'bank')
  const [currency, setCurrency] = useState<CurrencyCode>(initialData?.currency || 'IDR')
  const [initialBalance, setInitialBalance] = useState<string>(
    initialData?.initial_balance !== undefined ? String(initialData.initial_balance) : '0'
  )
  const [icon, setIcon] = useState<string>(initialData?.icon || 'Wallet')
  const [isDefault, setIsDefault] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return initialData ? getDefaultAccountId() === initialData.id : false
  })

  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError(t.accounts.nameLabel + ' is required')
      return
    }

    const numericInit = parseFloat(initialBalance) || 0

    setIsLoading(true)
    setError(null)

    try {
      if (isEditing && initialData) {
        const res = await updateAccount(initialData.id, {
          name,
          type,
          currency,
          initialBalance: numericInit,
          icon,
        })
        if (res.error) {
          setError(res.error)
          return
        }
        if (isDefault) {
          setDefaultAccountId(initialData.id)
        } else if (getDefaultAccountId() === initialData.id) {
          setDefaultAccountId(null)
        }
      } else {
        const res = await createAccount({
          name,
          type,
          currency,
          initialBalance: numericInit,
          icon,
        })
        if (res.error) {
          setError(res.error)
          return
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const createdId = (res.data as any)?.id
        if (isDefault && createdId) {
          setDefaultAccountId(createdId)
        }
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/accounts')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!initialData) return
    setIsDeleting(true)
    setShowDeleteConfirm(false)
    setError(null)

    try {
      const res = await deleteAccount(initialData.id)
      if (res.error) {
        setError(res.error)
      } else {
        if (getDefaultAccountId() === initialData.id) {
          setDefaultAccountId(null)
        }
        toast.success(
          language === 'en' ? 'Account deleted successfully' : 'Akun berhasil dihapus'
        )
        if (onSuccess) {
          onSuccess()
        } else {
          router.push('/accounts')
        }
      }
    } catch (err) {
      const msg = (err as Error).message
      setError(msg)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}
      <Input
        label={t.accounts.nameLabel}
        type="text"
        placeholder={t.accounts.namePlaceholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <div className="grid grid-cols-2 gap-2.5">
        {/* Type */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            {t.accounts.typeLabel}
          </label>
          <Select value={type} onValueChange={(val) => setType(val as AccountType)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank">{t.accounts.types.bank}</SelectItem>
              <SelectItem value="cash">{t.accounts.types.cash}</SelectItem>
              <SelectItem value="ewallet">{t.accounts.types.ewallet}</SelectItem>
              <SelectItem value="credit_card">{t.accounts.types.credit_card}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Currency */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            {t.accounts.currencyLabel}
          </label>
          <Select value={currency} onValueChange={(val) => setCurrency(val as CurrencyCode)}>
            <SelectTrigger className="w-full">
              <SelectValue>{currency}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_LIST.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} - {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!isEditing && (
        <Input
          label={t.accounts.initialBalanceLabel}
          type="number"
          step="any"
          placeholder="0"
          value={initialBalance}
          onChange={(e) => setInitialBalance(e.target.value)}
          className="font-mono font-bold text-sm tnum"
          rightIcon={<span className="text-xs font-mono font-bold text-[#94A3B8]">{currency}</span>}
        />
      )}

      {/* Default Account Checkbox Toggle */}
      <label className="flex items-center gap-2.5 p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] cursor-pointer">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="w-4 h-4 rounded border-[#CBD5E1] text-[#0F172A] focus:ring-0 cursor-pointer"
        />
        <span className="text-xs font-bold text-[#0F172A] dark:text-[#FAFAFA]">
          {t.accounts.defaultAccountCheck}
        </span>
      </label>

      {/* Icon Picker */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {t.accounts.iconLabel}
        </label>
        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-36 overflow-y-auto p-0.5 no-scrollbar">
          {AVAILABLE_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => setIcon(ic)}
              className={cn(
                'p-2 rounded-lg border flex items-center justify-center transition-colors cursor-pointer',
                icon === ic
                  ? 'border-[#0F172A] bg-[#0F172A] text-white dark:border-[#FAFAFA] dark:bg-[#FAFAFA] dark:text-[#0F172A]'
                  : 'border-[#E5E7EB] dark:border-[#27272A] bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F3F5] dark:hover:bg-[#26262E]'
              )}
            >
              <DynamicIcon name={ic} className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs font-semibold text-[#E11D48]">{error}</p>}

      <div className="flex items-center gap-2 pt-2">
        {isEditing && (
          <Button
            type="button"
            variant="danger"
            onClick={() => setShowDeleteConfirm(true)}
            className="px-3"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
        <Button type="submit" isLoading={isLoading} className="flex-1">
          {isEditing ? t.accounts.saveAccount : t.accounts.createAccount}
        </Button>
      </div>

      {isEditing && (
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          isLoading={isDeleting}
          title={t.accounts.deleteConfirmTitle}
          message={t.accounts.deleteConfirmMsg}
        />
      )}
    </form>
  )
}
