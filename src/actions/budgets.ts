'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { EnrichedBudget, Category } from '@/types/database'
import { budgetSchema } from '@/lib/validations/budget'
import { endOfMonth, parseISO, format } from 'date-fns'

export async function getBudgetsWithActuals(periodStartDate: string): Promise<EnrichedBudget[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  // 1. Get all expense categories
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('type', 'expense')
    .order('name', { ascending: true })

  if (!categories || categories.length === 0) return []

  // 2. Get budgets for this period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: budgets } = await (supabase.from('budgets') as any)
    .select('*')
    .eq('period_start_date', periodStartDate)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const budgetMap = new Map((budgets || []).map((b: any) => [b.category_id, b]))

  // 3. Get transactions for this month range
  const startDate = `${periodStartDate}T00:00:00.000Z`
  const endDate = `${format(endOfMonth(parseISO(periodStartDate)), 'yyyy-MM-dd')}T23:59:59.999Z`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: txs } = await (supabase.from('transactions') as any)
    .select('category_id, amount, type')
    .eq('type', 'expense')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)

  const actualSpentMap = new Map<string, number>()
  if (txs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of txs as any[]) {
      const current = actualSpentMap.get(t.category_id) || 0
      actualSpentMap.set(t.category_id, current + Number(t.amount))
    }
  }

  // Combine
  const result: EnrichedBudget[] = (categories as Category[]).map(cat => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingBudget = budgetMap.get(cat.id) as any
    return {
      id: existingBudget?.id || `virtual-${cat.id}`,
      user_id: user.id,
      category_id: cat.id,
      amount: existingBudget ? Number(existingBudget.amount) : 0,
      period_start_date: periodStartDate,
      created_at: existingBudget?.created_at || new Date().toISOString(),
      category: cat,
      actual_spent: actualSpentMap.get(cat.id) || 0,
    }
  })

  return result
}

export async function setBudget(input: {
  categoryId: string
  amount: number
  periodStartDate: string
}) {
  const validation = budgetSchema.safeParse(input)
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
  const { data, error } = await (supabase.from('budgets') as any)
    .upsert({
      user_id: user.id,
      category_id: input.categoryId,
      amount: input.amount,
      period_start_date: input.periodStartDate,
    }, { onConflict: 'user_id, category_id, period_start_date' })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/budget')
  revalidatePath('/')
  return { data }
}

export interface CategoryHistoryItem {
  periodStart: string
  periodLabel: string
  budgetAmount: number
  actualSpent: number
}

export async function getCategoryBudgetHistory(categoryId: string, monthsCount: number = 6): Promise<CategoryHistoryItem[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const history: CategoryHistoryItem[] = []
  const { getPreviousMonths } = await import('@/lib/utils/date')
  const months = getPreviousMonths(monthsCount)

  for (const m of months) {
    // 1. Budget
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: budget } = await (supabase.from('budgets') as any)
      .select('amount')
      .eq('category_id', categoryId)
      .eq('period_start_date', m.periodStart)
      .maybeSingle()

    // 2. Spending
    const startDate = `${m.periodStart}T00:00:00.000Z`
    const endDate = `${format(endOfMonth(parseISO(m.periodStart)), 'yyyy-MM-dd')}T23:59:59.999Z`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: txs } = await (supabase.from('transactions') as any)
      .select('amount')
      .eq('category_id', categoryId)
      .eq('type', 'expense')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spent = (txs || []).reduce((acc: number, t: any) => acc + Number(t.amount), 0)

    history.push({
      periodStart: m.periodStart,
      periodLabel: m.label,
      budgetAmount: budget ? Number(budget.amount) : 0,
      actualSpent: spent,
    })
  }

  return history
}
