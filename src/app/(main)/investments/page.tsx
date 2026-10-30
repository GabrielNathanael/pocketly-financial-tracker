import React from 'react'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAccounts } from '@/actions/accounts'
import { getInvestmentHoldings, getInvestmentTradesHistory } from '@/actions/investments'
import { getCryptoHoldings, getCryptoTrades } from '@/actions/crypto'
import { PortfolioInvestmentView } from '@/components/investments/portfolio-investment-view'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Investment Portfolio | Pocketly',
  description: 'Manage stocks, crypto assets, platform balances, and investment performance',
}

export default async function InvestmentsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [accounts, holdings, trades, cryptoHoldings, cryptoTrades] = await Promise.all([
    getAccounts(),
    getInvestmentHoldings(),
    getInvestmentTradesHistory(),
    getCryptoHoldings(),
    getCryptoTrades(),
  ])

  return (
    <PortfolioInvestmentView
      stocks={holdings}
      stockTrades={trades}
      cryptos={cryptoHoldings}
      cryptoTrades={cryptoTrades}
      accounts={accounts}
    />
  )
}
