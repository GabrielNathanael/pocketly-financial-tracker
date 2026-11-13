"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAssetPrices, type AssetPrice } from "@/lib/net-worth/prices";
import { getLatestForexRatesAdmin } from "@/lib/net-worth/forex";
import {
  convertAmount,
  type ForexRatesMap,
} from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/database";

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
  | "cryptoTrades"
  | "etfHoldings"
  | "etfTrades";
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
    "etfHoldings",
    "etfTrades",
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
    "etfHoldings",
    "etfTrades",
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
  csvEtfHoldings: string | null;
  csvEtfTrades: string | null;
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

/** Blank for null/undefined so CSV cells don't show "null" or "NaN". */
function numCell(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return String(value);
}

function pctCell(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return value.toFixed(2);
}

interface HoldingValuation {
  marketPrice: number | null;
  marketPriceCurrency: string | null;
  marketValueIdr: number | null;
  unrealizedPnlIdr: number | null;
  unrealizedPnlPercent: number | null;
  priceFetchedAt: string | null;
  valuationSource: "market" | "cost";
}

/**
 * Value one holding with the cached market price. The price cache is written
 * by the daily cron / manual refresh — export never calls an external API.
 * When no cached price exists we keep the fields empty instead of pretending
 * the cost basis is a market value.
 */
function valueHolding(
  prices: Map<string, AssetPrice>,
  rates: ForexRatesMap | undefined,
  kind: "stock" | "crypto" | "etf",
  symbol: string,
  quantity: number,
  cost: number,
  costCurrency: string,
): HoldingValuation {
  const empty: HoldingValuation = {
    marketPrice: null,
    marketPriceCurrency: null,
    marketValueIdr: null,
    unrealizedPnlIdr: null,
    unrealizedPnlPercent: null,
    priceFetchedAt: null,
    valuationSource: "cost",
  };

  const cached = prices.get(`${kind}:${(symbol || "").toUpperCase()}`);
  if (!cached || cached.price <= 0 || quantity <= 0) return empty;

  const costIdr = convertAmount(
    cost || 0,
    costCurrency || "IDR",
    "IDR",
    rates,
  );
  const marketValueIdr = convertAmount(
    quantity * cached.price,
    cached.currency || "IDR",
    "IDR",
    rates,
  );
  const pnl = marketValueIdr - costIdr;

  return {
    marketPrice: cached.price,
    marketPriceCurrency: cached.currency || "IDR",
    marketValueIdr,
    unrealizedPnlIdr: pnl,
    unrealizedPnlPercent: costIdr > 0 ? (pnl / costIdr) * 100 : null,
    priceFetchedAt: cached.fetchedAt || null,
    valuationSource: "market",
  };
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
  const skipped = Promise.resolve({ data: [] as unknown[], error: null as null });

  let txQuery: any = null;
  if (sections.includes("transactions")) {
    txQuery = supabase
      .from("transactions")
      .select("*, account:accounts(name), category:categories(name)")
      .order("transaction_date", { ascending: false });

    // Rentang setengah terbuka: [rangeStart, rangeEnd).
    // Jangan pakai .lte() dengan tanggal saja: "2026-09-30" dibaca sebagai
    // 2026-09-30 00:00 sehingga semua transaksi tanggal 30 ikut terpotong.
    if (rangeStart) txQuery = txQuery.gte("transaction_date", rangeStart);
    if (rangeEnd) txQuery = txQuery.lt("transaction_date", rangeEnd);
  }

  const stockTradesQuery = sections.includes("stockTrades")
    ? (() => {
        let q = supabase
          .from("stock_trades")
          .select("*, account:accounts(name)")
          .order("trade_date", { ascending: false });
        if (rangeStart) q = q.gte("trade_date", rangeStart);
        if (rangeEnd) q = q.lt("trade_date", rangeEnd);
        return q;
      })()
    : null;

  const cryptoTradesQuery = sections.includes("cryptoTrades")
    ? (() => {
        let q = supabase
          .from("crypto_trades")
          .select("*, account:accounts(name)")
          .order("trade_date", { ascending: false });
        if (rangeStart) q = q.gte("trade_date", rangeStart);
        if (rangeEnd) q = q.lt("trade_date", rangeEnd);
        return q;
      })()
    : null;

  const etfTradesQuery = sections.includes("etfTrades")
    ? (() => {
        let q = supabase
          .from("etf_trades")
          .select("*, account:accounts(name)")
          .order("trade_date", { ascending: false });
        if (rangeStart) q = q.gte("trade_date", rangeStart);
        if (rangeEnd) q = q.lt("trade_date", rangeEnd);
        return q;
      })()
    : null;

  let transferQuery: any = null;
  if (sections.includes("transfers")) {
    transferQuery = supabase
      .from("transfers")
      .select(
        "*, from_account:accounts!transfers_from_account_id_fkey(name), to_account:accounts!transfers_to_account_id_fkey(name)",
      )
      .order("transfer_date", { ascending: false });
    if (rangeStart) transferQuery = transferQuery.gte("transfer_date", rangeStart);
    if (rangeEnd) transferQuery = transferQuery.lt("transfer_date", rangeEnd);
  }

  const [txsRes, accsRes, debtsRes, budgetsRes, catsRes] = await Promise.all([
    txQuery ?? skipped,
    sections.includes("accounts")
      ? supabase
          .from("accounts")
          .select("*")
          .order("created_at", { ascending: true })
      : skipped,
    sections.includes("debts")
      ? supabase
          .from("debts")
          .select("*, payments:debt_payments(*)")
          .order("created_at", { ascending: false })
      : skipped,
    sections.includes("budgets")
      ? supabase.from("budgets").select("*, category:categories(name)")
      : skipped,
    sections.includes("categories")
      ? supabase.from("categories").select("*")
      : skipped,
  ]);

  const [
    transfersRes,
    stockHoldingsRes,
    stockTradesRes,
    cryptoHoldingsRes,
    cryptoTradesRes,
    etfHoldingsRes,
    etfTradesRes,
  ] = await Promise.all([
    transferQuery ?? skipped,
    sections.includes("stockHoldings")
      ? supabase
          .from("stock_holdings")
          .select("*, account:accounts(name, currency)")
          .order("ticker", { ascending: true })
      : skipped,
    stockTradesQuery ?? skipped,
    sections.includes("cryptoHoldings")
      ? supabase
          .from("crypto_holdings")
          .select("*, account:accounts(name)")
          .order("symbol", { ascending: true })
      : skipped,
    cryptoTradesQuery ?? skipped,
    sections.includes("etfHoldings")
      ? supabase
          .from("etf_holdings")
          .select("*, account:accounts(name, currency)")
          .order("ticker", { ascending: true })
      : skipped,
    etfTradesQuery ?? skipped,
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
    etfHoldingsRes,
    etfTradesRes,
  ]) {
    if (res.error) {
      throw new Error(`Export failed: ${res.error.message}`);
    }
  }

  const transactions = (txsRes.data || []) as any[];
  const accounts = (accsRes.data || []) as any[];
  const debts = (debtsRes.data || []) as any[];
  const budgets = (budgetsRes.data || []) as any[];
  const categories = (catsRes.data || []) as any[];
  const transfers = (transfersRes.data || []) as any[];
  const stockHoldings = (stockHoldingsRes.data || []) as any[];
  const stockTrades = (stockTradesRes.data || []) as any[];
  const cryptoHoldings = (cryptoHoldingsRes.data || []) as any[];
  const cryptoTrades = (cryptoTradesRes.data || []) as any[];
  const etfHoldings = (etfHoldingsRes.data || []) as any[];
  const etfTrades = (etfTradesRes.data || []) as any[];

  // Valuation only needs the local cache (asset_prices) + stored forex rates.
  const needsValuation = sections.some(
    (s) =>
      s === "stockHoldings" || s === "cryptoHoldings" || s === "etfHoldings",
  );
  const [prices, rates] = needsValuation
    ? await Promise.all([
        getAssetPrices(supabase as never),
        getLatestForexRatesAdmin(supabase as never),
      ])
    : [new Map<string, AssetPrice>(), undefined as ForexRatesMap | undefined];

  const result: ExportResult = {
    csvTransactions: null,
    csvAccounts: null,
    csvDebts: null,
    csvTransfers: null,
    csvStockHoldings: null,
    csvStockTrades: null,
    csvCryptoHoldings: null,
    csvCryptoTrades: null,
    csvEtfHoldings: null,
    csvEtfTrades: null,
    jsonData: null,
  };

  if (format === "csv") {
    if (sections.includes("transactions")) {
      let csv =
        "ID,Date,Type,Amount,Currency,Account,Category,Description,Created_At\n";
      for (const t of transactions) {
        csv += `${t.id},${t.transaction_date},${t.type},${t.amount},${t.currency},${csvCell(t.account?.name)},${csvCell(t.category?.name)},${csvCell(t.description)},${t.created_at}\n`;
      }
      result.csvTransactions = csv;
    }

    if (sections.includes("accounts")) {
      let csv =
        "ID,Name,Type,Currency,Current_Balance,Initial_Balance,Is_Active\n";
      for (const a of accounts) {
        csv += `${a.id},${csvCell(a.name)},${a.type},${a.currency},${a.current_balance},${a.initial_balance},${a.is_active}\n`;
      }
      result.csvAccounts = csv;
    }

    if (sections.includes("debts")) {
      let csv =
        "ID,Counterparty,Type,Principal_Amount,Remaining_Amount,Currency,Status,Due_Date,Notes\n";
      for (const d of debts) {
        csv += `${d.id},${csvCell(d.counterparty_name)},${d.type},${d.initial_amount},${d.remaining_amount},${d.currency},${d.status},${d.due_date || ""},${csvCell(d.notes)}\n`;
      }
      result.csvDebts = csv;
    }

    if (sections.includes("transfers")) {
      let csv =
        "ID,Transfer_Date,From_Account,To_Account,Amount,From_Currency,To_Currency,Exchange_Rate,Fee_Amount,Fee_Mode,Net_Amount,Description\n";
      for (const transfer of transfers) {
        csv += `${transfer.id},${transfer.transfer_date},${csvCell(transfer.from_account?.name)},${csvCell(transfer.to_account?.name)},${transfer.amount},${transfer.from_currency},${transfer.to_currency},${transfer.exchange_rate_used},${transfer.fee_amount},${transfer.fee_mode},${transfer.net_amount},${csvCell(transfer.description)}\n`;
      }
      result.csvTransfers = csv;
    }

    if (sections.includes("stockHoldings")) {
      let csv =
        "ID,Ticker,Account,Settlement_Currency,Lots,Total_Shares,Total_Cost,Average_Buy_Price,Market_Price,Market_Price_Currency,Market_Value_IDR,Unrealized_PnL_IDR,Unrealized_PnL_Pct,Price_Fetched_At,Valuation_Source,Notes,Created_At,Updated_At\n";
      for (const holding of stockHoldings) {
        const shares =
          Number(holding.total_shares) || Number(holding.lots || 0) * 100 || 0;
        const settlementCurrency =
          holding.currency || holding.account?.currency || "IDR";
        const v = valueHolding(
          prices,
          rates,
          "stock",
          holding.ticker || "",
          shares,
          Number(holding.total_cost) || 0,
          settlementCurrency,
        );
        csv += `${holding.id},${holding.ticker},${csvCell(holding.account?.name)},${csvCell(settlementCurrency)},${holding.lots},${holding.total_shares},${holding.total_cost},${holding.avg_buy_price},${numCell(v.marketPrice)},${csvCell(v.marketPriceCurrency)},${numCell(v.marketValueIdr)},${numCell(v.unrealizedPnlIdr)},${pctCell(v.unrealizedPnlPercent)},${csvCell(v.priceFetchedAt)},${v.valuationSource},${csvCell(holding.notes)},${holding.created_at},${holding.updated_at}\n`;
      }
      result.csvStockHoldings = csv;
    }

    if (sections.includes("stockTrades")) {
      let csv =
        "ID,Trade_Date,Ticker,Type,Account,Settlement_Currency,Lots,Shares,Price_Per_Share,Net_Amount,Buy_Cost,Realized_PnL,Stamp_Duty,Notes\n";
      for (const trade of stockTrades) {
        const settlementCurrency =
          trade.currency || trade.account?.currency || "IDR";
        csv += `${trade.id},${trade.trade_date},${trade.ticker},${trade.type},${csvCell(trade.account?.name)},${csvCell(settlementCurrency)},${trade.lots},${trade.shares},${trade.price_per_share},${trade.net_amount},${trade.buy_cost},${trade.realized_pnl},${trade.stamp_duty},${csvCell(trade.notes)}\n`;
      }
      result.csvStockTrades = csv;
    }

    if (sections.includes("cryptoHoldings")) {
      let csv =
        "ID,Symbol,Name,Account,Settlement_Currency,Quantity,Cost_Basis,Average_Buy_Price,Manual_Price,Price_Currency,Market_Price,Market_Price_Currency,Market_Value_IDR,Unrealized_PnL_IDR,Unrealized_PnL_Pct,Price_Fetched_At,Valuation_Source,Notes,Created_At,Updated_At\n";
      for (const holding of cryptoHoldings) {
        const settlementCurrency = holding.price_currency || "IDR";
        const v = valueHolding(
          prices,
          rates,
          "crypto",
          holding.symbol || "",
          Number(holding.quantity) || 0,
          Number(holding.cost_basis) || 0,
          settlementCurrency,
        );
        csv += `${holding.id},${holding.symbol},${csvCell(holding.name)},${csvCell(holding.account?.name)},${csvCell(settlementCurrency)},${holding.quantity},${holding.cost_basis},${holding.average_buy_price},${holding.manual_price},${holding.price_currency},${numCell(v.marketPrice)},${csvCell(v.marketPriceCurrency)},${numCell(v.marketValueIdr)},${numCell(v.unrealizedPnlIdr)},${pctCell(v.unrealizedPnlPercent)},${csvCell(v.priceFetchedAt)},${v.valuationSource},${csvCell(holding.notes)},${holding.created_at},${holding.updated_at}\n`;
      }
      result.csvCryptoHoldings = csv;
    }

    if (sections.includes("cryptoTrades")) {
      let csv =
        "ID,Trade_Date,Symbol,Type,Account,Settlement_Currency,Quantity,Gross_Amount,Fee_Amount,Fee_Currency,Price_Per_Unit,Cost_Basis,Realized_PnL,Notes\n";
      for (const trade of cryptoTrades) {
        const settlementCurrency =
          trade.currency || trade.fee_currency || "IDR";
        csv += `${trade.id},${trade.trade_date},${trade.symbol},${trade.type},${csvCell(trade.account?.name)},${csvCell(settlementCurrency)},${trade.quantity},${trade.gross_amount},${trade.fee_amount},${trade.fee_currency},${trade.price_per_unit},${trade.cost_basis},${trade.realized_pnl},${csvCell(trade.notes)}\n`;
      }
      result.csvCryptoTrades = csv;
    }

    if (sections.includes("etfHoldings")) {
      let csv =
        "ID,Ticker,Account,Settlement_Currency,Quantity,Total_Cost,Average_Buy_Price,Broker,Market_Price,Market_Price_Currency,Market_Value_IDR,Unrealized_PnL_IDR,Unrealized_PnL_Pct,Price_Fetched_At,Valuation_Source,Notes,Created_At,Updated_At\n";
      for (const holding of etfHoldings) {
        const settlementCurrency =
          holding.currency || holding.account?.currency || "IDR";
        const v = valueHolding(
          prices,
          rates,
          "etf",
          holding.ticker || "",
          Number(holding.quantity) || 0,
          Number(holding.total_cost) || 0,
          settlementCurrency,
        );
        csv += `${holding.id},${holding.ticker},${csvCell(holding.account?.name)},${csvCell(settlementCurrency)},${holding.quantity},${holding.total_cost},${holding.avg_buy_price},${csvCell(holding.broker_name)},${numCell(v.marketPrice)},${csvCell(v.marketPriceCurrency)},${numCell(v.marketValueIdr)},${numCell(v.unrealizedPnlIdr)},${pctCell(v.unrealizedPnlPercent)},${csvCell(v.priceFetchedAt)},${v.valuationSource},${csvCell(holding.notes)},${holding.created_at},${holding.updated_at}\n`;
      }
      result.csvEtfHoldings = csv;
    }

    if (sections.includes("etfTrades")) {
      let csv =
        "ID,Trade_Date,Ticker,Type,Account,Settlement_Currency,Quantity,Price_Per_Unit,Gross_Amount,Fee_Amount,Buy_Cost,Realized_PnL,Notes\n";
      for (const trade of etfTrades) {
        const settlementCurrency =
          trade.currency || trade.account?.currency || "IDR";
        csv += `${trade.id},${trade.trade_date},${trade.ticker},${trade.type},${csvCell(trade.account?.name)},${csvCell(settlementCurrency)},${trade.quantity},${trade.price_per_unit},${trade.gross_amount},${trade.fee_amount},${trade.buy_cost},${trade.realized_pnl},${csvCell(trade.notes)}\n`;
      }
      result.csvEtfTrades = csv;
    }
  } else {
    const payload: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      userEmail: user.email,
      filters: { rangeStart: rangeStart ?? null, rangeEnd: rangeEnd ?? null },
      includes: sections,
    };
    const enrichHoldings = (
      rows: any[],
      kind: "stock" | "crypto" | "etf",
      getSymbol: (h: any) => string,
      getQuantity: (h: any) => number,
      getCost: (h: any) => number,
      getCostCurrency: (h: any) => string,
    ) =>
      rows.map((h) => {
        const v = valueHolding(
          prices,
          rates,
          kind,
          getSymbol(h),
          getQuantity(h),
          getCost(h),
          getCostCurrency(h),
        );
        return {
          ...h,
          marketPrice: v.marketPrice,
          marketPriceCurrency: v.marketPriceCurrency,
          marketValueIdr: v.marketValueIdr,
          unrealizedPnlIdr: v.unrealizedPnlIdr,
          unrealizedPnlPercent: v.unrealizedPnlPercent,
          priceFetchedAt: v.priceFetchedAt,
          valuationSource: v.valuationSource,
        };
      });

    if (sections.includes("accounts")) payload.accounts = accounts;
    if (sections.includes("categories")) payload.categories = categories;
    if (sections.includes("transactions")) payload.transactions = transactions;
    if (sections.includes("budgets")) payload.budgets = budgets;
    if (sections.includes("debts")) payload.debts = debts;
    if (sections.includes("transfers")) payload.transfers = transfers;
    if (sections.includes("stockHoldings"))
      payload.stockHoldings = enrichHoldings(
        stockHoldings,
        "stock",
        (h) => h.ticker || "",
        (h) =>
          Number(h.total_shares) || Number(h.lots || 0) * 100 || 0,
        (h) => Number(h.total_cost) || 0,
        (h) => h.currency || h.account?.currency || "IDR",
      );
    if (sections.includes("stockTrades"))
      payload.stockTrades = stockTrades.map((t: any) => ({
        ...t,
        settlementCurrency: t.currency || t.account?.currency || "IDR",
      }));
    if (sections.includes("cryptoHoldings"))
      payload.cryptoHoldings = enrichHoldings(
        cryptoHoldings,
        "crypto",
        (h) => h.symbol || "",
        (h) => Number(h.quantity) || 0,
        (h) => Number(h.cost_basis) || 0,
        (h) => h.price_currency || "IDR",
      );
    if (sections.includes("cryptoTrades"))
      payload.cryptoTrades = cryptoTrades.map((t: any) => ({
        ...t,
        settlementCurrency: t.currency || t.fee_currency || "IDR",
      }));
    if (sections.includes("etfHoldings"))
      payload.etfHoldings = enrichHoldings(
        etfHoldings,
        "etf",
        (h) => h.ticker || "",
        (h) => Number(h.quantity) || 0,
        (h) => Number(h.total_cost) || 0,
        (h) => h.currency || h.account?.currency || "IDR",
      );
    if (sections.includes("etfTrades"))
      payload.etfTrades = etfTrades.map((t: any) => ({
        ...t,
        settlementCurrency: t.currency || t.account?.currency || "IDR",
      }));
    // etfTrades handled above with settlementCurrency enrichment.
    if (needsValuation) payload.rates = rates;
    result.jsonData = JSON.stringify(payload, null, 2);
  }

  return result;
}
