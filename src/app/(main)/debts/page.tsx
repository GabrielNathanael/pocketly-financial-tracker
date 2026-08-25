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
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
          Utang & Piutang
        </h1>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
          Pantau kewajiban utang, piutang yang dipinjamkan, dan riwayat cicilan
        </p>
      </div>

      <DebtsManager debts={debts} accounts={accounts} />
    </div>
  )
}
