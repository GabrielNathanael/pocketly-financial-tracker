'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AuditLog, EnrichedTransaction, TransactionType, CurrencyCode } from '@/types/database'
import { transactionSchema } from '@/lib/validations/transaction'
import { formatCurrency } from '@/lib/utils/currency'

export interface TransactionFilterParams {
  categoryId?: string
  accountId?: string
  type?: TransactionType | 'all'
  startDate?: string
  endDate?: string
  search?: string
  tag?: string
  sort?: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'
  limit?: number
}

export async function getTransactions(params: TransactionFilterParams = {}): Promise<EnrichedTransaction[]> {
  const supabase = await createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('transactions') as any)
    .select(`
      *,
      account:accounts(*),
      category:categories(*)
    `)

  if (params.accountId && params.accountId !== 'all') {
    query = query.eq('account_id', params.accountId)
  }

  if (params.categoryId && params.categoryId !== 'all') {
    query = query.eq('category_id', params.categoryId)
  }

  if (params.type && params.type !== 'all') {
    query = query.eq('type', params.type)
  }

  if (params.tag && params.tag !== 'all') {
    const cleanTag = params.tag.replace(/^#/, '').toLowerCase().trim()
    query = query.contains('tags', [cleanTag])
  }

  if (params.startDate) {
    query = query.gte('transaction_date', `${params.startDate}T00:00:00.000Z`)
  }

  if (params.endDate) {
    query = query.lte('transaction_date', `${params.endDate}T23:59:59.999Z`)
  }

  if (params.search && params.search.trim()) {
    query = query.ilike('description', `%${params.search.trim()}%`)
  }

  switch (params.sort) {
    case 'date_asc':
      query = query.order('transaction_date', { ascending: true })
      break
    case 'amount_desc':
      query = query.order('amount', { ascending: false })
      break
    case 'amount_asc':
      query = query.order('amount', { ascending: true })
      break
    case 'date_desc':
    default:
      query = query.order('transaction_date', { ascending: false })
      break
  }

  if (params.limit) {
    query = query.limit(params.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching transactions:', error)
    return []
  }

  return (data as unknown as EnrichedTransaction[]) || []
}

export async function getTransactionById(id: string): Promise<EnrichedTransaction | null> {
  const supabase = await createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('transactions') as any)
    .select(`
      *,
      account:accounts(*),
      category:categories(*)
    `)
    .eq('id', id)
    .single()

  if (error) return null
  return data as unknown as EnrichedTransaction
}

function extractTags(description?: string | null, explicitTags?: string[]): string[] {
  const set = new Set<string>()
  if (explicitTags && Array.isArray(explicitTags)) {
    explicitTags.forEach((t) => {
      const clean = t.replace(/^#/, '').toLowerCase().trim()
      if (clean) set.add(clean)
    })
  }
  if (description) {
    const hashMatches = description.match(/#[a-zA-Z0-9_\-]+/g)
    if (hashMatches) {
      hashMatches.forEach((t) => {
        const clean = t.replace(/^#/, '').toLowerCase().trim()
        if (clean) set.add(clean)
      })
    }
  }
  return Array.from(set)
}

export async function createTransaction(input: {
  accountId: string
  categoryId: string
  type: TransactionType
  amount: number
  currency?: CurrencyCode
  description?: string | null
  tags?: string[]
  transactionDate: string
}) {
  const validation = transactionSchema.safeParse(input)
  if (!validation.success) {
    const firstIssue = validation.error.issues[0]
    return { error: firstIssue?.message || 'Invalid input' }
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Demo Account Safeguard: Cap at 50 transactions to prevent spam scripts
  if (user.email?.toLowerCase() === 'demo@pocketly.app') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase.from('transactions') as any)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (count && count >= 50) {
      return {
        error: 'Batas kuota akun demo tercapai (Maksimal 50 transaksi). Silakan hapus beberapa transaksi demo untuk mencoba menambah yang baru.',
      }
    }
  }

  // 1. Fetch Account Details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: acc, error: accError } = await (supabase.from('accounts') as any)
    .select('id, name, currency, current_balance')
    .eq('id', input.accountId)
    .single()

  if (accError || !acc) {
    return { error: 'Akun tidak ditemukan' }
  }

  const txCurrency = input.currency || (acc.currency as CurrencyCode) || 'IDR'
  const computedTags = extractTags(input.description, input.tags)

  // 2. Strict Non-Negative Balance Guard for Expense
  if (input.type === 'expense') {
    const currentBal = Number(acc.current_balance) || 0
    if (currentBal - input.amount < 0) {
      return {
        error: `Saldo ${acc.name} tidak mencukupi. (Tersedia: ${formatCurrency(currentBal, acc.currency)}, Dibutuhkan: ${formatCurrency(input.amount, acc.currency)})`,
      }
    }
  }

  // 3. Insert Transaction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('transactions') as any)
    .insert({
      user_id: user.id,
      account_id: input.accountId,
      category_id: input.categoryId,
      type: input.type,
      amount: input.amount,
      currency: txCurrency,
      description: input.description?.trim() || null,
      tags: computedTags,
      transaction_date: input.transactionDate || new Date().toISOString(),
    })
    .select(`*, category:categories(*), account:accounts(*)`)
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  revalidatePath('/')
  revalidatePath('/budget')
  revalidatePath('/accounts')
  revalidatePath('/audit-log')
  return { data }
}

export async function updateTransaction(
  id: string,
  input: {
    accountId: string
    categoryId: string
    type: TransactionType
    amount: number
    currency?: CurrencyCode
    description?: string | null
    tags?: string[]
    transactionDate: string
  }
) {
  const validation = transactionSchema.safeParse(input)
  if (!validation.success) {
    const firstIssue = validation.error.issues[0]
    return { error: firstIssue?.message || 'Invalid input' }
  }

  const supabase = await createServerSupabaseClient()

  // 1. Fetch Existing Transaction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: oldTx, error: oldTxErr } = await (supabase.from('transactions') as any)
    .select('*, account:accounts(*)')
    .eq('id', id)
    .single()

  if (oldTxErr || !oldTx) {
    return { error: 'Transaksi tidak ditemukan' }
  }

  // 2. Fetch Target Account
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: targetAcc, error: targetAccErr } = await (supabase.from('accounts') as any)
    .select('id, name, currency, current_balance')
    .eq('id', input.accountId)
    .single()

  if (targetAccErr || !targetAcc) {
    return { error: 'Akun tujuan tidak ditemukan' }
  }

  const computedTags = extractTags(input.description, input.tags)

  // 3. Strict Non-Negative Balance Guard
  const oldAmount = Number(oldTx.amount) || 0
  const newAmount = Number(input.amount) || 0

  if (oldTx.account_id === input.accountId) {
    // Same Account: Compute net delta
    const currentBal = Number(targetAcc.current_balance) || 0
    const oldEffect = oldTx.type === 'expense' ? -oldAmount : oldAmount
    const newEffect = input.type === 'expense' ? -newAmount : newAmount
    const delta = newEffect - oldEffect
    const projectedBal = currentBal + delta

    if (projectedBal < 0) {
      return {
        error: `Perubahan gagal: Saldo ${targetAcc.name} akan menjadi minus (${formatCurrency(projectedBal, targetAcc.currency)}).`,
      }
    }
  } else {
    // Different Account: Check old account and new account separately
    // Old account loses oldEffect
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: oldAcc } = await (supabase.from('accounts') as any)
      .select('id, name, currency, current_balance')
      .eq('id', oldTx.account_id)
      .single()

    if (oldAcc) {
      const oldBal = Number(oldAcc.current_balance) || 0
      const revertOldEffect = oldTx.type === 'income' ? -oldAmount : oldAmount
      if (oldBal + revertOldEffect < 0) {
        return {
          error: `Perubahan gagal: Saldo akun asal (${oldAcc.name}) akan menjadi minus jika transaksi dipindahkan.`,
        }
      }
    }

    // New account receives newEffect
    if (input.type === 'expense') {
      const targetBal = Number(targetAcc.current_balance) || 0
      if (targetBal - newAmount < 0) {
        return {
          error: `Perubahan gagal: Saldo akun tujuan (${targetAcc.name}) tidak mencukupi untuk pengeluaran ${formatCurrency(newAmount, targetAcc.currency)}.`,
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('transactions') as any)
    .update({
      account_id: input.accountId,
      category_id: input.categoryId,
      type: input.type,
      amount: input.amount,
      currency: input.currency || targetAcc.currency || 'IDR',
      description: input.description?.trim() || null,
      tags: computedTags,
      transaction_date: input.transactionDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/transactions')
  revalidatePath(`/transactions/${id}`)
  revalidatePath('/dashboard')
  revalidatePath('/')
  revalidatePath('/budget')
  revalidatePath('/accounts')
  revalidatePath('/audit-log')
  return { success: true }
}

export async function deleteTransaction(id: string) {
  const supabase = await createServerSupabaseClient()

  // 1. Fetch transaction and account before delete
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tx, error: txErr } = await (supabase.from('transactions') as any)
    .select('*, account:accounts(*)')
    .eq('id', id)
    .single()

  if (txErr || !tx) {
    return { error: 'Transaksi tidak ditemukan' }
  }

  // 2. Strict Guard: Deleting an Income transaction reduces account balance
  if (tx.type === 'income' && tx.account) {
    const currentBal = Number(tx.account.current_balance) || 0
    const txAmount = Number(tx.amount) || 0
    const projectedBal = currentBal - txAmount

    if (projectedBal < 0) {
      return {
        error: `Gagal menghapus pemasukan: Saldo ${tx.account.name} saat ini (${formatCurrency(currentBal, tx.account.currency)}) tidak mencukupi untuk menarik kembali dana sebesar ${formatCurrency(txAmount, tx.account.currency)}.`,
      }
    }
  }

  const { error } = await supabase.from('transactions').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  revalidatePath('/')
  revalidatePath('/budget')
  revalidatePath('/accounts')
  revalidatePath('/audit-log')
  return { success: true }
}

export async function getTransactionAuditLogs(transactionId: string): Promise<AuditLog[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('table_name', 'transactions')
    .eq('record_id', transactionId)
    .order('changed_at', { ascending: false })

  if (error) {
    console.error('Error fetching audit logs:', error)
    return []
  }

  return (data as unknown as AuditLog[]) || []
}

export async function getGlobalAuditLogs(limit: number = 100): Promise<AuditLog[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching global audit logs:', error)
    return []
  }

  return (data as unknown as AuditLog[]) || []
}

export async function getAllUserTags(): Promise<string[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('transactions') as any)
    .select('tags')
    .eq('user_id', user.id)

  if (error || !data) return []

  const tagSet = new Set<string>()
  data.forEach((row: { tags?: string[] }) => {
    if (Array.isArray(row.tags)) {
      row.tags.forEach((t) => tagSet.add(t))
    }
  })

  return Array.from(tagSet).sort()
}
