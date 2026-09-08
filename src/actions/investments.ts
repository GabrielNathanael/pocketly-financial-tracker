'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { EnrichedStockHolding, EnrichedStockTrade } from '@/types/database'
import { formatCurrency } from '@/lib/utils/currency'

/**
 * Automatically recalculate and synchronize a stock holding's lots, total_shares,
 * total_cost, and avg_buy_price directly from the user's trade history for that ticker.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncStockHolding(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  accountId: string,
  ticker: string
) {
  const cleanTicker = ticker.trim().toUpperCase()

  // 1. Fetch all trades for this user, account, and ticker ordered chronologically
  const { data: trades, error } = await supabase
    .from('stock_trades')
    .select('*')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .eq('ticker', cleanTicker)
    .order('trade_date', { ascending: true })

  if (error || !trades || trades.length === 0) {
    // If no trades exist, delete any orphaned holding for this ticker
    await supabase
      .from('stock_holdings')
      .delete()
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .eq('ticker', cleanTicker)
    return
  }

  let runningLots = 0
  let runningShares = 0
  let runningCost = 0

  for (const tr of trades) {
    const trLots = Number(tr.lots) || (Number(tr.shares) / 100) || 0
    const trShares = Number(tr.shares) || Math.round(trLots * 100)
    const trAmount = Number(tr.net_amount) || 0

    if (tr.type === 'buy') {
      runningLots += trLots
      runningShares += trShares
      runningCost += trAmount
    } else if (tr.type === 'sell') {
      const costDeducted = Number(tr.buy_cost) || (runningLots > 0 ? (trLots / runningLots) * runningCost : 0)
      runningLots = Math.max(0, runningLots - trLots)
      runningShares = Math.max(0, runningShares - trShares)
      runningCost = Math.max(0, runningCost - costDeducted)
    }
  }

  const avgBuyPrice = runningShares > 0 ? runningCost / runningShares : 0

  // 2. Check if holding exists in database
  const { data: holding } = await supabase
    .from('stock_holdings')
    .select('id')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .eq('ticker', cleanTicker)
    .maybeSingle()

  if (runningLots <= 0 || runningCost <= 0) {
    if (holding) {
      await supabase.from('stock_holdings').delete().eq('id', holding.id)
    }
  } else {
    if (holding) {
      await supabase
        .from('stock_holdings')
        .update({
          lots: runningLots,
          total_shares: runningShares,
          total_cost: runningCost,
          avg_buy_price: avgBuyPrice,
          updated_at: new Date().toISOString(),
        })
        .eq('id', holding.id)
    } else {
      await supabase
        .from('stock_holdings')
        .insert({
          user_id: userId,
          account_id: accountId,
          ticker: cleanTicker,
          lots: runningLots,
          total_shares: runningShares,
          total_cost: runningCost,
          avg_buy_price: avgBuyPrice,
        })
    }
  }
}

/**
 * Fetch all active stock holdings for the current user
 */
export async function getInvestmentHoldings(): Promise<EnrichedStockHolding[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('stock_holdings') as any)
    .select(`
      *,
      account:accounts(*)
    `)
    .eq('user_id', user.id)
    .gt('total_cost', 0)
    .order('ticker', { ascending: true })

  if (error) {
    console.error('Error fetching stock holdings:', error)
    return []
  }

  const holdings = (data as EnrichedStockHolding[]) || []

  // Auto-sync if any holding in the database has 0 or null lots from older migrations
  let hasSyncedAny = false
  for (const h of holdings) {
    if (!h.lots || Number(h.lots) === 0 || !h.avg_buy_price || Number(h.avg_buy_price) === 0) {
      await syncStockHolding(supabase, user.id, h.account_id, h.ticker)
      hasSyncedAny = true
    }
  }

  if (hasSyncedAny) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: refreshed } = await (supabase.from('stock_holdings') as any)
      .select(`*, account:accounts(*)`)
      .eq('user_id', user.id)
      .gt('total_cost', 0)
      .order('ticker', { ascending: true })
    return (refreshed as EnrichedStockHolding[]) || []
  }

  return holdings
}

/**
 * Fetch stock trade execution history for the current user
 */
export async function getInvestmentTradesHistory(): Promise<EnrichedStockTrade[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('stock_trades') as any)
    .select(`
      *,
      account:accounts(*)
    `)
    .eq('user_id', user.id)
    .order('trade_date', { ascending: false })

  if (error) {
    console.error('Error fetching stock trades:', error)
    return []
  }

  return (data as EnrichedStockTrade[]) || []
}

/**
 * Calculate total trading volume for a specific account on a given date (YYYY-MM-DD)
 * and check if stamp duty (Bea Materai Rp 10.000) has already been applied or needs to be applied.
 */
export async function getDailyTradingVolume(accountId: string, dateStr: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { dailyVolume: 0, stampDutyCharged: 0, isThresholdReached: false }

  const startOfDay = `${dateStr}T00:00:00.000Z`
  const endOfDay = `${dateStr}T23:59:59.999Z`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: trades, error } = await (supabase.from('stock_trades') as any)
    .select('net_amount, stamp_duty')
    .eq('user_id', user.id)
    .eq('account_id', accountId)
    .gte('trade_date', startOfDay)
    .lte('trade_date', endOfDay)

  if (error || !trades) {
    return { dailyVolume: 0, stampDutyCharged: 0, isThresholdReached: false }
  }

  let dailyVolume = 0
  let stampDutyCharged = 0

  for (const t of trades) {
    dailyVolume += Number(t.net_amount) || 0
    stampDutyCharged += Number(t.stamp_duty) || 0
  }

  return {
    dailyVolume,
    stampDutyCharged,
    isThresholdReached: dailyVolume > 10_000_000,
  }
}

/**
 * Record a stock purchase (Supports DCA Averaging & Lots):
 * 1. Checks that RDN source account has enough balance (including potential Rp 10.000 stamp duty).
 * 2. Deducts net buy amount (+ stamp duty if triggered) from RDN cash balance.
 * 3. Records the trade log.
 * 4. Syncs the holding state accurately from all trades.
 */
export async function recordStockBuy(input: {
  accountId: string
  ticker: string
  lots: number
  netAmount: number
  notes?: string | null
  tradeDate?: string
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const cleanTicker = input.ticker.trim().toUpperCase()
  const lots = Number(input.lots)
  const netAmount = Number(input.netAmount)

  if (!cleanTicker) {
    return { error: 'Kode saham wajib diisi' }
  }
  if (!lots || lots <= 0) {
    return { error: 'Jumlah lot harus lebih besar dari 0' }
  }
  if (!netAmount || netAmount <= 0) {
    return { error: 'Total nominal pembelian harus lebih besar dari 0' }
  }

  // 1. Fetch RDN Account
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: acc, error: accErr } = await (supabase.from('accounts') as any)
    .select('*')
    .eq('id', input.accountId)
    .eq('user_id', user.id)
    .single()

  if (accErr || !acc) {
    return { error: 'Akun RDN tidak ditemukan' }
  }

  // 2. Check Daily Trading Volume & Stamp Duty (Bea Materai Rp 10.000)
  const dateOnly = input.tradeDate || new Date().toISOString().split('T')[0]
  const { dailyVolume, stampDutyCharged } = await getDailyTradingVolume(acc.id, dateOnly)

  let stampDutyToApply = 0
  if (stampDutyCharged === 0 && (dailyVolume + netAmount) > 10_000_000) {
    stampDutyToApply = 10_000
  }

  const totalDeduction = netAmount + stampDutyToApply
  const currentBal = Number(acc.current_balance) || 0

  if (currentBal < totalDeduction) {
    return {
      error: `Saldo kas RDN (${acc.name}) tidak mencukupi. Dibutuhkan: ${formatCurrency(totalDeduction, acc.currency)}, Tersedia: ${formatCurrency(currentBal, acc.currency)}`,
    }
  }

  // Deduct RDN Balance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updBalErr } = await (supabase.from('accounts') as any)
    .update({ current_balance: currentBal - totalDeduction })
    .eq('id', acc.id)

  if (updBalErr) {
    return { error: updBalErr.message }
  }

  // 3. Record Trade Log
  const sharesToAdd = Math.round(lots * 100)
  const pricePerShare = netAmount / sharesToAdd
  const txDate = input.tradeDate ? `${input.tradeDate}T12:00:00.000Z` : new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: tradeErr } = await (supabase.from('stock_trades') as any)
    .insert({
      user_id: user.id,
      account_id: acc.id,
      holding_id: null,
      ticker: cleanTicker,
      type: 'buy',
      net_amount: netAmount,
      buy_cost: netAmount,
      realized_pnl: 0,
      lots: lots,
      shares: sharesToAdd,
      price_per_share: pricePerShare,
      stamp_duty: stampDutyToApply,
      notes: input.notes?.trim() || null,
      trade_date: txDate,
    })

  if (tradeErr) {
    console.error('Error inserting stock trade:', tradeErr)
  }

  // 4. Sync Holding from Trades
  await syncStockHolding(supabase, user.id, acc.id, cleanTicker)

  revalidatePath('/investments')
  revalidatePath('/accounts')
  revalidatePath('/net-worth')
  revalidatePath('/dashboard')
  return {
    success: true,
    stampDutyApplied: stampDutyToApply > 0,
  }
}

/**
 * Record a stock sale (Supports Partial Sell, Proportional Cost Basis & Realized PnL):
 * 1. Fetches open holding.
 * 2. Checks lots to sell vs total lots owned.
 * 3. Calculates proportional buy cost = (lotsToSell / totalLots) * totalCost.
 * 4. Calculates realized PnL = netAmount - proportionalBuyCost.
 * 5. Checks Bea Materai Rp 10.000 for today's volume.
 * 6. Credits (netAmount - stampDuty) to RDN account.
 * 7. Records the trade log and syncs holding.
 */
export async function recordStockSell(input: {
  holdingId: string
  lots: number
  netAmount: number
  notes?: string | null
  tradeDate?: string
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const lotsToSell = Number(input.lots)
  const netAmount = Number(input.netAmount)

  if (!lotsToSell || lotsToSell <= 0) {
    return { error: 'Jumlah lot yang dijual harus lebih besar dari 0' }
  }
  if (!netAmount || netAmount <= 0) {
    return { error: 'Nominal penjualan bersih harus lebih besar dari 0' }
  }

  // 1. Fetch holding & account
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: holding, error: holdErr } = await (supabase.from('stock_holdings') as any)
    .select('*, account:accounts(*)')
    .eq('id', input.holdingId)
    .eq('user_id', user.id)
    .single()

  if (holdErr || !holding) {
    return { error: 'Data kepemilikan saham tidak ditemukan' }
  }

  const acc = holding.account
  if (!acc) {
    return { error: 'Akun RDN tertaut tidak ditemukan' }
  }

  const currentLots = Number(holding.lots) || (Number(holding.total_shares) / 100) || 1
  const currentTotalCost = Number(holding.total_cost) || 0

  if (lotsToSell > currentLots + 0.0001) {
    return {
      error: `Jumlah lot melebihi kepemilikan saat ini (Tersedia: ${currentLots} lot, Dijual: ${lotsToSell} lot)`,
    }
  }

  const proportionalBuyCost = (lotsToSell / currentLots) * currentTotalCost
  const realizedPnl = netAmount - proportionalBuyCost
  const sharesSold = Math.round(lotsToSell * 100)
  const sellPricePerShare = sharesSold > 0 ? netAmount / sharesSold : 0

  // 2. Check Daily Stamp Duty
  const dateOnly = input.tradeDate || new Date().toISOString().split('T')[0]
  const { dailyVolume, stampDutyCharged } = await getDailyTradingVolume(acc.id, dateOnly)

  let stampDutyToApply = 0
  if (stampDutyCharged === 0 && (dailyVolume + netAmount) > 10_000_000) {
    stampDutyToApply = 10_000
  }

  // 3. Credit RDN balance with net sell proceeds (minus stamp duty if triggered)
  const currentBal = Number(acc.current_balance) || 0
  const netCredit = netAmount - stampDutyToApply

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updBalErr } = await (supabase.from('accounts') as any)
    .update({ current_balance: currentBal + netCredit })
    .eq('id', acc.id)

  if (updBalErr) {
    return { error: updBalErr.message }
  }

  // 4. Record Trade Log
  const txDate = input.tradeDate ? `${input.tradeDate}T12:00:00.000Z` : new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: tradeErr } = await (supabase.from('stock_trades') as any)
    .insert({
      user_id: user.id,
      account_id: acc.id,
      holding_id: null,
      ticker: holding.ticker,
      type: 'sell',
      net_amount: netAmount,
      buy_cost: proportionalBuyCost,
      realized_pnl: realizedPnl,
      lots: lotsToSell,
      shares: sharesSold,
      price_per_share: sellPricePerShare,
      stamp_duty: stampDutyToApply,
      notes: input.notes?.trim() || null,
      trade_date: txDate,
    })

  if (tradeErr) {
    console.error('Error inserting stock trade:', tradeErr)
  }

  // 5. Sync Holding from Trades
  await syncStockHolding(supabase, user.id, acc.id, holding.ticker)

  revalidatePath('/investments')
  revalidatePath('/accounts')
  revalidatePath('/net-worth')
  revalidatePath('/dashboard')
  return {
    success: true,
    realizedPnl,
    stampDutyApplied: stampDutyToApply > 0,
  }
}

/**
 * Delete a trade entry, revert account cash balance, and resync holding
 */
export async function deleteStockTrade(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // 1. Fetch trade first
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: trade, error: fetchErr } = await (supabase.from('stock_trades') as any)
    .select('*, account:accounts(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !trade) {
    return { error: 'Transaksi tidak ditemukan' }
  }

  const acc = trade.account
  const tradeAmount = Number(trade.net_amount) || 0
  const stampDuty = Number(trade.stamp_duty) || 0

  // 2. Revert RDN account balance
  if (acc) {
    const curBal = Number(acc.current_balance) || 0
    if (trade.type === 'buy') {
      // Revert buy by returning funds + stamp duty back to RDN
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('accounts') as any)
        .update({ current_balance: curBal + tradeAmount + stampDuty })
        .eq('id', acc.id)
    } else {
      // Revert sell by deducting proceeds
      const netSellProceeds = tradeAmount - stampDuty
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('accounts') as any)
        .update({ current_balance: curBal - netSellProceeds })
        .eq('id', acc.id)
    }
  }

  // 3. Delete the trade record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('stock_trades') as any)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  // 4. Resync the holding
  if (acc) {
    await syncStockHolding(supabase, user.id, acc.id, trade.ticker)
  }

  revalidatePath('/investments')
  revalidatePath('/accounts')
  revalidatePath('/net-worth')
  revalidatePath('/dashboard')
  return { success: true }
}

interface UpdateStockTradeInput {
  id: string
  ticker: string
  lots?: number
  netAmount: number
  notes?: string | null
  tradeDate?: string
}

/**
 * Edit an existing stock trade entry (buy/sell) and automatically resync holding & RDN cash
 */
export async function updateStockTrade(input: UpdateStockTradeInput) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const newAmount = Number(input.netAmount)
  if (!newAmount || newAmount <= 0) {
    return { error: 'Nominal transaksi harus lebih besar dari 0' }
  }

  // 1. Fetch current trade record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: trade, error: tradeErr } = await (supabase.from('stock_trades') as any)
    .select('*, account:accounts(*)')
    .eq('id', input.id)
    .eq('user_id', user.id)
    .single()

  if (tradeErr || !trade) {
    return { error: 'Riwayat transaksi saham tidak ditemukan' }
  }

  const oldAmount = Number(trade.net_amount) || 0
  const delta = newAmount - oldAmount
  const acc = trade.account
  const newLots = input.lots !== undefined ? Number(input.lots) : (Number(trade.lots) || 1)
  const newShares = Math.round(newLots * 100)
  const newPricePerShare = newShares > 0 ? newAmount / newShares : 0
  const cleanTicker = input.ticker.trim().toUpperCase()

  // 2. Adjust RDN balance if net amount changed
  if (delta !== 0 && acc) {
    const currentBal = Number(acc.current_balance) || 0
    if (trade.type === 'buy') {
      if (currentBal - delta < 0) {
        return { error: `Saldo RDN tidak mencukupi untuk penyesuaian nominal (${acc.name})` }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('accounts') as any)
        .update({ current_balance: currentBal - delta })
        .eq('id', acc.id)
    } else {
      // Sell: proceeds change
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('accounts') as any)
        .update({ current_balance: currentBal + delta })
        .eq('id', acc.id)
    }
  }

  // 3. Recalculate realized PnL if sell
  let newRealizedPnl = trade.realized_pnl
  if (trade.type === 'sell') {
    const buyCost = Number(trade.buy_cost) || 0
    newRealizedPnl = newAmount - buyCost
  }

  const txDate = input.tradeDate ? `${input.tradeDate}T12:00:00.000Z` : trade.trade_date

  // 4. Update the trade row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (supabase.from('stock_trades') as any)
    .update({
      ticker: cleanTicker,
      lots: newLots,
      shares: newShares,
      price_per_share: newPricePerShare,
      net_amount: newAmount,
      realized_pnl: newRealizedPnl,
      notes: input.notes?.trim() || null,
      trade_date: txDate,
    })
    .eq('id', input.id)
    .eq('user_id', user.id)

  if (updErr) {
    return { error: updErr.message }
  }

  // 5. Automatically recalculate & sync the stock holding from trades
  if (acc) {
    await syncStockHolding(supabase, user.id, acc.id, cleanTicker)
    if (trade.ticker && trade.ticker !== cleanTicker) {
      await syncStockHolding(supabase, user.id, acc.id, trade.ticker)
    }
  }

  revalidatePath('/investments')
  revalidatePath('/accounts')
  revalidatePath('/net-worth')
  revalidatePath('/dashboard')
  return { success: true }
}
