import { z } from 'zod'

export const savingsGoalSchema = z.object({
  name: z.string().min(1, 'Goal name is required').max(255, 'Goal name too long'),
  targetAmount: z.number().positive('Target amount must be greater than 0'),
  initialSaved: z.number().min(0).default(0),
  currency: z.enum(['IDR', 'USD', 'SGD']).default('IDR'),
  targetDate: z.string().min(1, 'Target deadline date is required'),
  categoryId: z.string().uuid().optional().nullable(),
  icon: z.string().default('Target'),
  color: z.string().default('#0D9488'),
  status: z.enum(['in_progress', 'completed', 'paused']).default('in_progress'),
  notes: z.string().max(500, 'Notes too long').optional().nullable(),
})

export const goalDepositSchema = z.object({
  goalId: z.string().uuid('Invalid goal ID'),
  accountId: z.string().uuid('Account is required'),
  type: z.enum(['deposit', 'withdraw']),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.enum(['IDR', 'USD', 'SGD']).default('IDR'),
  depositDate: z.string().min(1, 'Date is required'),
  notes: z.string().max(255).optional().nullable(),
})

export type SavingsGoalInput = z.infer<typeof savingsGoalSchema>
export type GoalDepositInput = z.infer<typeof goalDepositSchema>
