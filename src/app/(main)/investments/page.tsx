import React from 'react'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAccounts } from '@/actions/accounts'
import { getInvestmentHoldings, getInvestmentTradesHistory } from '@/actions/investments'
import { getLatestExchangeRate } from '@/actions/exchange-rate'
import { InvestmentsView } from '@/components/investments/investments-view'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Investments & Stocks | Pocketly',
  description: 'Manage IDX stock holdings, RDN cash balance, and trading performance',
}

export default async function InvestmentsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [accounts, holdings, trades, exchangeRate] = await Promise.all([
    getAccounts(),
    getInvestmentHoldings(),
    getInvestmentTradesHistory(),
    getLatestExchangeRate('USD', 'IDR'),
  ])

  return (
    <InvestmentsView
      holdings={holdings}
      trades={trades}
      accounts={accounts}
      exchangeRate={exchangeRate}
    />
  )
}
