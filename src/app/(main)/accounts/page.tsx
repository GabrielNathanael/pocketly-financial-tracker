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
      <AccountsManager accounts={accounts} exchangeRate={exchangeRate} />
    </div>
  )
}
