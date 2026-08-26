import { z } from 'zod'

export const recurringTransactionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.enum(['IDR', 'USD', 'SGD']).default('IDR'),
  accountId: z.string().uuid('Please select a valid account'),
  categoryId: z.string().uuid().optional().nullable(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).default('monthly'),
  intervalCount: z.number().int().min(1).default(1),
  startDate: z.string().min(1, 'Start date is required'),
  nextDueDate: z.string().min(1, 'Next due date is required'),
  endDate: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  autoProcess: z.boolean().default(false),
  notes: z.string().max(500, 'Notes too long').optional().nullable(),
})

export type RecurringTransactionInput = z.infer<typeof recurringTransactionSchema>
