import { z } from 'zod'

export const budgetSchema = z.object({
  categoryId: z.string().uuid('Please select a category'),
  amount: z.number().min(0, 'Budget cannot be negative'),
  periodStartDate: z.string().regex(/^\d{4}-\d{2}-01$/, 'Must be in YYYY-MM-01 format'),
})

export type BudgetInput = z.infer<typeof budgetSchema>
