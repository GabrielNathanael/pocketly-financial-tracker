'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function exportAllFinancialData(): Promise<{
  csvTransactions: string
  csvAccounts: string
  csvDebts: string
  jsonData: string
}> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [txsRes, accsRes, debtsRes, budgetsRes, catsRes] = await Promise.all([
    (supabase.from('transactions') as any)
      .select('*, account:accounts(name), category:categories(name)')
      .order('transaction_date', { ascending: false }),
    (supabase.from('accounts') as any).select('*').order('created_at', { ascending: true }),
    (supabase.from('debts') as any).select('*, payments:debt_payments(*)').order('created_at', { ascending: false }),
    (supabase.from('budgets') as any).select('*, category:categories(name)'),
    (supabase.from('categories') as any).select('*'),
  ])

  const transactions = txsRes.data || []
  const accounts = accsRes.data || []
  const debts = debtsRes.data || []
  const budgets = budgetsRes.data || []
  const categories = catsRes.data || []

  // 1. Generate Transactions CSV
  let csvTransactions = 'ID,Date,Type,Amount,Currency,Account,Category,Description,Created_At\n'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of transactions as any[]) {
    const desc = t.description ? `"${t.description.replace(/"/g, '""')}"` : '""'
    const accName = t.account?.name ? `"${t.account.name.replace(/"/g, '""')}"` : '""'
    const catName = t.category?.name ? `"${t.category.name.replace(/"/g, '""')}"` : '""'
    csvTransactions += `${t.id},${t.transaction_date},${t.type},${t.amount},${t.currency},${accName},${catName},${desc},${t.created_at}\n`
  }

  // 2. Generate Accounts CSV
  let csvAccounts = 'ID,Name,Type,Currency,Current_Balance,Initial_Balance,Is_Active\n'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const a of accounts as any[]) {
    const name = `"${a.name.replace(/"/g, '""')}"`
    csvAccounts += `${a.id},${name},${a.type},${a.currency},${a.current_balance},${a.initial_balance},${a.is_active}\n`
  }

  // 3. Generate Debts CSV
  let csvDebts = 'ID,Counterparty,Type,Principal_Amount,Remaining_Amount,Currency,Status,Due_Date,Notes\n'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of debts as any[]) {
    const party = `"${d.counterparty_name.replace(/"/g, '""')}"`
    const notes = d.notes ? `"${d.notes.replace(/"/g, '""')}"` : '""'
    csvDebts += `${d.id},${party},${d.type},${d.initial_amount},${d.remaining_amount},${d.currency},${d.status},${d.due_date || ''},${notes}\n`
  }

  // 4. Generate JSON Data
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    userEmail: user.email,
    accounts,
    categories,
    transactions,
    budgets,
    debts,
  }

  return {
    csvTransactions,
    csvAccounts,
    csvDebts,
    jsonData: JSON.stringify(exportPayload, null, 2),
  }
}
