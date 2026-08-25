import React from 'react'
import { getDebts } from '@/actions/debts'
import { getAccounts } from '@/actions/accounts'
import { DebtsManager } from '@/components/debts/debts-manager'

export const dynamic = 'force-dynamic'

export default async function DebtsPage() {
  const [debts, accounts] = await Promise.all([
    getDebts('all', 'all'),
    getAccounts(),
  ])

  return (
    <div className="flex flex-col gap-4">
      <DebtsManager debts={debts} accounts={accounts} />
    </div>
  )
}
