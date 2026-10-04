"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ExportSection =
  | "transactions"
  | "accounts"
  | "debts"
  | "budgets"
  | "categories";
export type ExportFormat = "csv" | "json";

// Catatan: file "use server" hanya boleh mengexport fungsi async (dan tipe),
// jadi konstanta ini tidak boleh di-export.
/** Data yang bisa dipilih per format. CSV hanya punya tiga file. */
const EXPORT_SECTIONS: Record<ExportFormat, ExportSection[]> = {
  csv: ["transactions", "accounts", "debts"],
  json: ["transactions", "accounts", "debts", "budgets", "categories"],
};

export interface ExportOptions {
  format: ExportFormat;
  /** Data yang diexport. Default: semua yang didukung format tersebut. */
  sections?: ExportSection[];
  /** Batas bawah (inklusif), ISO timestamp lengkap. */
  rangeStart?: string;
  /** Batas atas (EKSKLUSIF), ISO timestamp lengkap: awal hari setelah tanggal akhir. */
  rangeEnd?: string;
}

export interface ExportResult {
  csvTransactions: string | null;
  csvAccounts: string | null;
  csvDebts: string | null;
  jsonData: string | null;
}

function parseBound(value?: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid date range");
  }
  return d.toISOString();
}

function csvCell(value: string | null | undefined): string {
  return `"${(value ?? "").replace(/"/g, '""')}"`;
}

export async function exportAllFinancialData(
  options: ExportOptions,
): Promise<ExportResult> {
  const { format } = options;
  const supported = EXPORT_SECTIONS[format];
  const requested = options.sections?.length ? options.sections : supported;
  const sections = requested.filter((s) => supported.includes(s));

  if (sections.length === 0) {
    throw new Error("No data selected");
  }

  const rangeStart = parseBound(options.rangeStart);
  const rangeEnd = parseBound(options.rangeEnd);
  if (rangeStart && rangeEnd && rangeStart >= rangeEnd) {
    throw new Error("Invalid date range");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Hanya query tabel yang dipilih.
  const skipped = Promise.resolve({ data: [], error: null });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let txQuery: any = null;
  if (sections.includes("transactions")) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    txQuery = (supabase.from("transactions") as any)
      .select("*, account:accounts(name), category:categories(name)")
      .order("transaction_date", { ascending: false });

    // Rentang setengah terbuka: [rangeStart, rangeEnd).
    // Jangan pakai .lte() dengan tanggal saja: "2026-09-30" dibaca sebagai
    // 2026-09-30 00:00 sehingga semua transaksi tanggal 30 ikut terpotong.
    if (rangeStart) txQuery = txQuery.gte("transaction_date", rangeStart);
    if (rangeEnd) txQuery = txQuery.lt("transaction_date", rangeEnd);
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [txsRes, accsRes, debtsRes, budgetsRes, catsRes] = await Promise.all([
    txQuery ?? skipped,
    sections.includes("accounts")
      ? (supabase.from("accounts") as any)
          .select("*")
          .order("created_at", { ascending: true })
      : skipped,
    sections.includes("debts")
      ? (supabase.from("debts") as any)
          .select("*, payments:debt_payments(*)")
          .order("created_at", { ascending: false })
      : skipped,
    sections.includes("budgets")
      ? (supabase.from("budgets") as any).select("*, category:categories(name)")
      : skipped,
    sections.includes("categories")
      ? (supabase.from("categories") as any).select("*")
      : skipped,
  ]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Jangan diam-diam mengexport file kosong kalau query gagal.
  for (const res of [txsRes, accsRes, debtsRes, budgetsRes, catsRes]) {
    if (res.error) {
      throw new Error(`Export failed: ${res.error.message}`);
    }
  }

  const transactions = txsRes.data || [];
  const accounts = accsRes.data || [];
  const debts = debtsRes.data || [];
  const budgets = budgetsRes.data || [];
  const categories = catsRes.data || [];

  const result: ExportResult = {
    csvTransactions: null,
    csvAccounts: null,
    csvDebts: null,
    jsonData: null,
  };

  if (format === "csv") {
    if (sections.includes("transactions")) {
      let csv =
        "ID,Date,Type,Amount,Currency,Account,Category,Description,Created_At\n";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const t of transactions as any[]) {
        csv += `${t.id},${t.transaction_date},${t.type},${t.amount},${t.currency},${csvCell(t.account?.name)},${csvCell(t.category?.name)},${csvCell(t.description)},${t.created_at}\n`;
      }
      result.csvTransactions = csv;
    }

    if (sections.includes("accounts")) {
      let csv =
        "ID,Name,Type,Currency,Current_Balance,Initial_Balance,Is_Active\n";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const a of accounts as any[]) {
        csv += `${a.id},${csvCell(a.name)},${a.type},${a.currency},${a.current_balance},${a.initial_balance},${a.is_active}\n`;
      }
      result.csvAccounts = csv;
    }

    if (sections.includes("debts")) {
      let csv =
        "ID,Counterparty,Type,Principal_Amount,Remaining_Amount,Currency,Status,Due_Date,Notes\n";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const d of debts as any[]) {
        csv += `${d.id},${csvCell(d.counterparty_name)},${d.type},${d.initial_amount},${d.remaining_amount},${d.currency},${d.status},${d.due_date || ""},${csvCell(d.notes)}\n`;
      }
      result.csvDebts = csv;
    }
  } else {
    const payload: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      userEmail: user.email,
      filters: { rangeStart: rangeStart ?? null, rangeEnd: rangeEnd ?? null },
      includes: sections,
    };
    if (sections.includes("accounts")) payload.accounts = accounts;
    if (sections.includes("categories")) payload.categories = categories;
    if (sections.includes("transactions")) payload.transactions = transactions;
    if (sections.includes("budgets")) payload.budgets = budgets;
    if (sections.includes("debts")) payload.debts = debts;
    result.jsonData = JSON.stringify(payload, null, 2);
  }

  return result;
}
