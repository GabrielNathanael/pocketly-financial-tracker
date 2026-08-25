import { z } from 'zod'

export const transactionSchema = z.object({
  accountId: z.string().uuid('Please select a valid account'),
  categoryId: z.string().uuid('Please select a valid category'),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.enum(['IDR', 'USD']).default('IDR'),
  description: z.string().max(255, 'Description too long').optional().nullable(),
  transactionDate: z.string().min(1, 'Transaction date is required'),
})

export type TransactionInput = z.infer<typeof transactionSchema>
