'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { EnrichedRecurringTransaction } from '@/types/database'
import { recurringTransactionSchema, RecurringTransactionInput } from '@/lib/validations/recurring'
import { processOneRecurringPeriod } from '@/lib/recurring/process-due-recurring'
import { getTodayDateStringInTimeZone } from '@/lib/utils/date'
import { getUserTimeZone } from '@/lib/utils/timezone-server'

/**
 * Fetch all recurring transactions for the current user with joined account and category data
 */
export async function getRecurringTransactions(): Promise<EnrichedRecurringTransaction[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('recurring_transactions') as any)
    .select(`
      *,
      account:accounts(*),
      category:categories(*)
    `)
    .eq('user_id', user.id)
    .order('next_due_date', { ascending: true })

  if (error) {
    console.error('Error fetching recurring transactions:', error)
    return []
  }

  return (data as EnrichedRecurringTransaction[]) || []
}

/**
 * Create a new recurring transaction schedule
 */
export async function createRecurringTransaction(input: RecurringTransactionInput) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const validated = recurringTransactionSchema.safeParse(input)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('recurring_transactions') as any)
    .insert({
      user_id: user.id,
      name: validated.data.name,
      type: validated.data.type,
      amount: validated.data.amount,
      currency: validated.data.currency,
      account_id: validated.data.accountId,
      category_id: validated.data.categoryId || null,
      frequency: validated.data.frequency,
      interval_count: validated.data.intervalCount || 1,
      start_date: validated.data.startDate,
      next_due_date: validated.data.nextDueDate,
      end_date: validated.data.endDate || null,
      is_active: validated.data.isActive,
      auto_process: validated.data.autoProcess,
      notes: validated.data.notes || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating recurring transaction:', error)
    return { error: error.message }
  }

  revalidatePath('/recurring')
  revalidatePath('/dashboard')
  return { success: true, data }
}

/**
 * Update an existing recurring transaction schedule
 */
export async function updateRecurringTransaction(id: string, input: Partial<RecurringTransactionInput>) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const updateData: Record<string, unknown> = {}
  if (input.name !== undefined) updateData.name = input.name
  if (input.type !== undefined) updateData.type = input.type
  if (input.amount !== undefined) updateData.amount = input.amount
  if (input.currency !== undefined) updateData.currency = input.currency
  if (input.accountId !== undefined) updateData.account_id = input.accountId
  if (input.categoryId !== undefined) updateData.category_id = input.categoryId || null
  if (input.frequency !== undefined) updateData.frequency = input.frequency
  if (input.intervalCount !== undefined) updateData.interval_count = input.intervalCount
  if (input.startDate !== undefined) updateData.start_date = input.startDate
  if (input.nextDueDate !== undefined) updateData.next_due_date = input.nextDueDate
  if (input.endDate !== undefined) updateData.end_date = input.endDate || null
  if (input.isActive !== undefined) updateData.is_active = input.isActive
  if (input.autoProcess !== undefined) updateData.auto_process = input.autoProcess
  if (input.notes !== undefined) updateData.notes = input.notes || null
  updateData.updated_at = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('recurring_transactions') as any)
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating recurring transaction:', error)
    return { error: error.message }
  }

  revalidatePath('/recurring')
  revalidatePath('/dashboard')
  return { success: true, data }
}

/**
 * Delete a recurring transaction schedule
 */
export async function deleteRecurringTransaction(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('recurring_transactions') as any)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting recurring transaction:', error)
    return { error: error.message }
  }

  revalidatePath('/recurring')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Pause / Resume a recurring transaction schedule
 */
export async function toggleRecurringActive(id: string, isActive: boolean) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('recurring_transactions') as any)
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error toggling recurring transaction status:', error)
    return { error: error.message }
  }

  revalidatePath('/recurring')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Execute/Pay a recurring transaction manually ("Pay Now").
 * Balance is maintained by the DB trigger on transaction INSERT —
 * do NOT update it here (that double-counted before).
 * Expense respects the non-negative balance guard, like createTransaction.
 */
export async function processRecurringPayment(id: string, executionDate?: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rule, error: ruleErr } = await (supabase.from('recurring_transactions') as any)
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (ruleErr || !rule) {
    return { error: 'Recurring schedule not found' }
  }

  const userTz = await getUserTimeZone()
  const overrideDate = executionDate || getTodayDateStringInTimeZone(userTz)

  const result = await processOneRecurringPeriod(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase as any,
    rule,
    userTz,
    overrideDate,
  )

  if (!result.ok) {
    if (result.reason === 'no_category') {
      return { error: 'Kategori belum diatur untuk jadwal ini. Atur kategori dulu sebelum membayar.' }
    }
    if (result.reason === 'no_account') {
      return { error: 'Linked source account not found' }
    }
    if (result.reason === 'insufficient_balance') {
      return { error: 'Saldo tidak mencukupi untuk membayar jadwal ini.' }
    }
    console.error('Error processing recurring payment:', result.error)
    return { error: result.error || 'Gagal memproses pembayaran recurring' }
  }

  revalidatePath('/recurring')
  revalidatePath('/transactions')
  revalidatePath('/accounts')
  revalidatePath('/dashboard')
  revalidatePath('/reports')
  revalidatePath('/net-worth')

  return { success: true, transaction: { id: result.transactionId } }
}

/**
 * Fetch payment / transaction history linked to a recurring subscription or bill
 */
export async function getRecurringPaymentHistory(recurringName: string, categoryId?: string, accountId?: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('transactions') as any)
    .select(`
      *,
      account:accounts(id, name, currency, icon),
      category:categories(id, name, icon, color)
    `)
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })
    .limit(30)

  if (recurringName) {
    query = query.ilike('description', `%${recurringName.trim()}%`)
  } else if (categoryId && accountId) {
    query = query.eq('category_id', categoryId).eq('account_id', accountId)
  }

  const { data, error } = await query
  if (error) {
    console.error('Error fetching recurring payment history:', error)
    return []
  }
  return data || []
}
