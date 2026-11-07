import React, { Suspense } from 'react'
import { getAccounts } from '@/actions/accounts'
import { getLatestExchangeRate } from '@/actions/exchange-rate'
import { AccountsManager } from '@/components/accounts/accounts-manager'
import { AccountsSkeleton } from '@/components/accounts/accounts-skeleton'

export const dynamic = 'force-dynamic'

async function AccountsContent() {
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

export default function AccountsPage() {
  return (
    <Suspense fallback={<AccountsSkeleton />}>
      <AccountsContent />
    </Suspense>
  )
}
