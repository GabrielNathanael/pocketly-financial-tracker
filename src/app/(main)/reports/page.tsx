import React from 'react'
import { getTransactions } from '@/actions/transactions'
import { getCategories } from '@/actions/categories'
import { getLatestForexRates } from '@/actions/exchange-rate'
import { getInvestmentHoldings } from '@/actions/investments'
import { getCryptoHoldings } from '@/actions/crypto'
import { getEtfHoldings } from '@/actions/etf'
import { getAssetPrices } from '@/lib/net-worth/prices'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ReportsView } from '@/components/reports/reports-view'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const supabase = await createServerSupabaseClient()
  const [transactions, categories, rates, stocks, cryptos, etfs, priceMap] = await Promise.all([
    getTransactions(),
    getCategories(),
    getLatestForexRates(),
    getInvestmentHoldings(),
    getCryptoHoldings(),
    getEtfHoldings(),
    getAssetPrices(supabase as any),
  ])

  return (
    <ReportsView
      transactions={transactions}
      categories={categories}
      rates={rates}
      stocks={stocks}
      cryptos={cryptos}
      etfs={etfs}
      prices={Array.from(priceMap.values())}
    />
  )
}
