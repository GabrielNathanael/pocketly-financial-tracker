'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { EnrichedSavingsGoal, GoalStatus } from '@/types/database'
import { savingsGoalSchema, goalDepositSchema, SavingsGoalInput, GoalDepositInput } from '@/lib/validations/goal'

/**
 * Fetch all savings goals with category and deposit history
 */
export async function getSavingsGoals(): Promise<EnrichedSavingsGoal[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('savings_goals') as any)
    .select(`
      *,
      category:categories(*),
      deposits:savings_goal_deposits(
        *,
        account:accounts(*)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching savings goals:', error)
    return []
  }

  // Sort deposits descending by date inside each goal
  const goals = (data as EnrichedSavingsGoal[]) || []
  goals.forEach((g) => {
    if (g.deposits) {
      g.deposits.sort((a, b) => (b.deposit_date > a.deposit_date ? 1 : -1))
    }
  })

  return goals
}

/**
 * Create a new savings goal
 */
export async function createSavingsGoal(input: SavingsGoalInput) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const validated = savingsGoalSchema.safeParse(input)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  const initialCurrent = Math.max(0, validated.data.initialSaved || 0)
  const isCompleted = initialCurrent >= validated.data.targetAmount

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('savings_goals') as any)
    .insert({
      user_id: user.id,
      name: validated.data.name,
      target_amount: validated.data.targetAmount,
      current_amount: initialCurrent,
      currency: validated.data.currency,
      target_date: validated.data.targetDate,
      category_id: validated.data.categoryId || null,
      icon: validated.data.icon || 'Target',
      color: validated.data.color || '#0D9488',
      status: isCompleted ? 'completed' : validated.data.status || 'in_progress',
      notes: validated.data.notes || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating savings goal:', error)
    return { error: error.message }
  }

  // If initial saved > 0, log an initial deposit history record
  if (initialCurrent > 0 && data?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('savings_goal_deposits') as any).insert({
      user_id: user.id,
      goal_id: data.id,
      type: 'deposit',
      amount: initialCurrent,
      currency: validated.data.currency,
      notes: 'Initial balance',
    })
  }

  revalidatePath('/goals')
  revalidatePath('/dashboard')
  return { success: true, data }
}

/**
 * Update an existing savings goal
 */
export async function updateSavingsGoal(id: string, input: Partial<SavingsGoalInput>) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const updateData: Record<string, unknown> = {}
  if (input.name !== undefined) updateData.name = input.name
  if (input.targetAmount !== undefined) updateData.target_amount = input.targetAmount
  if (input.currency !== undefined) updateData.currency = input.currency
  if (input.targetDate !== undefined) updateData.target_date = input.targetDate
  if (input.categoryId !== undefined) updateData.category_id = input.categoryId || null
  if (input.icon !== undefined) updateData.icon = input.icon
  if (input.color !== undefined) updateData.color = input.color
  if (input.status !== undefined) updateData.status = input.status
  if (input.notes !== undefined) updateData.notes = input.notes || null
  updateData.updated_at = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('savings_goals') as any)
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating savings goal:', error)
    return { error: error.message }
  }

  revalidatePath('/goals')
  revalidatePath('/dashboard')
  return { success: true, data }
}

/**
 * Delete a savings goal
 */
export async function deleteSavingsGoal(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // 1. Fetch goal before delete
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: goal } = await (supabase.from('savings_goals') as any)
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  // 2. Delete linked transactions by Ref tag
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('transactions') as any)
    .delete()
    .eq('user_id', user.id)
    .ilike('description', `%[Ref:goal-${id}]%`)

  // Fallback: search by goal name pattern
  if (goal) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('transactions') as any)
      .delete()
      .eq('user_id', user.id)
      .or(`description.ilike.%Alokasi Tabungan: ${goal.name}%,description.ilike.%Penarikan Tabungan: ${goal.name}%`)
  }

  // 3. Delete the savings goal (savings_goal_deposits cascade-deleted)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('savings_goals') as any)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting savings goal:', error)
    return { error: error.message }
  }

  revalidatePath('/goals')
  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  revalidatePath('/accounts')
  revalidatePath('/net-worth')
  revalidatePath('/reports')
  return { success: true }
}

/**
 * Deposit or Withdraw funds from a savings goal
 */
export async function recordGoalDeposit(input: GoalDepositInput) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const validated = goalDepositSchema.safeParse(input)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Invalid input' }
  }

  const { goalId, accountId, type, amount, currency, depositDate, notes } = validated.data

  // 1. Fetch Goal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: goal, error: goalErr } = await (supabase.from('savings_goals') as any)
    .select('*')
    .eq('id', goalId)
    .eq('user_id', user.id)
    .single()

  if (goalErr || !goal) {
    return { error: 'Target tabungan tidak ditemukan' }
  }

  // 2. Fetch Account
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: account, error: accErr } = await (supabase.from('accounts') as any)
    .select('*')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single()

  if (accErr || !account) {
    return { error: 'Akun sumber/tujuan tidak ditemukan' }
  }

  // Currency matching check
  if (account.currency !== currency) {
    return {
      error: `Mata uang akun (${account.currency}) tidak sesuai dengan setoran (${currency})`,
    }
  }

  // If deposit, check account balance sufficiency
  if (type === 'deposit') {
    const currentBalance = Number(account.current_balance)
    if (currentBalance < amount) {
      return {
        error: `Saldo akun ${account.name} tidak mencukupi (${account.currency} ${currentBalance.toLocaleString()})`,
      }
    }
  }

  // If withdraw, check goal current amount sufficiency
  const currentGoalAmount = Number(goal.current_amount)
  if (type === 'withdraw') {
    if (currentGoalAmount < amount) {
      return {
        error: `Saldo tabungan saat ini (${goal.currency} ${currentGoalAmount.toLocaleString()}) tidak mencukupi untuk penarikan sebesar ${currency} ${amount.toLocaleString()}`,
      }
    }
  }

  const newGoalAmount =
    type === 'deposit' ? currentGoalAmount + amount : currentGoalAmount - amount
  const targetAmount = Number(goal.target_amount)

  let newStatus: GoalStatus = goal.status
  if (type === 'deposit' && newGoalAmount >= targetAmount) {
    newStatus = 'completed'
  } else if (type === 'withdraw' && newGoalAmount < targetAmount && goal.status === 'completed') {
    newStatus = 'in_progress'
  }

  // 3. Insert record into savings_goal_deposits
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: depositErr } = await (supabase.from('savings_goal_deposits') as any).insert({
    user_id: user.id,
    goal_id: goalId,
    account_id: accountId,
    type,
    amount,
    currency,
    deposit_date: depositDate,
    notes: notes || null,
  })

  if (depositErr) {
    console.error('Error inserting savings goal deposit:', depositErr)
    return { error: depositErr.message }
  }

  // 4. Update savings_goals current_amount and status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('savings_goals') as any)
    .update({
      current_amount: newGoalAmount,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', goalId)

  // 5. Always record transaction mutation linked to Savings system category
  const isDeposit = type === 'deposit'
  const txType = isDeposit ? 'expense' : 'income'
  const desc = isDeposit
    ? `Alokasi Tabungan: ${goal.name}`
    : `Penarikan Tabungan: ${goal.name}`

  // Look up dedicated Savings system category matching txType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: savingsCat } = await (supabase.from('categories') as any)
    .select('id')
    .eq('user_id', user.id)
    .eq('name', 'Savings')
    .eq('type', txType)
    .limit(1)
    .maybeSingle()

  if (!savingsCat) {
    // Fallback: look for Tabungan
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fallbackCat } = await (supabase.from('categories') as any)
      .select('id')
      .eq('user_id', user.id)
      .in('name', ['Savings', 'Tabungan', 'Alokasi Tabungan'])
      .eq('type', txType)
      .limit(1)
      .maybeSingle()
    savingsCat = fallbackCat
  }

  const fullDesc = `${notes ? `${desc} • ${notes}` : desc} [Ref:goal-${goal.id}]`

  // Insert transaction (database trigger automatically handles balance update)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('transactions') as any).insert({
    user_id: user.id,
    account_id: accountId,
    category_id: savingsCat?.id || null,
    type: txType,
    amount,
    currency,
    description: fullDesc,
    transaction_date: `${depositDate}T12:00:00.000Z`,
  })

  // Update account balance
  const balanceDelta = isDeposit ? -amount : amount
  const updatedBalance = Number(account.current_balance) + balanceDelta
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('accounts') as any)
    .update({ current_balance: updatedBalance })
    .eq('id', accountId)

  revalidatePath('/goals')
  revalidatePath('/dashboard')
  revalidatePath('/accounts')
  revalidatePath('/transactions')
  revalidatePath('/reports')
  revalidatePath('/net-worth')

  return { success: true, newAmount: newGoalAmount, status: newStatus }
}
