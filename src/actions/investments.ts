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
 * Record a stock purchase:
 * 1. Checks that RDN source account has enough balance.
 * 2. Deducts net buy amount from RDN cash balance.
 * 3. Creates or updates the open stock holding position.
 * 4. Logs a 'buy' trade entry.
 */
export async function recordStockBuy(input: {
  accountId: string
  ticker: string
  netAmount: number
  notes?: string | null
  tradeDate?: string | null
}) {
  const cleanTicker = input.ticker.trim().toUpperCase()
  if (!cleanTicker) {
    return { error: 'Kode saham / emiten wajib diisi' }
  }
  if (!input.netAmount || input.netAmount <= 0) {
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

  const currentBal = Number(acc.current_balance) || 0
  if (currentBal - input.netAmount < 0) {
    return {
      error: `Saldo kas ${acc.name} tidak mencukupi untuk pembelian ini (Tersedia: ${formatCurrency(currentBal, acc.currency)}, Dibutuhkan: ${formatCurrency(input.netAmount, acc.currency)})`,
    }
  }

  // 2. Deduct RDN cash balance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updBalErr } = await (supabase.from('accounts') as any)
    .update({ current_balance: currentBal - input.netAmount })
    .eq('id', acc.id)

  if (updBalErr) {
    return { error: updBalErr.message }
  }

  // 3. Upsert Stock Holding
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingHolding } = await (supabase.from('stock_holdings') as any)
    .select('*')
    .eq('user_id', user.id)
    .eq('account_id', acc.id)
    .eq('ticker', cleanTicker)
    .maybeSingle()

  let holdingId = existingHolding?.id

  if (existingHolding) {
    const updatedCost = Number(existingHolding.total_cost) + input.netAmount
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('stock_holdings') as any)
      .update({
        total_cost: updatedCost,
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
        total_cost: input.netAmount,
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
      net_amount: input.netAmount,
      buy_cost: input.netAmount,
      realized_pnl: 0,
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
  return { success: true }
}

/**
 * Record a stock sale (Take Profit or Cut Loss):
 * 1. Fetches open holding to know original buy cost.
 * 2. Credits net sell proceeds into RDN account.
 * 3. Calculates realized PnL = netAmount - total_cost.
 * 4. Removes/closes the stock holding position.
 * 5. Logs a 'sell' trade entry.
 */
export async function recordStockSell(input: {
  holdingId: string
  netAmount: number
  notes?: string | null
  tradeDate?: string | null
}) {
  if (!input.netAmount || input.netAmount <= 0) {
    return { error: 'Nominal penjualan harus lebih besar dari 0' }
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

  const buyCost = Number(holding.total_cost) || 0
  const realizedPnl = input.netAmount - buyCost
  const acc = holding.account

  if (!acc) {
    return { error: 'Akun RDN tertaut tidak ditemukan' }
  }

  // 2. Credit RDN balance with net sell proceeds
  const currentBal = Number(acc.current_balance) || 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updBalErr } = await (supabase.from('accounts') as any)
    .update({ current_balance: currentBal + input.netAmount })
    .eq('id', acc.id)

  if (updBalErr) {
    return { error: updBalErr.message }
  }

  // 3. Delete / Close Stock Holding
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('stock_holdings') as any)
    .delete()
    .eq('id', holding.id)

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
      net_amount: input.netAmount,
      buy_cost: buyCost,
      realized_pnl: realizedPnl,
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
  return { success: true, realizedPnl }
}

/**
 * Delete a trade entry
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

  if (!input.netAmount || input.netAmount <= 0) {
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
  const newAmount = Number(input.netAmount) || 0
  const delta = newAmount - oldAmount
  const acc = trade.account

  if (delta !== 0 && acc) {
    const currentBal = Number(acc.current_balance) || 0
    if (trade.type === 'buy') {
      // Buy: if newAmount increased (delta > 0), need more balance deducted
      if (currentBal - delta < 0) {
        return { error: `Saldo RDN tidak mencukupi untuk penyesuaian nominal (${acc.name})` }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('accounts') as any)
        .update({ current_balance: currentBal - delta })
        .eq('id', acc.id)

      // If there's an active holding with this ticker, adjust total_cost
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: holding } = await (supabase.from('stock_holdings') as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('account_id', acc.id)
        .eq('ticker', trade.ticker)
        .maybeSingle()

      if (holding) {
        const newCost = Math.max(0, Number(holding.total_cost) + delta)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('stock_holdings') as any)
          .update({ total_cost: newCost })
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
