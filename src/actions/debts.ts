'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Debt, DebtPayment, DebtType, DebtStatus, CurrencyCode } from '@/types/database'
import { debtSchema, debtPaymentSchema } from '@/lib/validations/debt'
import { formatCurrency } from '@/lib/utils/currency'

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
  revalidatePath('/dashboard')
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
  revalidatePath('/dashboard')
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
  revalidatePath('/dashboard')
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

  // 1. Fetch Debt Record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: debt } = await (supabase.from('debts') as any).select('*').eq('id', input.debtId).single()
  if (!debt) return { error: 'Data utang/piutang tidak ditemukan' }

  let linkedTxId: string | null = null

  // 2. Multi-Currency & Balance Guard if account is selected
  if (input.accountId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: acc, error: accErr } = await (supabase.from('accounts') as any)
      .select('id, name, currency, current_balance')
      .eq('id', input.accountId)
      .single()

    if (accErr || !acc) {
      return { error: 'Akun mutasi tidak ditemukan' }
    }

    // Strict Multi-Currency Rule: Account Currency must match Debt Currency
    if (acc.currency !== debt.currency) {
      return {
        error: `Mata uang akun (${acc.currency}) tidak sesuai dengan mata uang utang (${debt.currency}). Silakan pilih akun bermata uang ${debt.currency} atau lakukan konversi di menu Transfer.`,
      }
    }

    // Strict Non-Negative Balance Guard for Debt Payment (Expense)
    if (debt.type === 'debt') {
      const currentBal = Number(acc.current_balance) || 0
      if (currentBal - input.amount < 0) {
        return {
          error: `Saldo akun ${acc.name} tidak mencukupi untuk membayar cicilan. (Tersedia: ${formatCurrency(currentBal, acc.currency)}, Dibutuhkan: ${formatCurrency(input.amount, acc.currency)})`,
        }
      }
    }

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
      const { data: tx, error: txError } = await (supabase.from('transactions') as any)
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

      if (txError) {
        return { error: txError.message }
      }

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
  revalidatePath('/dashboard')
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

  // 2. Multi-Currency & Balance Guard
  if (input.accountId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: targetAcc, error: targetAccErr } = await (supabase.from('accounts') as any)
      .select('id, name, currency, current_balance')
      .eq('id', input.accountId)
      .single()

    if (targetAccErr || !targetAcc) {
      return { error: 'Akun mutasi tidak ditemukan' }
    }

    if (targetAcc.currency !== debt.currency) {
      return {
        error: `Mata uang akun (${targetAcc.currency}) tidak sesuai dengan mata uang utang (${debt.currency}).`,
      }
    }

    const oldAmount = Number(payment.amount) || 0
    const newAmount = Number(input.amount) || 0

    if (debt.type === 'debt') {
      // Paying debt = expense
      const currentBal = Number(targetAcc.current_balance) || 0
      const delta = newAmount - oldAmount
      if (currentBal - delta < 0) {
        return {
          error: `Perubahan gagal: Saldo akun ${targetAcc.name} tidak mencukupi untuk kenaikan pembayaran. (Tersedia: ${formatCurrency(currentBal, targetAcc.currency)})`,
        }
      }
    } else {
      // Receiving receivable = income
      // If payment amount is reduced, money is deducted from account
      const currentBal = Number(targetAcc.current_balance) || 0
      const delta = oldAmount - newAmount
      if (currentBal - delta < 0) {
        return {
          error: `Perubahan gagal: Saldo akun ${targetAcc.name} tidak mencukupi untuk menarik kembali kelebihan dana (${formatCurrency(delta, targetAcc.currency)}).`,
        }
      }
    }

    if (linkedTxId) {
      // Update existing linked transaction
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

  // 4. Recalculate remaining amount & status
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
  revalidatePath('/dashboard')
  revalidatePath('/')
  return { success: true }
}

export async function deleteDebtPayment(paymentId: string, debtId: string) {
  const supabase = await createServerSupabaseClient()

  // 1. Check if linked transaction exists and if deleting it creates negative balance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payment } = await (supabase.from('debt_payments') as any)
    .select('*, debt:debts(*), transaction:transactions(*, account:accounts(*))')
    .eq('id', paymentId)
    .single()

  if (payment?.transaction) {
    const tx = payment.transaction
    // If it was an income transaction (Receivable payment collected into account)
    if (tx.type === 'income' && tx.account) {
      const currentBal = Number(tx.account.current_balance) || 0
      const paymentAmount = Number(payment.amount) || 0
      if (currentBal - paymentAmount < 0) {
        return {
          error: `Gagal membatalkan pelunasan piutang: Saldo akun ${tx.account.name} saat ini (${formatCurrency(currentBal, tx.account.currency)}) tidak mencukupi untuk menarik kembali dana sebesar ${formatCurrency(paymentAmount, tx.account.currency)}.`,
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('transactions') as any).delete().eq('id', tx.id)
  }

  // 2. Delete the payment
  const { error } = await supabase.from('debt_payments').delete().eq('id', paymentId)

  if (error) {
    return { error: error.message }
  }

  // 3. Recalculate remaining amount & status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allPayments } = await (supabase.from('debt_payments') as any)
    .select('amount')
    .eq('debt_id', debtId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: debtRecord } = await (supabase.from('debts') as any)
    .select('initial_amount')
    .eq('id', debtId)
    .single()

  if (debtRecord) {
    const totalPaid = (allPayments || []).reduce(
      (sum: number, p: { amount: number }) => sum + Number(p.amount),
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
      .eq('id', debtId)
  }

  revalidatePath('/debts')
  revalidatePath(`/debts/${debtId}`)
  revalidatePath('/transactions')
  revalidatePath('/accounts')
  revalidatePath('/net-worth')
  revalidatePath('/dashboard')
  revalidatePath('/')
  return { success: true }
}
