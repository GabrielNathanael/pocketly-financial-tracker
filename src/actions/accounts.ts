'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Account, AccountType, CurrencyCode } from '@/types/database'
import { accountSchema } from '@/lib/validations/account'
import { getCleanDescription, getCleanTransferDescription } from '@/lib/utils/description'

export async function getAccounts(): Promise<Account[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching accounts:', error)
    return []
  }

  return (data as Account[]) || []
}

export async function getAccountById(id: string): Promise<Account | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Account
}

export async function createAccount(input: {
  name: string
  type: AccountType
  currency: CurrencyCode
  initialBalance: number
  icon?: string | null
  color?: string | null
}) {
  const validation = accountSchema.safeParse(input)
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
  const { data, error } = await (supabase.from('accounts') as any).insert({
    user_id: user.id,
    name: input.name.trim(),
    type: input.type,
    currency: input.currency,
    initial_balance: input.initialBalance,
    current_balance: input.initialBalance,
    icon: input.icon || 'Wallet',
    color: input.color || '#3B82F6',
    is_active: true,
  }).select().single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/accounts')
  revalidatePath('/')
  return { data }
}

export async function updateAccount(
  id: string,
  input: {
    name: string
    type: AccountType
    currency: CurrencyCode
    initialBalance: number
    icon?: string | null
    color?: string | null
    isActive?: boolean
  }
) {
  const supabase = await createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('accounts') as any)
    .update({
      name: input.name.trim(),
      type: input.type,
      currency: input.currency,
      icon: input.icon,
      color: input.color,
      is_active: input.isActive ?? true,
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/accounts')
  revalidatePath(`/accounts/${id}`)
  revalidatePath('/')
  return { success: true }
}

export async function deleteAccount(id: string) {
  const supabase = await createServerSupabaseClient()

  const { count: txCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', id)

  if (txCount && txCount > 0) {
    return {
      error: `Akun ini tidak dapat dihapus karena masih memiliki ${txCount} riwayat transaksi. Hapus atau pindahkan riwayat transaksi terlebih dahulu.`,
    }
  }

  const { error } = await supabase.from('accounts').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/accounts')
  revalidatePath('/')
  return { success: true }
}

export interface AccountMutation {
  id: string
  date: string
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out'
  amount: number
  currency: string
  title: string
  description?: string | null
  counterpartyOrCategory?: string
  color?: string | null
  icon?: string | null
  isCross?: boolean
  exchangeRateUsed?: number
  counterpartyCurrency?: string
  receivedAmount?: number
}

export async function adjustAccountBalance(input: {
  accountId: string
  newRealBalance: number
  notes?: string | null
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // 1. Fetch current account
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: account, error: accErr } = await (supabase.from('accounts') as any)
    .select('id, name, currency, current_balance')
    .eq('id', input.accountId)
    .single()

  if (accErr || !account) {
    return { error: 'Account not found' }
  }

  const currentBal = Number(account.current_balance) || 0
  const targetBal = Number(input.newRealBalance)
  const diff = targetBal - currentBal

  if (Math.abs(diff) < 0.0001) {
    return { error: 'Saldo riil sama dengan saldo tercatat (tidak ada selisih).' }
  }

  // 2. Find or create Discrepancy category matching the transaction type
  const txType = diff > 0 ? 'income' : 'expense'
  const absAmount = Math.abs(diff)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: cat } = await (supabase.from('categories') as any)
    .select('id')
    .eq('user_id', user.id)
    .eq('name', 'Discrepancy')
    .eq('type', txType)
    .limit(1)
    .maybeSingle()

  if (!cat) {
    // Fallback: look for generic Discrepancy regardless of type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: genericCat } = await (supabase.from('categories') as any)
      .select('id')
      .eq('user_id', user.id)
      .eq('name', 'Discrepancy')
      .limit(1)
      .maybeSingle()

    cat = genericCat
  }

  if (!cat) {
    // Fallback: look for Other Income / Other Expense
    const fallbackName = txType === 'income' ? 'Other Income' : 'Other Expense'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fallbackCat } = await (supabase.from('categories') as any)
      .select('id')
      .eq('user_id', user.id)
      .eq('name', fallbackName)
      .limit(1)
      .maybeSingle()

    cat = fallbackCat
  }

  if (!cat) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: anyCat } = await (supabase.from('categories') as any)
      .select('id')
      .eq('user_id', user.id)
      .eq('type', txType)
      .limit(1)
      .maybeSingle()
    cat = anyCat
  }

  // 3. Create adjustment transaction
  const noteSuffix = input.notes?.trim() ? ` - ${input.notes.trim()}` : ''
  const desc = `Koreksi Saldo Fisik (${account.name})${noteSuffix}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: txErr } = await (supabase.from('transactions') as any).insert({
    user_id: user.id,
    account_id: account.id,
    category_id: cat?.id || null,
    type: txType,
    amount: absAmount,
    currency: account.currency,
    description: desc,
    transaction_date: new Date().toISOString(),
  })

  if (txErr) {
    return { error: txErr.message }
  }

  revalidatePath('/accounts')
  revalidatePath(`/accounts/${input.accountId}`)
  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  revalidatePath('/reports')
  revalidatePath('/net-worth')
  revalidatePath('/')

  return { success: true, diff }
}

export async function getAccountMutations(accountId: string): Promise<AccountMutation[]> {
  const supabase = await createServerSupabaseClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: txs } = await (supabase.from('transactions') as any)
    .select('id, amount, currency, type, description, transaction_date, categories(name, icon, color)')
    .eq('account_id', accountId)
    .order('transaction_date', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: transfersOut } = await (supabase.from('transfers') as any)
    .select('id, amount, from_currency, to_currency, exchange_rate_used, description, transfer_date, to_account:accounts!transfers_to_account_id_fkey(name)')
    .eq('from_account_id', accountId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: transfersIn } = await (supabase.from('transfers') as any)
    .select('id, amount, from_currency, to_currency, exchange_rate_used, description, transfer_date, from_account:accounts!transfers_from_account_id_fkey(name)')
    .eq('to_account_id', accountId)

  const mutations: AccountMutation[] = []

  if (txs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of txs as any[]) {
      const cat = t.categories
      mutations.push({
        id: t.id,
        date: t.transaction_date,
        type: t.type as 'income' | 'expense',
        amount: Number(t.amount),
        currency: t.currency,
        title: cat?.name || (t.type === 'income' ? 'Income' : 'Expense'),
        description: getCleanDescription(t.description),
        counterpartyOrCategory: cat?.name,
        color: cat?.color,
        icon: cat?.icon,
      })
    }
  }

  if (transfersOut) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of transfersOut as any[]) {
      const toAcc = t.to_account
      const isCross = t.from_currency !== t.to_currency
      const rate = Number(t.exchange_rate_used) || 1
      const receivedAmt = Number(t.amount) * rate
      mutations.push({
        id: t.id,
        date: t.transfer_date,
        type: 'transfer_out',
        amount: Number(t.amount),
        currency: t.from_currency,
        title: isCross ? `Tukar Valas ke ${toAcc?.name || 'Akun'}` : `Transfer ke ${toAcc?.name || 'Akun'}`,
        description: getCleanTransferDescription(t.description),
        counterpartyOrCategory: toAcc?.name || 'Akun',
        color: '#6366F1',
        icon: 'ArrowUpRight',
        isCross,
        exchangeRateUsed: rate,
        counterpartyCurrency: t.to_currency,
        receivedAmount: receivedAmt,
      })
    }
  }

  if (transfersIn) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of transfersIn as any[]) {
      const fromAcc = t.from_account
      const isCross = t.from_currency !== t.to_currency
      const rate = Number(t.exchange_rate_used) || 1
      const inAmount = Number(t.amount) * rate
      mutations.push({
        id: t.id,
        date: t.transfer_date,
        type: 'transfer_in',
        amount: inAmount,
        currency: t.to_currency,
        title: isCross ? `Tukar Valas dari ${fromAcc?.name || 'Akun'}` : `Transfer dari ${fromAcc?.name || 'Akun'}`,
        description: getCleanTransferDescription(t.description),
        counterpartyOrCategory: fromAcc?.name || 'Akun',
        color: '#10B981',
        icon: 'ArrowDownLeft',
        isCross,
        exchangeRateUsed: rate,
        counterpartyCurrency: t.from_currency,
        receivedAmount: inAmount,
      })
    }
  }

  return mutations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
