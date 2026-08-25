'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AuditLog, EnrichedTransaction, TransactionType, CurrencyCode } from '@/types/database'
import { transactionSchema } from '@/lib/validations/transaction'

export interface TransactionFilterParams {
  categoryId?: string
  accountId?: string
  type?: TransactionType | 'all'
  startDate?: string
  endDate?: string
  search?: string
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

export async function createTransaction(input: {
  accountId: string
  categoryId: string
  type: TransactionType
  amount: number
  currency?: CurrencyCode
  description?: string | null
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

  let txCurrency = input.currency
  if (!txCurrency) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: acc } = await (supabase.from('accounts') as any)
      .select('currency')
      .eq('id', input.accountId)
      .single()
    txCurrency = (acc?.currency as CurrencyCode) || 'IDR'
  }

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
      transaction_date: input.transactionDate || new Date().toISOString(),
    })
    .select(`*, category:categories(*), account:accounts(*)`)
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/transactions')
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
    transactionDate: string
  }
) {
  const validation = transactionSchema.safeParse(input)
  if (!validation.success) {
    const firstIssue = validation.error.issues[0]
    return { error: firstIssue?.message || 'Invalid input' }
  }

  const supabase = await createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('transactions') as any)
    .update({
      account_id: input.accountId,
      category_id: input.categoryId,
      type: input.type,
      amount: input.amount,
      currency: input.currency || 'IDR',
      description: input.description?.trim() || null,
      transaction_date: input.transactionDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/transactions')
  revalidatePath(`/transactions/${id}`)
  revalidatePath('/')
  revalidatePath('/budget')
  revalidatePath('/accounts')
  revalidatePath('/audit-log')
  return { success: true }
}

export async function deleteTransaction(id: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('transactions').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/transactions')
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
