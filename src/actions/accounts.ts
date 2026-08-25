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
    .select('id, amount, from_currency, description, transfer_date, to_account:accounts!transfers_to_account_id_fkey(name)')
    .eq('from_account_id', accountId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: transfersIn } = await (supabase.from('transfers') as any)
    .select('id, amount, to_currency, exchange_rate_used, description, transfer_date, from_account:accounts!transfers_from_account_id_fkey(name)')
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
      mutations.push({
        id: t.id,
        date: t.transfer_date,
        type: 'transfer_out',
        amount: Number(t.amount),
        currency: t.from_currency,
        title: isCross ? `Tukar Valas ke ${toAcc?.name || 'Akun'}` : `Transfer ke ${toAcc?.name || 'Akun'}`,
        description: getCleanTransferDescription(t.description),
        counterpartyOrCategory: toAcc?.name,
        color: '#6366F1',
        icon: 'ArrowUpRight',
      })
    }
  }

  if (transfersIn) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of transfersIn as any[]) {
      const fromAcc = t.from_account
      const inAmount = Number(t.amount) * (Number(t.exchange_rate_used) || 1)
      const isCross = t.from_currency !== t.to_currency
      mutations.push({
        id: t.id,
        date: t.transfer_date,
        type: 'transfer_in',
        amount: inAmount,
        currency: t.to_currency,
        title: isCross ? `Tukar Valas dari ${fromAcc?.name || 'Akun'}` : `Transfer dari ${fromAcc?.name || 'Akun'}`,
        description: getCleanTransferDescription(t.description),
        counterpartyOrCategory: fromAcc?.name,
        color: '#10B981',
        icon: 'ArrowDownLeft',
      })
    }
  }

  return mutations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
