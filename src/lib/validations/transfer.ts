import { z } from "zod";

export const transferSchema = z
  .object({
    fromAccountId: z.string().uuid("Please select a source account"),
    toAccountId: z.string().uuid("Please select a destination account"),
    amount: z.number().positive("Amount must be greater than 0"),
    transferFee: z.number().min(0).optional().default(0),
    exchangeRateUsed: z.number().positive().default(1),
    description: z.string().max(255).optional().nullable(),
    transferDate: z.string().min(1, "Transfer date is required"),
    transferDateLocal: z.string().min(1),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: "Destination account must be different from source account",
    path: ["toAccountId"],
  });

export type TransferInput = z.infer<typeof transferSchema>;
