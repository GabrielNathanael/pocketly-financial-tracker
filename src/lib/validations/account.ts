import { z } from 'zod'

export const accountSchema = z.object({
  name: z.string().min(1, 'Account name is required').max(50, 'Name too long'),
  type: z.enum(['bank', 'cash', 'ewallet', 'credit_card', 'investment']),
  currency: z.enum(['IDR', 'USD']).default('IDR'),
  initialBalance: z.number().default(0),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
})

export type AccountInput = z.infer<typeof accountSchema>
