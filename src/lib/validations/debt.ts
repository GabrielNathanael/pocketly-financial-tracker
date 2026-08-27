import { z } from 'zod'

export const debtSchema = z.object({
  type: z.enum(['debt', 'receivable']),
  counterpartyName: z.string().min(1, 'Person / party name is required').max(100),
  initialAmount: z.number().positive('Amount must be greater than 0'),
  currency: z.enum(['IDR', 'USD']).default('IDR'),
  dueDate: z.string().optional().nullable(),
  notes: z.string().max(255).optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  recordTransaction: z.boolean().optional(),
})

export const debtPaymentSchema = z.object({
  debtId: z.string().uuid('Invalid debt ID'),
  amount: z.number().positive('Payment must be greater than 0'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  accountId: z.string().uuid().optional().nullable(),
})

export type DebtInput = z.infer<typeof debtSchema>
export type DebtPaymentInput = z.infer<typeof debtPaymentSchema>
