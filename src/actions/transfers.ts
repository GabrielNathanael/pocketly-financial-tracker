'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { EnrichedTransfer, CurrencyCode } from '@/types/database'
import { transferSchema } from '@/lib/validations/transfer'

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fromAcc } = await (supabase.from('accounts') as any).select('currency').eq('id', input.fromAccountId).single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: toAcc } = await (supabase.from('accounts') as any).select('currency').eq('id', input.toAccountId).single()

  const fromCurrency = (fromAcc?.currency as CurrencyCode) || 'IDR'
  const toCurrency = (toAcc?.currency as CurrencyCode) || 'IDR'

  let rate = input.exchangeRateUsed || 1
  if (fromCurrency === toCurrency) {
    rate = 1
  }

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
  revalidatePath('/')
  return { data }
}

export async function deleteTransfer(id: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('transfers').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/accounts')
  revalidatePath('/')
  return { success: true }
}
