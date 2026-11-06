"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ExportSection =
  | "transactions"
  | "accounts"
  | "debts"
  | "budgets"
  | "categories"
  | "transfers"
  | "stockHoldings"
  | "stockTrades"
  | "cryptoHoldings"
  | "cryptoTrades";
export type ExportFormat = "csv" | "json";

// Catatan: file "use server" hanya boleh mengexport fungsi async (dan tipe),
// jadi konstanta ini tidak boleh di-export.
/** Data yang bisa dipilih per format. */
const EXPORT_SECTIONS: Record<ExportFormat, ExportSection[]> = {
  csv: [
    "transactions",
    "accounts",
    "debts",
    "transfers",
    "stockHoldings",
    "stockTrades",
    "cryptoHoldings",
    "cryptoTrades",
  ],
  json: [
    "transactions",
    "accounts",
    "debts",
    "budgets",
    "categories",
    "transfers",
    "stockHoldings",
    "stockTrades",
    "cryptoHoldings",
    "cryptoTrades",
  ],
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
  csvTransfers: string | null;
  csvStockHoldings: string | null;
  csvStockTrades: string | null;
  csvCryptoHoldings: string | null;
  csvCryptoTrades: string | null;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dateQuery = (table: string, dateColumn: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = (supabase as any)
      .from(table)
      .select("*, account:accounts(name)")
      .order(dateColumn, { ascending: false });
    if (rangeStart) query = query.gte(dateColumn, rangeStart);
    if (rangeEnd) query = query.lt(dateColumn, rangeEnd);
    return query;
  };

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let transferQuery: any = null;
  if (sections.includes("transfers")) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transferQuery = (supabase.from("transfers") as any)
      .select(
        "*, from_account:accounts!transfers_from_account_id_fkey(name), to_account:accounts!transfers_to_account_id_fkey(name)",
      )
      .order("transfer_date", { ascending: false });
    if (rangeStart) transferQuery = transferQuery.gte("transfer_date", rangeStart);
    if (rangeEnd) transferQuery = transferQuery.lt("transfer_date", rangeEnd);
  }

  const [
    transfersRes,
    stockHoldingsRes,
    stockTradesRes,
    cryptoHoldingsRes,
    cryptoTradesRes,
  ] = await Promise.all([
    transferQuery ?? skipped,
    sections.includes("stockHoldings")
      ? (supabase.from("stock_holdings") as any)
          .select("*, account:accounts(name)")
          .order("ticker", { ascending: true })
      : skipped,
    sections.includes("stockTrades")
      ? dateQuery("stock_trades", "trade_date")
      : skipped,
    sections.includes("cryptoHoldings")
      ? (supabase.from("crypto_holdings") as any)
          .select("*, account:accounts(name)")
          .order("symbol", { ascending: true })
      : skipped,
    sections.includes("cryptoTrades")
      ? dateQuery("crypto_trades", "trade_date")
      : skipped,
  ]);

  // Jangan diam-diam mengexport file kosong kalau query gagal.
  for (const res of [
    txsRes,
    accsRes,
    debtsRes,
    budgetsRes,
    catsRes,
    transfersRes,
    stockHoldingsRes,
    stockTradesRes,
    cryptoHoldingsRes,
    cryptoTradesRes,
  ]) {
    if (res.error) {
      throw new Error(`Export failed: ${res.error.message}`);
    }
  }

  const transactions = txsRes.data || [];
  const accounts = accsRes.data || [];
  const debts = debtsRes.data || [];
  const budgets = budgetsRes.data || [];
  const categories = catsRes.data || [];
  const transfers = transfersRes.data || [];
  const stockHoldings = stockHoldingsRes.data || [];
  const stockTrades = stockTradesRes.data || [];
  const cryptoHoldings = cryptoHoldingsRes.data || [];
  const cryptoTrades = cryptoTradesRes.data || [];

  const result: ExportResult = {
    csvTransactions: null,
    csvAccounts: null,
    csvDebts: null,
    csvTransfers: null,
    csvStockHoldings: null,
    csvStockTrades: null,
    csvCryptoHoldings: null,
    csvCryptoTrades: null,
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

    if (sections.includes("transfers")) {
      let csv =
        "ID,Transfer_Date,From_Account,To_Account,Amount,From_Currency,To_Currency,Exchange_Rate,Fee_Amount,Fee_Mode,Net_Amount,Description\n";
      for (const transfer of transfers as any[]) {
        csv += `${transfer.id},${transfer.transfer_date},${csvCell(transfer.from_account?.name)},${csvCell(transfer.to_account?.name)},${transfer.amount},${transfer.from_currency},${transfer.to_currency},${transfer.exchange_rate_used},${transfer.fee_amount},${transfer.fee_mode},${transfer.net_amount},${csvCell(transfer.description)}\n`;
      }
      result.csvTransfers = csv;
    }

    if (sections.includes("stockHoldings")) {
      let csv =
        "ID,Ticker,Account,Lots,Total_Shares,Total_Cost,Average_Buy_Price,Notes,Created_At,Updated_At\n";
      for (const holding of stockHoldings as any[]) {
        csv += `${holding.id},${holding.ticker},${csvCell(holding.account?.name)},${holding.lots},${holding.total_shares},${holding.total_cost},${holding.avg_buy_price},${csvCell(holding.notes)},${holding.created_at},${holding.updated_at}\n`;
      }
      result.csvStockHoldings = csv;
    }

    if (sections.includes("stockTrades")) {
      let csv =
        "ID,Trade_Date,Ticker,Type,Account,Lots,Shares,Price_Per_Share,Net_Amount,Buy_Cost,Realized_PnL,Stamp_Duty,Notes\n";
      for (const trade of stockTrades as any[]) {
        csv += `${trade.id},${trade.trade_date},${trade.ticker},${trade.type},${csvCell(trade.account?.name)},${trade.lots},${trade.shares},${trade.price_per_share},${trade.net_amount},${trade.buy_cost},${trade.realized_pnl},${trade.stamp_duty},${csvCell(trade.notes)}\n`;
      }
      result.csvStockTrades = csv;
    }

    if (sections.includes("cryptoHoldings")) {
      let csv =
        "ID,Symbol,Name,Account,Quantity,Cost_Basis,Average_Buy_Price,Manual_Price,Price_Currency,Notes,Created_At,Updated_At\n";
      for (const holding of cryptoHoldings as any[]) {
        csv += `${holding.id},${holding.symbol},${csvCell(holding.name)},${csvCell(holding.account?.name)},${holding.quantity},${holding.cost_basis},${holding.average_buy_price},${holding.manual_price},${holding.price_currency},${csvCell(holding.notes)},${holding.created_at},${holding.updated_at}\n`;
      }
      result.csvCryptoHoldings = csv;
    }

    if (sections.includes("cryptoTrades")) {
      let csv =
        "ID,Trade_Date,Symbol,Type,Account,Quantity,Gross_Amount,Fee_Amount,Fee_Currency,Price_Per_Unit,Cost_Basis,Realized_PnL,Notes\n";
      for (const trade of cryptoTrades as any[]) {
        csv += `${trade.id},${trade.trade_date},${trade.symbol},${trade.type},${csvCell(trade.account?.name)},${trade.quantity},${trade.gross_amount},${trade.fee_amount},${trade.fee_currency},${trade.price_per_unit},${trade.cost_basis},${trade.realized_pnl},${csvCell(trade.notes)}\n`;
      }
      result.csvCryptoTrades = csv;
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
    if (sections.includes("transfers")) payload.transfers = transfers;
    if (sections.includes("stockHoldings"))
      payload.stockHoldings = stockHoldings;
    if (sections.includes("stockTrades")) payload.stockTrades = stockTrades;
    if (sections.includes("cryptoHoldings"))
      payload.cryptoHoldings = cryptoHoldings;
    if (sections.includes("cryptoTrades")) payload.cryptoTrades = cryptoTrades;
    result.jsonData = JSON.stringify(payload, null, 2);
  }

  return result;
}
