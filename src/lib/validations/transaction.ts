import { z } from 'zod'

export const transactionSchema = z.object({
  accountId: z.string().uuid('Please select a valid account'),
  categoryId: z.string().uuid('Please select a valid category'),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.enum(['IDR', 'USD', 'SGD']).default('IDR'),
  description: z.string().max(500, 'Description too long').optional().nullable(),
  tags: z.array(z.string()).default([]),
  transactionDate: z.string().min(1, 'Transaction date is required'),
})

export type TransactionInput = z.infer<typeof transactionSchema>
