'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { EnrichedTransfer, CurrencyCode } from '@/types/database'
import { transferSchema } from '@/lib/validations/transfer'
import { formatCurrency } from '@/lib/utils/currency'

export async function getTransfers(): Promise<EnrichedTransfer[]> {
  const supabase = await createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('transfers') as any)
    .select(`
      *,
      from_account:accounts!transfers_from_account_id_fkey(*),
      to_account:accounts!transfers_to_account_id_fkey(*)
    `)
    .order('transfer_date', { ascending: false })

  if (error) {
    console.error('Error fetching transfers:', error)
    return []
  }

  return (data as unknown as EnrichedTransfer[]) || []
}

export async function createTransfer(input: {
  fromAccountId: string
  toAccountId: string
  amount: number
  exchangeRateUsed?: number
  description?: string | null
  transferDate: string
}) {
  const validation = transferSchema.safeParse(input)
  if (!validation.success) {
    const firstIssue = validation.error.issues[0]
    return { error: firstIssue?.message || 'Invalid input' }
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // 1. Fetch Accounts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fromAcc, error: fromErr } = await (supabase.from('accounts') as any)
    .select('id, name, currency, current_balance')
    .eq('id', input.fromAccountId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: toAcc, error: toErr } = await (supabase.from('accounts') as any)
    .select('id, name, currency, current_balance')
    .eq('id', input.toAccountId)
    .single()

  if (fromErr || !fromAcc || toErr || !toAcc) {
    return { error: 'Akun pengirim atau penerima tidak ditemukan' }
  }

  // 2. Strict Non-Negative Balance Guard for Source Account
  const fromBal = Number(fromAcc.current_balance) || 0
  if (fromBal - input.amount < 0) {
    return {
      error: `Saldo akun asal (${fromAcc.name}) tidak mencukupi untuk transfer. (Tersedia: ${formatCurrency(fromBal, fromAcc.currency)}, Diperlukan: ${formatCurrency(input.amount, fromAcc.currency)})`,
    }
  }

  const fromCurrency = (fromAcc.currency as CurrencyCode) || 'IDR'
  const toCurrency = (toAcc.currency as CurrencyCode) || 'IDR'

  let rate = input.exchangeRateUsed || 1
  if (fromCurrency === toCurrency) {
    rate = 1
  }

  // 3. Execute Transfer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('transfers') as any)
    .insert({
      user_id: user.id,
      from_account_id: input.fromAccountId,
      to_account_id: input.toAccountId,
      amount: input.amount,
      from_currency: fromCurrency,
      to_currency: toCurrency,
      exchange_rate_used: rate,
      description: input.description?.trim() || null,
      transfer_date: input.transferDate || new Date().toISOString(),
    })
    .select(`*, from_account:accounts!transfers_from_account_id_fkey(*), to_account:accounts!transfers_to_account_id_fkey(*)`)
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/accounts')
  revalidatePath('/dashboard')
  revalidatePath('/')
  return { data }
}

export async function deleteTransfer(id: string) {
  const supabase = await createServerSupabaseClient()

  // 1. Fetch Transfer before delete to check receiver balance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: transfer, error: tErr } = await (supabase.from('transfers') as any)
    .select('*, to_account:accounts!transfers_to_account_id_fkey(*)')
    .eq('id', id)
    .single()

  if (tErr || !transfer) {
    return { error: 'Data transfer tidak ditemukan' }
  }

  if (transfer.to_account) {
    const toBal = Number(transfer.to_account.current_balance) || 0
    const inAmount = Number(transfer.amount) * (Number(transfer.exchange_rate_used) || 1)
    if (toBal - inAmount < 0) {
      return {
        error: `Gagal membatalkan transfer: Saldo akun penerima (${transfer.to_account.name}) saat ini tidak mencukupi untuk menarik kembali dana sebesar ${formatCurrency(inAmount, transfer.to_currency)}.`,
      }
    }
  }

  const { error } = await supabase.from('transfers').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/accounts')
  revalidatePath('/dashboard')
  revalidatePath('/')
  return { success: true }
}
