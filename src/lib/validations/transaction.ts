import { z } from 'zod'

/** Rincian item transaksi (disimpan di kolom `transactions.items` JSONB). */
const positiveNumericString = (max = 40) =>
  z
    .string()
    .max(max)
    .refine((v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) && n > 0;
    }, "Must be greater than 0");

const transactionItemSchema = z.object({
  name: z.string().max(200),
  quantity: positiveNumericString().optional(),
  price: z.string().max(40).optional(),
  subtotal: z.string().max(40).optional(),
  shareCount: positiveNumericString().optional(),
  mySubtotal: z.string().max(40).optional(),
})

export const transactionSchema = z.object({
  accountId: z.string().uuid('Please select a valid account'),
  categoryId: z.string().uuid('Please select a valid category'),
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.enum(['IDR', 'USD', 'SGD']).default('IDR'),
  description: z.string().max(2000, 'Description too long').optional().nullable(),
  tags: z.array(z.string()).default([]),
  /** Rincian item opsional (JSONB) */
  items: z.array(transactionItemSchema).max(200).optional(),
  transactionDate: z.string().min(1, 'Transaction date is required'),
})

export type TransactionInput = z.infer<typeof transactionSchema>
