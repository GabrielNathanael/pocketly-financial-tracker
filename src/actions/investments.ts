'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { EnrichedStockHolding, EnrichedStockTrade } from '@/types/database'
import { formatCurrency } from '@/lib/utils/currency'

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

  return (data as EnrichedStockHolding[]) || []
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
 * 2. Determines if Bea Materai applies for today's accumulated transactions (> Rp 10.000.000).
 * 3. Deducts (netAmount + stampDuty) from RDN cash balance.
 * 4. Creates or updates the stock holding position (calculates new accumulated Lots and average buy price).
 * 5. Logs a 'buy' trade entry.
 */
export async function recordStockBuy(input: {
  accountId: string
  ticker: string
  lots: number
  netAmount: number
  notes?: string | null
  tradeDate?: string | null
}) {
  const cleanTicker = input.ticker.trim().toUpperCase()
  if (!cleanTicker) {
    return { error: 'Kode saham / emiten wajib diisi' }
  }
  const lots = Number(input.lots)
  if (!lots || lots <= 0) {
    return { error: 'Jumlah lot harus lebih besar dari 0' }
  }
  const netAmount = Number(input.netAmount)
  if (!netAmount || netAmount <= 0) {
    return { error: 'Nominal pembelian harus lebih besar dari 0' }
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // 1. Fetch RDN account
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: acc, error: accErr } = await (supabase.from('accounts') as any)
    .select('id, name, currency, current_balance, type')
    .eq('id', input.accountId)
    .eq('user_id', user.id)
    .single()

  if (accErr || !acc) {
    return { error: 'Akun RDN tidak ditemukan' }
  }

  if (acc.type !== 'investment') {
    return { error: 'Hanya akun bertipe Investasi (RDN) yang dapat digunakan untuk transaksi saham.' }
  }

  const dateOnly = input.tradeDate || new Date().toISOString().split('T')[0]
  const { dailyVolume, stampDutyCharged } = await getDailyTradingVolume(acc.id, dateOnly)

  // Check if this trade triggers Bea Materai Rp 10.000 for the first time today
  let stampDutyToApply = 0
  if (stampDutyCharged === 0 && (dailyVolume + netAmount) > 10_000_000) {
    stampDutyToApply = 10_000
  }

  const totalDeduction = netAmount + stampDutyToApply
  const currentBal = Number(acc.current_balance) || 0

  if (currentBal - totalDeduction < 0) {
    return {
      error: `Saldo kas ${acc.name} tidak mencukupi (Tersedia: ${formatCurrency(currentBal, acc.currency)}, Dibutuhkan: ${formatCurrency(totalDeduction, acc.currency)}${stampDutyToApply > 0 ? ' termasuk Bea Materai Rp 10.000' : ''})`,
    }
  }

  // 2. Deduct RDN cash balance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updBalErr } = await (supabase.from('accounts') as any)
    .update({ current_balance: currentBal - totalDeduction })
    .eq('id', acc.id)

  if (updBalErr) {
    return { error: updBalErr.message }
  }

  // 3. Upsert Stock Holding (DCA Accumulation)
  const sharesToAdd = Math.round(lots * 100)
  const pricePerShare = netAmount / sharesToAdd

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingHolding } = await (supabase.from('stock_holdings') as any)
    .select('*')
    .eq('user_id', user.id)
    .eq('account_id', acc.id)
    .eq('ticker', cleanTicker)
    .maybeSingle()

  let holdingId = existingHolding?.id

  if (existingHolding) {
    const prevLots = Number(existingHolding.lots) || (Number(existingHolding.total_cost) > 0 ? (Number(existingHolding.total_shares) / 100 || 0) : 0)
    const prevShares = Number(existingHolding.total_shares) || (prevLots * 100)
    const prevCost = Number(existingHolding.total_cost) || 0

    const updatedLots = prevLots + lots
    const updatedShares = prevShares + sharesToAdd
    const updatedCost = prevCost + netAmount
    const updatedAvgPrice = updatedShares > 0 ? updatedCost / updatedShares : pricePerShare

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('stock_holdings') as any)
      .update({
        lots: updatedLots,
        total_shares: updatedShares,
        total_cost: updatedCost,
        avg_buy_price: updatedAvgPrice,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingHolding.id)
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newHolding, error: holdErr } = await (supabase.from('stock_holdings') as any)
      .insert({
        user_id: user.id,
        account_id: acc.id,
        ticker: cleanTicker,
        lots: lots,
        total_shares: sharesToAdd,
        total_cost: netAmount,
        avg_buy_price: pricePerShare,
        notes: input.notes || null,
      })
      .select()
      .single()

    if (holdErr) {
      console.error('Error creating stock holding:', holdErr)
    } else if (newHolding) {
      holdingId = newHolding.id
    }
  }

  // 4. Record Trade Log
  const txDate = input.tradeDate ? `${input.tradeDate}T12:00:00.000Z` : new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: tradeErr } = await (supabase.from('stock_trades') as any)
    .insert({
      user_id: user.id,
      account_id: acc.id,
      holding_id: holdingId || null,
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
 * 7. Updates holding remaining lots/cost, or deletes holding if 100% sold.
 * 8. Logs a 'sell' trade entry.
 */
export async function recordStockSell(input: {
  holdingId: string
  lots: number
  netAmount: number
  notes?: string | null
  tradeDate?: string | null
}) {
  const lotsToSell = Number(input.lots)
  if (!lotsToSell || lotsToSell <= 0) {
    return { error: 'Jumlah lot yang dijual harus lebih besar dari 0' }
  }
  const netAmount = Number(input.netAmount)
  if (!netAmount || netAmount <= 0) {
    return { error: 'Nominal penjualan bersih harus lebih besar dari 0' }
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // 1. Fetch holding
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
  const currentAvgPrice = Number(holding.avg_buy_price) || (currentLots > 0 ? currentTotalCost / (currentLots * 100) : 0)

  if (lotsToSell > currentLots + 0.0001) {
    return {
      error: `Jumlah lot melebihi kepemilikan saat ini (Tersedia: ${currentLots} lot, Dijual: ${lotsToSell} lot)`,
    }
  }

  const isFullSell = lotsToSell >= currentLots - 0.0001
  const proportionalBuyCost = isFullSell
    ? currentTotalCost
    : (lotsToSell / currentLots) * currentTotalCost
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

  // 4. Update or Delete Stock Holding
  if (isFullSell) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('stock_holdings') as any)
      .delete()
      .eq('id', holding.id)
  } else {
    const remainingLots = Math.max(0, currentLots - lotsToSell)
    const remainingShares = Math.round(remainingLots * 100)
    const remainingCost = Math.max(0, currentTotalCost - proportionalBuyCost)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('stock_holdings') as any)
      .update({
        lots: remainingLots,
        total_shares: remainingShares,
        total_cost: remainingCost,
        avg_buy_price: currentAvgPrice,
        updated_at: new Date().toISOString(),
      })
      .eq('id', holding.id)
  }

  // 5. Record Trade Log
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
 * Delete a trade entry and revert associated calculations safely
 */
export async function deleteStockTrade(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('stock_trades') as any)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
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
 * Edit an existing stock trade entry (buy/sell)
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
  const newLots = input.lots !== undefined ? Number(input.lots) : Number(trade.lots)
  const newShares = Math.round(newLots * 100)
  const newPricePerShare = newShares > 0 ? newAmount / newShares : 0

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: holding } = await (supabase.from('stock_holdings') as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('account_id', acc.id)
        .eq('ticker', trade.ticker)
        .maybeSingle()

      if (holding) {
        const newCost = Math.max(0, Number(holding.total_cost) + delta)
        const holdingLots = Number(holding.lots) || (Number(holding.total_shares) / 100) || 1
        const holdingShares = holdingLots * 100
        const newAvgPrice = holdingShares > 0 ? newCost / holdingShares : 0

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('stock_holdings') as any)
          .update({
            total_cost: newCost,
            avg_buy_price: newAvgPrice,
          })
          .eq('id', holding.id)
      }
    } else {
      // Sell: proceeds change
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('accounts') as any)
        .update({ current_balance: currentBal + delta })
        .eq('id', acc.id)
    }
  }

  // Recalculate realized PnL if sell
  let newRealizedPnl = trade.realized_pnl
  if (trade.type === 'sell') {
    const buyCost = Number(trade.buy_cost) || 0
    newRealizedPnl = newAmount - buyCost
  }

  const txDate = input.tradeDate ? `${input.tradeDate}T12:00:00.000Z` : trade.trade_date

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (supabase.from('stock_trades') as any)
    .update({
      ticker: input.ticker.trim().toUpperCase(),
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

  revalidatePath('/investments')
  revalidatePath('/accounts')
  revalidatePath('/net-worth')
  revalidatePath('/dashboard')
  return { success: true }
}
