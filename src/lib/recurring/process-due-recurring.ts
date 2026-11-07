import { parseISO } from "date-fns";
import { calculateNextDueDate } from "@/lib/utils/recurring";
import { zonedDateToUtc } from "@/lib/utils/date";
import type { RecurringFrequency } from "@/types/database";

/**
 * Minimal Supabase client surface needed by the helper.
 * Works with both the user-scoped server client and the service-role
 * admin client (cron), since balance is maintained by the DB trigger.
 */
export interface RecurringSupabaseClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

export interface DueRecurringRule {
  id: string;
  user_id: string;
  name: string;
  type: string;
  amount: number | string;
  currency: string;
  account_id: string;
  category_id: string | null;
  frequency: string;
  interval_count: number;
  next_due_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
}

export type ProcessDueResult =
  | {
      ok: true;
      transactionId: string;
      processedDate: string;
      nextDueDate: string;
      shouldDeactivate: boolean;
    }
  | { ok: false; reason: "no_category" | "no_account" | "insufficient_balance" | "insert_failed" | "update_failed"; error?: string };

/**
 * Process ONE period of a recurring rule.
 * - Transaction date = the due date itself (noon in `timeZone`), so
 *   cron catch-up after missed days keeps the original schedule dates.
 * - Balance is NOT updated here: the `trg_transaction_balance` DB trigger
 *   already adjusts `accounts.current_balance` on transaction INSERT.
 *   (The old manual flow updated it a second time — double counting.)
 * - Expense respects the app's non-negative balance guard, like a normal
 *   transaction. Insufficient balance returns a reason instead of inserting.
 */
export async function processOneRecurringPeriod(
  supabase: RecurringSupabaseClient,
  rule: DueRecurringRule,
  timeZone: string = "Asia/Jakarta",
  /** Manual "Pay Now" override (YYYY-MM-DD). Cron leaves this empty and
   *  uses the due date itself so catch-up keeps original schedule dates. */
  overrideDate?: string,
): Promise<ProcessDueResult> {
  if (!rule.category_id) {
    return { ok: false, reason: "no_category" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: account, error: accErr } = await (supabase.from("accounts") as any)
    .select("id, current_balance, currency")
    .eq("id", rule.account_id)
    .eq("user_id", rule.user_id)
    .single();

  if (accErr || !account) {
    return { ok: false, reason: "no_account", error: accErr?.message };
  }

  if (rule.type === "expense") {
    const currentBal = Number(account.current_balance) || 0;
    if (currentBal - Number(rule.amount) < 0) {
      return { ok: false, reason: "insufficient_balance" };
    }
  }

  const dueDateStr = String(rule.next_due_date).substring(0, 10);
  const processedDate = overrideDate || dueDateStr;
  const txDate = zonedDateToUtc(processedDate, timeZone, 12, 0, 0);
  const cleanDescription = rule.notes
    ? `${rule.name} • ${rule.notes}`
    : rule.name;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tx, error: txErr } = await (supabase.from("transactions") as any)
    .insert({
      user_id: rule.user_id,
      account_id: rule.account_id,
      category_id: rule.category_id,
      type: rule.type,
      amount: rule.amount,
      currency: rule.currency,
      description: cleanDescription,
      transaction_date: txDate,
    })
    .select("id")
    .single();

  if (txErr || !tx) {
    return {
      ok: false,
      reason: "insert_failed",
      error: txErr?.message || "insert failed",
    };
  }

  const nextDueDate = calculateNextDueDate(
    dueDateStr,
    rule.frequency as RecurringFrequency,
    rule.interval_count || 1,
  );
  const shouldDeactivate =
    !!rule.end_date && parseISO(nextDueDate) > parseISO(rule.end_date);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (supabase.from("recurring_transactions") as any)
    .update({
      next_due_date: nextDueDate,
      last_processed_date: processedDate,
      is_active: shouldDeactivate ? false : rule.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rule.id);

  if (updErr) {
    return {
      ok: false,
      reason: "update_failed",
      error: updErr.message,
    };
  }

  return {
    ok: true,
    transactionId: tx.id,
    processedDate,
    nextDueDate,
    shouldDeactivate,
  };
}
