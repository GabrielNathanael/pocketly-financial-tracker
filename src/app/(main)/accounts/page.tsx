import React from 'react'
import { getAccounts } from '@/actions/accounts'
import { getLatestExchangeRate } from '@/actions/exchange-rate'
import { AccountsManager } from '@/components/accounts/accounts-manager'

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const [accounts, exchangeRate] = await Promise.all([
    getAccounts(),
    getLatestExchangeRate('USD', 'IDR'),
  ])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
          Akun & Saldo Likuid
        </h1>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
          Rekening bank, dompet digital, uang tunai kas dan kartu kredit
        </p>
      </div>

      <AccountsManager accounts={accounts} exchangeRate={exchangeRate} />
    </div>
  )
}
