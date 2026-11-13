"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  AuditLog,
  EnrichedTransaction,
  TransactionType,
  CurrencyCode,
} from "@/types/database";
import { transactionSchema } from "@/lib/validations/transaction";
import { formatCurrency } from "@/lib/utils/currency";
import type { TransactionItem } from "@/lib/utils/transaction-items";
import { getLocalDateRangeBoundsUTC } from "@/lib/utils/date";
import { getUserTimeZone } from "@/lib/utils/timezone-server";

export interface TransactionFilterParams {
  categoryId?: string;
  accountId?: string;
  type?: TransactionType | "all";
  startDate?: string;
  endDate?: string;
  timeZone?: string;
  search?: string;
  tag?: string;
  sort?: "date_desc" | "date_asc" | "amount_desc" | "amount_asc";
  limit?: number;
}

export async function getTransactions(
  params: TransactionFilterParams = {},
): Promise<EnrichedTransaction[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("transactions").select(`
      *,
      account:accounts(*),
      category:categories(*)
    `);

  if (params.accountId && params.accountId !== "all") {
    query = query.eq("account_id", params.accountId);
  }

  if (params.categoryId && params.categoryId !== "all") {
    query = query.eq("category_id", params.categoryId);
  }

  if (params.type && params.type !== "all") {
    query = query.eq("type", params.type);
  }

  if (params.tag && params.tag !== "all") {
    const cleanTag = params.tag.replace(/^#/, "").toLowerCase().trim();
    query = query.contains("tags", [cleanTag]);
  }

  if (params.startDate || params.endDate) {
    const timeZone = params.timeZone ?? (await getUserTimeZone());
    if (params.startDate && params.endDate) {
      const { startUtc, endUtcExclusive } = getLocalDateRangeBoundsUTC(
        params.startDate,
        params.endDate,
        timeZone,
      );
      query = query.gte("transaction_date", startUtc);
      query = query.lt("transaction_date", endUtcExclusive);
    } else if (params.startDate) {
      const { startUtc } = getLocalDateRangeBoundsUTC(
        params.startDate,
        params.startDate,
        timeZone,
      );
      query = query.gte("transaction_date", startUtc);
    } else if (params.endDate) {
      const { endUtcExclusive } = getLocalDateRangeBoundsUTC(
        params.endDate,
        params.endDate,
        timeZone,
      );
      query = query.lt("transaction_date", endUtcExclusive);
    }
  }

  if (params.search && params.search.trim()) {
    query = query.ilike("description", `%${params.search.trim()}%`);
  }

  switch (params.sort) {
    case "date_asc":
      query = query.order("transaction_date", { ascending: true });
      break;
    case "amount_desc":
      query = query.order("amount", { ascending: false });
      break;
    case "amount_asc":
      query = query.order("amount", { ascending: true });
      break;
    case "date_desc":
    default:
      query = query.order("transaction_date", { ascending: false });
      break;
  }

  if (params.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching transactions:", error);
    return [];
  }

  const rawTransactions = (data as unknown as EnrichedTransaction[]) || [];

  // Keep transactions even when their debt or savings-goal card is deleted.
  // The cash ledger is independent history and must not be purged implicitly.
  return rawTransactions;
}

export async function getTransactionById(
  id: string,
): Promise<EnrichedTransaction | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(
      `
      *,
      account:accounts(*),
      category:categories(*)
    `,
    )
    .eq("id", id)
    .single();

  if (error) return null;
  return data as unknown as EnrichedTransaction;
}

function extractTags(
  description?: string | null,
  explicitTags?: string[],
): string[] {
  const set = new Set<string>();
  if (explicitTags && Array.isArray(explicitTags)) {
    explicitTags.forEach((t) => {
      const clean = t.replace(/^#/, "").toLowerCase().trim();
      if (clean) set.add(clean);
    });
  }
  if (description) {
    const hashMatches = description.match(/#[a-zA-Z0-9_\-]+/g);
    if (hashMatches) {
      hashMatches.forEach((t) => {
        const clean = t.replace(/^#/, "").toLowerCase().trim();
        if (clean) set.add(clean);
      });
    }
  }
  return Array.from(set);
}

export async function createTransaction(input: {
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: number;
  currency?: CurrencyCode;
  description?: string | null;
  tags?: string[];
  /** Rincian item (disimpan di kolom JSONB `transactions.items`) */
  items?: TransactionItem[];
  transactionDate: string;
}) {
  const validation = transactionSchema.safeParse(input);
  if (!validation.success) {
    const firstIssue = validation.error.issues[0];
    return { error: firstIssue?.message || "Invalid input" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Demo Account Safeguard: Cap at 50 transactions to prevent spam scripts
  if (user.email?.toLowerCase() === "demo@pocketly.app") {
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (count && count >= 50) {
      return {
        error:
          "Batas kuota akun demo tercapai (Maksimal 50 transaksi). Silakan hapus beberapa transaksi demo untuk mencoba menambah yang baru.",
      };
    }
  }

  // 1. Fetch Account Details
  const { data: acc, error: accError } = await supabase
    .from("accounts")
    .select("id, name, currency, current_balance")
    .eq("id", input.accountId)
    .eq("user_id", user.id)
    .single();

  if (accError || !acc) {
    return { error: "Akun tidak ditemukan" };
  }

  const accountCurrency = (acc.currency as CurrencyCode) || "IDR";
  const txCurrency = input.currency || accountCurrency;
  if (txCurrency !== accountCurrency) {
    return {
      error: "Currency transaksi harus sama dengan currency akun.",
    };
  }
  const computedTags = extractTags(input.description, input.tags);

  // 2. Strict Non-Negative Balance Guard for Expense
  if (input.type === "expense") {
    const currentBal = Number(acc.current_balance) || 0;
    if (currentBal - input.amount < 0) {
      return {
        error: `Saldo ${acc.name} tidak mencukupi. (Tersedia: ${formatCurrency(currentBal, acc.currency)}, Dibutuhkan: ${formatCurrency(input.amount, acc.currency)})`,
      };
    }
  }

  // 3. Insert Transaction
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: input.accountId,
      category_id: input.categoryId,
      type: input.type,
      amount: input.amount,
      currency: txCurrency,
      description: input.description?.trim() || null,
      tags: computedTags,
      // Rincian item (JSONB) — null kalau nggak ada item.
      items: input.items && input.items.length > 0 ? input.items : null,
      transaction_date: input.transactionDate || new Date().toISOString(),
    })
    .select(`*, category:categories(*), account:accounts(*)`)
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath("/budget");
  revalidatePath("/accounts");
  revalidatePath("/audit-log");
  return { data };
}

export async function updateTransaction(
  id: string,
  input: {
    accountId: string;
    categoryId: string;
    type: TransactionType;
    amount: number;
    currency?: CurrencyCode;
    description?: string | null;
    tags?: string[];
    /** Rincian item (disimpan di kolom JSONB `transactions.items`) */
    items?: TransactionItem[];
    transactionDate: string;
  },
) {
  const validation = transactionSchema.safeParse(input);
  if (!validation.success) {
    const firstIssue = validation.error.issues[0];
    return { error: firstIssue?.message || "Invalid input" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  // 1. Fetch Existing Transaction
  const { data: oldTx, error: oldTxErr } = await supabase
    .from("transactions")
    .select("*, account:accounts(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (oldTxErr || !oldTx) {
    return { error: "Transaksi tidak ditemukan" };
  }

  // 2. Fetch Target Account
  const { data: targetAcc, error: targetAccErr } = await supabase
    .from("accounts")
    .select("id, name, currency, current_balance")
    .eq("id", input.accountId)
    .eq("user_id", user.id)
    .single();

  if (targetAccErr || !targetAcc) {
    return { error: "Akun tujuan tidak ditemukan" };
  }

  const targetCurrency = (targetAcc.currency as CurrencyCode) || "IDR";
  const txCurrency = input.currency || targetCurrency;
  if (txCurrency !== targetCurrency) {
    return {
      error: "Currency transaksi harus sama dengan currency akun.",
    };
  }

  const computedTags = extractTags(input.description, input.tags);

  // 3. Strict Non-Negative Balance Guard
  const oldAmount = Number(oldTx.amount) || 0;
  const newAmount = Number(input.amount) || 0;

  if (oldTx.account_id === input.accountId) {
    // Same Account: Compute net delta
    const currentBal = Number(targetAcc.current_balance) || 0;
    const oldEffect = oldTx.type === "expense" ? -oldAmount : oldAmount;
    const newEffect = input.type === "expense" ? -newAmount : newAmount;
    const delta = newEffect - oldEffect;
    const projectedBal = currentBal + delta;

    if (projectedBal < 0) {
      return {
        error: `Perubahan gagal: Saldo ${targetAcc.name} akan menjadi minus (${formatCurrency(projectedBal, targetAcc.currency)}).`,
      };
    }
  } else {
    // Different Account: Check old account and new account separately
    // Old account loses oldEffect
    const { data: oldAcc } = await supabase
      .from("accounts")
      .select("id, name, currency, current_balance")
      .eq("id", oldTx.account_id)
      .single();

    if (oldAcc) {
      const oldBal = Number(oldAcc.current_balance) || 0;
      const revertOldEffect = oldTx.type === "income" ? -oldAmount : oldAmount;
      if (oldBal + revertOldEffect < 0) {
        return {
          error: `Perubahan gagal: Saldo akun asal (${oldAcc.name}) akan menjadi minus jika transaksi dipindahkan.`,
        };
      }
    }

    // New account receives newEffect
    if (input.type === "expense") {
      const targetBal = Number(targetAcc.current_balance) || 0;
      if (targetBal - newAmount < 0) {
        return {
          error: `Perubahan gagal: Saldo akun tujuan (${targetAcc.name}) tidak mencukupi untuk pengeluaran ${formatCurrency(newAmount, targetAcc.currency)}.`,
        };
      }
    }
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      account_id: input.accountId,
      category_id: input.categoryId,
      type: input.type,
      amount: input.amount,
      currency: txCurrency,
      description: input.description?.trim() || null,
      tags: computedTags,
      // Rincian item (JSONB) — null kalau nggak ada item.
      items: input.items && input.items.length > 0 ? input.items : null,
      transaction_date: input.transactionDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/transactions");
  revalidatePath(`/transactions/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath("/budget");
  revalidatePath("/accounts");
  revalidatePath("/audit-log");
  return { success: true };
}

export async function deleteTransaction(id: string) {
  const supabase = await createServerSupabaseClient();

  // 1. Fetch transaction and account before delete
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("*, account:accounts(*)")
    .eq("id", id)
    .single();

  if (txErr || !tx) {
    return { error: "Transaksi tidak ditemukan" };
  }

  // 2. Strict Guard: Deleting an Income transaction reduces account balance
  if (tx.type === "income" && tx.account) {
    const currentBal = Number(tx.account.current_balance) || 0;
    const txAmount = Number(tx.amount) || 0;
    const projectedBal = currentBal - txAmount;

    if (projectedBal < 0) {
      return {
        error: `Gagal menghapus pemasukan: Saldo ${tx.account.name} saat ini (${formatCurrency(currentBal, tx.account.currency)}) tidak mencukupi untuk menarik kembali dana sebesar ${formatCurrency(txAmount, tx.account.currency)}.`,
      };
    }
  }

  const { error } = await supabase.from("transactions").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath("/budget");
  revalidatePath("/accounts");
  revalidatePath("/audit-log");
  return { success: true };
}

export async function getTransactionAuditLogs(
  transactionId: string,
): Promise<AuditLog[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("table_name", "transactions")
    .eq("record_id", transactionId)
    .order("changed_at", { ascending: false });

  if (error) {
    console.error("Error fetching audit logs:", error);
    return [];
  }

  return (data as unknown as AuditLog[]) || [];
}

export interface GlobalAuditLogsOptions {
  limit?: number;
  offset?: number;
  start?: string;
  end?: string;
  module?: string;
  action?: string;
  search?: string;
}

/**
 * Audit rows only snapshot the transfer table, which stores account IDs —
 * not names. Resolve them from `accounts` so the log shows real names
 * instead of the generic "Source Account → Destination Account" fallback.
 */
async function attachTransferAccountNames(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  logs: AuditLog[],
): Promise<AuditLog[]> {
  const transferLogs = logs.filter((log) => log.table_name === "transfers");
  if (transferLogs.length === 0) return logs;

  const ids = new Set<string>();
  for (const log of transferLogs) {
    for (const snapshot of [log.new_values, log.old_values]) {
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
        continue;
      }
      const row = snapshot as Record<string, unknown>;
      if (typeof row.from_account_id === "string") ids.add(row.from_account_id);
      if (typeof row.to_account_id === "string") ids.add(row.to_account_id);
    }
  }
  if (ids.size === 0) return logs;

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name")
    .in("id", Array.from(ids));

  if (!accounts?.length) return logs;
  const nameById = new Map(accounts.map((a) => [a.id, a.name]));

  for (const log of transferLogs) {
    for (const key of ["new_values", "old_values"] as const) {
      const snapshot = log[key];
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
        continue;
      }
      const row = snapshot as Record<string, unknown>;
      const fromName =
        typeof row.from_account_id === "string"
          ? nameById.get(row.from_account_id)
          : undefined;
      const toName =
        typeof row.to_account_id === "string"
          ? nameById.get(row.to_account_id)
          : undefined;
      if (fromName) row.from_account_name = fromName;
      if (toName) row.to_account_name = toName;
    }
  }

  return logs;
}

export async function getGlobalAuditLogs(
  options: GlobalAuditLogsOptions = {},
): Promise<{ logs: AuditLog[]; total: number }> {
  const supabase = await createServerSupabaseClient();
  const {
    limit = 50,
    offset = 0,
    start: startDate,
    end: endDate,
    module,
    action,
    search,
  } = options;

  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("changed_at", { ascending: false })
    // Derived holdings are not user actions; hide even legacy rows.
    .not(
      "table_name",
      "in",
      '("stock_holdings","crypto_holdings","etf_holdings")',
    )
    .range(offset, offset + limit - 1);

  if (module && module !== "all") {
    query = query.eq("table_name", module);
  }

  if (action && action !== "all") {
    query = query.eq("action", action as "INSERT" | "UPDATE" | "DELETE");
  }

  const q = (search || "").trim().replace(/[,()\\%_]/g, "").slice(0, 100);
  if (q) {
    query = query.or(
      `table_name.ilike.%${q}%,action.ilike.%${q}%,new_values->>description.ilike.%${q}%,old_values->>description.ilike.%${q}%`,
    );
  }

  if (startDate || endDate) {
    const timeZone = await getUserTimeZone();
    if (startDate && endDate) {
      const { startUtc, endUtcExclusive } = getLocalDateRangeBoundsUTC(
        startDate,
        endDate,
        timeZone,
      );
      query = query.gte("changed_at", startUtc);
      query = query.lt("changed_at", endUtcExclusive);
    } else if (startDate) {
      const { startUtc } = getLocalDateRangeBoundsUTC(
        startDate,
        startDate,
        timeZone,
      );
      query = query.gte("changed_at", startUtc);
    } else if (endDate) {
      const { endUtcExclusive } = getLocalDateRangeBoundsUTC(
        endDate,
        endDate,
        timeZone,
      );
      query = query.lt("changed_at", endUtcExclusive);
    }
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching global audit logs:", error);
    return { logs: [], total: 0 };
  }

  return {
    logs: await attachTransferAccountNames(
      supabase,
      (data as unknown as AuditLog[]) || [],
    ),
    total: count ?? 0,
  };
}

export async function getAllUserTags(): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("transactions")
    .select("tags")
    .eq("user_id", user.id);

  if (error || !data) return [];

  const tagSet = new Set<string>();
  data.forEach((row: { tags?: string[] }) => {
    if (Array.isArray(row.tags)) {
      row.tags.forEach((t) => tagSet.add(t));
    }
  });

  return Array.from(tagSet).sort();
}

export async function getMostUsedCategoriesByAccount(): Promise<
  Record<string, string>
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await (supabase.rpc as unknown as (fn: string, args: { p_user_id: string }) => Promise<{ data: unknown; error: unknown }>)(
    "get_most_used_categories_by_account",
    {
      p_user_id: user.id,
    },
  );

  if (error || !data) {
    console.error("Error fetching most used categories:", error);
    return {};
  }

  const result: Record<string, string> = {};
  (
    data as Array<{ account_id: string; type: string; category_id: string }>
  ).forEach((row) => {
    result[`${row.account_id}_${row.type}`] = row.category_id;
  });

  return result;
}
