"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EnrichedBudget, Category } from "@/types/database";
import { budgetSchema } from "@/lib/validations/budget";
import { CurrencyCode } from "@/lib/constants/currencies";
import { getCanonicalCategoryName } from "@/lib/utils/category-i18n";
import { endOfMonth, parseISO, format } from "date-fns";

// Categories that exist purely for operational/system bookkeeping (balance
// reconciliation, loan tracking, transfer fees, savings allocation) rather
// than representing real user spending. These should never be surfaced as
// budgetable categories — users shouldn't be nudged to "set a limit" on
// cash discrepancies or savings transfers.
const SYSTEM_ONLY_CATEGORIES = [
  "Discrepancy",
  "Loan & Debt",
  "Transfer Fee",
  "Savings",
];

export async function getBudgetsWithActuals(
  periodStartDate: string,
): Promise<EnrichedBudget[]> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // 1. Get all expense categories
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("type", "expense")
    .order("name", { ascending: true });

  if (!categories || categories.length === 0) return [];

  // Exclude system-only categories (Discrepancy, Loan & Debt, Transfer Fee,
  // Savings) from ever being surfaced as budgetable — they're operational,
  // not user spending categories. `catMap` below intentionally still uses
  // the full `categories` list so that historical transactions filed under
  // these categories can still resolve their name/icon correctly elsewhere.
  const budgetableCategories = (categories as Category[]).filter(
    (c) => !SYSTEM_ONLY_CATEGORIES.includes(getCanonicalCategoryName(c.name)),
  );

  const catMap = new Map((categories as Category[]).map((c) => [c.id, c]));

  // 2. Get budgets for this period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: budgets } = await (supabase.from("budgets") as any)
    .select("*")
    .eq("period_start_date", periodStartDate);

  // 3. Get prior active budgets for auto-carryover if current period hasn't been set
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: priorBudgets } = await (supabase.from("budgets") as any)
    .select("*")
    .lt("period_start_date", periodStartDate)
    .gt("amount", 0)
    .order("period_start_date", { ascending: false });

  // Map latest prior budget by `${categoryId}:${currency}`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestPriorMap = new Map<string, any>();
  if (priorBudgets) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const pb of priorBudgets as any[]) {
      const cur: CurrencyCode = pb.currency || "IDR";
      const key = `${pb.category_id}:${cur}`;
      if (!latestPriorMap.has(key)) {
        latestPriorMap.set(key, pb);
      }
    }
  }

  // 4. Get transactions for this month range
  const startDate = `${periodStartDate}T00:00:00.000Z`;
  const endDate = `${format(endOfMonth(parseISO(periodStartDate)), "yyyy-MM-dd")}T23:59:59.999Z`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: txs } = await (supabase.from("transactions") as any)
    .select("category_id, amount, currency, type")
    .eq("type", "expense")
    .gte("transaction_date", startDate)
    .lte("transaction_date", endDate);

  // Map actual spending per categoryId and currency: key = `${categoryId}:${currency}`
  const actualSpentMap = new Map<string, number>();
  if (txs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of txs as any[]) {
      const cur: CurrencyCode = t.currency || "IDR";
      const key = `${t.category_id}:${cur}`;
      const current = actualSpentMap.get(key) || 0;
      actualSpentMap.set(key, current + Number(t.amount));
    }
  }

  const result: EnrichedBudget[] = [];
  const processedKeys = new Set<string>();

  // A. Add explicit saved budgets for current period
  if (budgets) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const b of budgets as any[]) {
      const cat = catMap.get(b.category_id);
      if (!cat) continue;

      const cur: CurrencyCode = b.currency || "IDR";
      const key = `${b.category_id}:${cur}`;
      processedKeys.add(key);

      result.push({
        id: b.id,
        user_id: user.id,
        category_id: b.category_id,
        amount: Number(b.amount) || 0,
        currency: cur,
        period_start_date: periodStartDate,
        created_at: b.created_at || new Date().toISOString(),
        category: cat,
        actual_spent: actualSpentMap.get(key) || 0,
      });
    }
  }

  // B. Auto-Carryover: For category & currency without explicit record in current period, inherit latest prior budget limit
  for (const [key, prior] of latestPriorMap.entries()) {
    if (!processedKeys.has(key)) {
      const cat = catMap.get(prior.category_id);
      if (!cat) continue;

      const cur: CurrencyCode = prior.currency || "IDR";
      processedKeys.add(key);

      result.push({
        id: `carried-${prior.category_id}-${cur}`,
        user_id: user.id,
        category_id: prior.category_id,
        amount: Number(prior.amount) || 0,
        currency: cur,
        period_start_date: periodStartDate,
        created_at: prior.created_at || new Date().toISOString(),
        category: cat,
        actual_spent: actualSpentMap.get(key) || 0,
      });
    }
  }

  // C. For categories with spending in this month without any budget set yet
  // Note: only iterates `budgetableCategories` (system-only categories like
  // Discrepancy/Loan & Debt/Transfer Fee/Savings are excluded) so they never
  // get auto-generated as virtual budget cards.
  for (const cat of budgetableCategories) {
    let hasAnyBudget = false;

    for (const [key, spent] of actualSpentMap.entries()) {
      if (key.startsWith(`${cat.id}:`)) {
        hasAnyBudget = true;
        if (!processedKeys.has(key)) {
          const cur = key.split(":")[1] as CurrencyCode;
          processedKeys.add(key);
          result.push({
            id: `virtual-${cat.id}-${cur}`,
            user_id: user.id,
            category_id: cat.id,
            amount: 0,
            currency: cur,
            period_start_date: periodStartDate,
            created_at: new Date().toISOString(),
            category: cat,
            actual_spent: spent,
          });
        }
      }
    }

    // Default virtual IDR budget for categories with 0 limit and 0 spending
    const defaultKey = `${cat.id}:IDR`;
    if (!hasAnyBudget && !processedKeys.has(defaultKey)) {
      processedKeys.add(defaultKey);
      result.push({
        id: `virtual-${cat.id}-IDR`,
        user_id: user.id,
        category_id: cat.id,
        amount: 0,
        currency: "IDR",
        period_start_date: periodStartDate,
        created_at: new Date().toISOString(),
        category: cat,
        actual_spent: 0,
      });
    }
  }

  // Sort: Active budgets first, then alphabetical by category name
  return result.sort((a, b) => {
    if ((a.amount || 0) > 0 && (b.amount || 0) <= 0) return -1;
    if ((b.amount || 0) > 0 && (a.amount || 0) <= 0) return 1;
    const nameA = a.category?.name || "";
    const nameB = b.category?.name || "";
    return nameA.localeCompare(nameB);
  });
}

export async function setBudget(input: {
  categoryId: string;
  amount: number;
  currency?: CurrencyCode;
  periodStartDate: string;
}) {
  const cur: CurrencyCode = input.currency || "IDR";
  const validation = budgetSchema.safeParse({ ...input, currency: cur });
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("budgets") as any)
    .upsert(
      {
        user_id: user.id,
        category_id: input.categoryId,
        amount: input.amount,
        currency: cur,
        period_start_date: input.periodStartDate,
      },
      { onConflict: "user_id, category_id, currency, period_start_date" },
    )
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/budget");
  revalidatePath("/");
  return { data };
}

export async function deleteBudget(budgetId: string) {
  if (budgetId.startsWith("virtual-") || budgetId.startsWith("carried-")) {
    return { success: true };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("budgets") as any)
    .delete()
    .eq("id", budgetId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/budget");
  revalidatePath("/");
  return { success: true };
}

export interface CategoryHistoryItem {
  periodStart: string;
  periodLabel: string;
  budgetAmount: number;
  actualSpent: number;
  currency: CurrencyCode;
}

export async function getCategoryBudgetHistory(
  categoryId: string,
  currency: CurrencyCode = "IDR",
  monthsCount: number = 6,
): Promise<CategoryHistoryItem[]> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const history: CategoryHistoryItem[] = [];
  const { getPreviousMonths } = await import("@/lib/utils/date");
  const months = getPreviousMonths(monthsCount);

  for (const m of months) {
    // 1. Budget for specified currency (with fallback to latest prior for accurate historical graph)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data: budget } = await (supabase.from("budgets") as any)
      .select("amount")
      .eq("category_id", categoryId)
      .eq("currency", currency)
      .eq("period_start_date", m.periodStart)
      .maybeSingle();

    if (!budget) {
      // Check prior
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pb } = await (supabase.from("budgets") as any)
        .select("amount")
        .eq("category_id", categoryId)
        .eq("currency", currency)
        .lt("period_start_date", m.periodStart)
        .gt("amount", 0)
        .order("period_start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pb) budget = pb;
    }

    // 2. Spending for specified currency
    const startDate = `${m.periodStart}T00:00:00.000Z`;
    const endDate = `${format(endOfMonth(parseISO(m.periodStart)), "yyyy-MM-dd")}T23:59:59.999Z`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: txs } = await (supabase.from("transactions") as any)
      .select("amount")
      .eq("category_id", categoryId)
      .eq("currency", currency)
      .eq("type", "expense")
      .gte("transaction_date", startDate)
      .lte("transaction_date", endDate);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spent = (txs || []).reduce(
      (acc: number, t: any) => acc + Number(t.amount),
      0,
    );

    history.push({
      periodStart: m.periodStart,
      periodLabel: m.label,
      budgetAmount: budget ? Number(budget.amount) : 0,
      actualSpent: spent,
      currency,
    });
  }

  return history;
}
