'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { convertAmount, ForexRatesMap, DEFAULT_FALLBACK_RATES } from '@/lib/utils/currency'
import { CurrencyCode } from '@/lib/constants/currencies'

export async function fetchAndSaveForexRates(): Promise<ForexRatesMap> {
  const supabase = await createServerSupabaseClient()
  const rates: ForexRatesMap = { ...DEFAULT_FALLBACK_RATES }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 },
    })

    if (res.ok) {
      const data = await res.json()
      if (data.rates) {
        if (data.rates.IDR) rates.IDR = Number(data.rates.IDR)
        if (data.rates.SGD) rates.SGD = Number(data.rates.SGD)
        if (data.rates.USD) rates.USD = 1
      }
    }
  } catch (err) {
    console.warn('Failed to fetch live forex rates, using fallback:', err)
  }

  // Save to exchange_rates table for all pairs
  try {
    const now = new Date().toISOString()
    // Upsert or insert USD -> IDR and USD -> SGD
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('exchange_rates') as any).insert([
      {
        base_currency: 'USD',
        target_currency: 'IDR',
        rate: rates.IDR,
        fetched_at: now,
      },
      {
        base_currency: 'USD',
        target_currency: 'SGD',
        rate: rates.SGD,
        fetched_at: now,
      },
    ])
  } catch {
    // Ignored
  }

  return rates
}

export async function fetchAndSaveExchangeRate(): Promise<number> {
  const rates = await fetchAndSaveForexRates()
  return rates.IDR || 16200
}

export async function getLatestForexRates(): Promise<ForexRatesMap> {
  const supabase = await createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('exchange_rates') as any)
    .select('base_currency, target_currency, rate, fetched_at')
    .eq('base_currency', 'USD')
    .order('fetched_at', { ascending: false })
    .limit(5)

  const rates: ForexRatesMap = { ...DEFAULT_FALLBACK_RATES }

  if (data && data.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of data as any[]) {
      if (r.target_currency && r.rate) {
        rates[r.target_currency] = Number(r.rate)
      }
    }
    return rates
  }

  // Fresh fetch if empty
  return await fetchAndSaveForexRates()
}

export async function getLatestExchangeRate(base = 'USD', target = 'IDR'): Promise<number> {
  const rates = await getLatestForexRates()
  if (base === 'USD') {
    return rates[target] || DEFAULT_FALLBACK_RATES[target] || 1
  }
  return convertAmount(1, base, target, rates)
}

export interface NetWorthSummary {
  totalAccountsIdr: number
  totalStockHoldingsIdr: number
  totalReceivablesIdr: number
  totalDebtsIdr: number
  netWorthIdr: number
  exchangeRate: number
  rates: ForexRatesMap
}

export async function getNetWorthData(displayCurrency: CurrencyCode = 'IDR'): Promise<NetWorthSummary> {
  const supabase = await createServerSupabaseClient()
  const rates = await getLatestForexRates()

  // 1. Accounts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: accounts } = await (supabase.from('accounts') as any)
    .select('current_balance, currency, is_active')
    .eq('is_active', true)

  let totalAccountsIdr = 0
  if (accounts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const acc of accounts as any[]) {
      totalAccountsIdr += convertAmount(Number(acc.current_balance), acc.currency, displayCurrency, rates)
    }
  }

  // 2. Stock Holdings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stockHoldings } = await (supabase.from('stock_holdings') as any)
    .select('total_cost, account:accounts(currency)')
    .gt('total_cost', 0)

  let totalStockHoldingsIdr = 0
  if (stockHoldings) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const h of stockHoldings as any[]) {
      const cur = h.account?.currency || 'IDR'
      totalStockHoldingsIdr += convertAmount(Number(h.total_cost), cur, displayCurrency, rates)
    }
  }

  // 3. Debts & Receivables
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: debts } = await (supabase.from('debts') as any)
    .select('type, remaining_amount, currency, status')
    .eq('status', 'active')

  let totalReceivablesIdr = 0
  let totalDebtsIdr = 0

  if (debts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const d of debts as any[]) {
      const converted = convertAmount(Number(d.remaining_amount), d.currency, displayCurrency, rates)
      if (d.type === 'receivable') {
        totalReceivablesIdr += converted
      } else {
        totalDebtsIdr += converted
      }
    }
  }

  const netWorthIdr = totalAccountsIdr + totalStockHoldingsIdr + totalReceivablesIdr - totalDebtsIdr

  return {
    totalAccountsIdr,
    totalStockHoldingsIdr,
    totalReceivablesIdr,
    totalDebtsIdr,
    netWorthIdr,
    exchangeRate: rates.IDR || 16200,
    rates,
  }
}
