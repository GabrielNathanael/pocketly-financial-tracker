'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Debt, DebtPayment, DebtType, DebtStatus, CurrencyCode } from '@/types/database'
import { debtSchema, debtPaymentSchema } from '@/lib/validations/debt'

export interface EnrichedDebtPayment extends DebtPayment {
  transaction?: {
    id: string
    account_id: string
  } | null
}

export interface EnrichedDebtWithPayments extends Debt {
  payments: EnrichedDebtPayment[]
}

export async function getDebts(typeFilter?: DebtType | 'all', statusFilter?: DebtStatus | 'all'): Promise<EnrichedDebtWithPayments[]> {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('debts')
    .select(`
      *,
      payments:debt_payments(
        *,
        transaction:transactions(id, account_id)
      )
    `)
    .order('created_at', { ascending: false })

  if (typeFilter && typeFilter !== 'all') {
    query = query.eq('type', typeFilter)
  }

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching debts:', error)
    return []
  }

  return (data as unknown as EnrichedDebtWithPayments[]) || []
}

export async function getDebtById(id: string): Promise<EnrichedDebtWithPayments | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('debts')
    .select(`
      *,
      payments:debt_payments(
        *,
        transaction:transactions(id, account_id)
      )
    `)
    .eq('id', id)
    .single()

  if (error) return null
  return data as unknown as EnrichedDebtWithPayments
}

export async function createDebt(input: {
  type: DebtType
  counterpartyName: string
  initialAmount: number
  currency?: CurrencyCode
  dueDate?: string | null
  notes?: string | null
}) {
  const validation = debtSchema.safeParse(input)
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
  const { data, error } = await (supabase.from('debts') as any)
    .insert({
      user_id: user.id,
      type: input.type,
      counterparty_name: input.counterpartyName.trim(),
      initial_amount: input.initialAmount,
      remaining_amount: input.initialAmount,
      currency: input.currency || 'IDR',
      status: 'active',
      due_date: input.dueDate || null,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/debts')
  revalidatePath('/net-worth')
  revalidatePath('/')
  return { data }
}

export async function updateDebt(
  id: string,
  input: {
    counterpartyName: string
    dueDate?: string | null
    notes?: string | null
    status?: DebtStatus
  }
) {
  const supabase = await createServerSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('debts') as any)
    .update({
      counterparty_name: input.counterpartyName.trim(),
      due_date: input.dueDate || null,
      notes: input.notes?.trim() || null,
      status: input.status,
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/debts')
  revalidatePath(`/debts/${id}`)
  revalidatePath('/net-worth')
  revalidatePath('/')
  return { success: true }
}

export async function deleteDebt(id: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('debts').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/debts')
  revalidatePath('/net-worth')
  revalidatePath('/')
  return { success: true }
}

export async function addDebtPayment(input: {
  debtId: string
  amount: number
  paymentDate: string
  accountId?: string | null
}) {
  const validation = debtPaymentSchema.safeParse(input)
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
  const { data: debt } = await (supabase.from('debts') as any).select('*').eq('id', input.debtId).single()
  if (!debt) return { error: 'Debt not found' }

  let linkedTxId: string | null = null

  if (input.accountId) {
    const txType = debt.type === 'debt' ? 'expense' : 'income'
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: category } = await (supabase.from('categories') as any)
      .select('id')
      .eq('user_id', user.id)
      .eq('type', txType)
      .limit(1)
      .single()

    if (category) {
      const desc = debt.type === 'debt'
        ? `Pembayaran Cicilan Utang ke ${debt.counterparty_name}`
        : `Penerimaan Pelunasan Piutang dari ${debt.counterparty_name}`

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tx } = await (supabase.from('transactions') as any)
        .insert({
          user_id: user.id,
          account_id: input.accountId,
          category_id: category.id,
          type: txType,
          amount: input.amount,
          currency: debt.currency,
          description: desc,
          transaction_date: input.paymentDate,
        })
        .select('id')
        .single()

      if (tx) {
        linkedTxId = tx.id
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('debt_payments') as any)
    .insert({
      debt_id: input.debtId,
      amount: input.amount,
      payment_date: input.paymentDate || new Date().toISOString(),
      linked_transaction_id: linkedTxId,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/debts')
  revalidatePath(`/debts/${input.debtId}`)
  revalidatePath('/transactions')
  revalidatePath('/accounts')
  revalidatePath('/net-worth')
  revalidatePath('/')
  return { data }
}

export async function updateDebtPayment(input: {
  paymentId: string
  debtId: string
  amount: number
  paymentDate: string
  accountId?: string | null
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // 1. Check existing payment and debt
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payment, error: pErr } = await (supabase.from('debt_payments') as any)
    .select('*, debt:debts(*)')
    .eq('id', input.paymentId)
    .single()

  if (pErr || !payment) {
    return { error: 'Data cicilan tidak ditemukan' }
  }

  const debt = payment.debt
  let linkedTxId: string | null = payment.linked_transaction_id

  // 2. Handle linked transaction account & amount sync
  if (input.accountId) {
    if (linkedTxId) {
      // Update existing linked transaction's account, amount, and date
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('transactions') as any)
        .update({
          account_id: input.accountId,
          amount: input.amount,
          transaction_date: input.paymentDate,
        })
        .eq('id', linkedTxId)
    } else {
      // Create new linked transaction
      const txType = debt?.type === 'debt' ? 'expense' : 'income'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: category } = await (supabase.from('categories') as any)
        .select('id')
        .eq('user_id', user.id)
        .eq('type', txType)
        .limit(1)
        .single()

      if (category) {
        const desc = debt?.type === 'debt'
          ? `Pembayaran Cicilan Utang ke ${debt?.counterparty_name || 'Pihak'}`
          : `Penerimaan Pelunasan Piutang dari ${debt?.counterparty_name || 'Pihak'}`

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newTx } = await (supabase.from('transactions') as any)
          .insert({
            user_id: user.id,
            account_id: input.accountId,
            category_id: category.id,
            type: txType,
            amount: input.amount,
            currency: debt?.currency || 'IDR',
            description: desc,
            transaction_date: input.paymentDate,
          })
          .select('id')
          .single()

        if (newTx) {
          linkedTxId = newTx.id
        }
      }
    }
  } else if (!input.accountId && linkedTxId) {
    // User unlinked the account, delete the transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('transactions') as any).delete().eq('id', linkedTxId)
    linkedTxId = null
  }

  // 3. Update debt payment record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('debt_payments') as any)
    .update({
      amount: input.amount,
      payment_date: input.paymentDate,
      linked_transaction_id: linkedTxId,
    })
    .eq('id', input.paymentId)

  if (error) {
    return { error: error.message }
  }

  // 4. Robust Application-level recalculation of debt remaining_amount and status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allPayments } = await (supabase.from('debt_payments') as any)
    .select('id, amount')
    .eq('debt_id', input.debtId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: debtRecord } = await (supabase.from('debts') as any)
    .select('initial_amount')
    .eq('id', input.debtId)
    .single()

  if (debtRecord && allPayments) {
    const totalPaid = allPayments.reduce(
      (sum: number, p: { id: string; amount: number }) =>
        sum + (p.id === input.paymentId ? Number(input.amount) : Number(p.amount)),
      0
    )
    const remaining = Math.max(0, Number(debtRecord.initial_amount) - totalPaid)
    const newStatus = remaining <= 0 ? 'paid' : 'active'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('debts') as any)
      .update({
        remaining_amount: remaining,
        status: newStatus,
      })
      .eq('id', input.debtId)
  }

  revalidatePath('/debts')
  revalidatePath(`/debts/${input.debtId}`)
  revalidatePath('/transactions')
  revalidatePath('/accounts')
  revalidatePath('/net-worth')
  revalidatePath('/')
  return { success: true }
}

export async function deleteDebtPayment(paymentId: string, debtId: string) {
  const supabase = await createServerSupabaseClient()

  // 1. Check if linked transaction exists and delete it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payment } = await (supabase.from('debt_payments') as any)
    .select('linked_transaction_id')
    .eq('id', paymentId)
    .single()

  if (payment?.linked_transaction_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('transactions') as any).delete().eq('id', payment.linked_transaction_id)
  }

  // 2. Delete the payment
  const { error } = await supabase.from('debt_payments').delete().eq('id', paymentId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/debts')
  revalidatePath(`/debts/${debtId}`)
  revalidatePath('/transactions')
  revalidatePath('/accounts')
  revalidatePath('/net-worth')
  revalidatePath('/')
  return { success: true }
}
