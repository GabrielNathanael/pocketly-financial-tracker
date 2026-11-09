import { convertAmount, type ForexRatesMap } from "@/lib/utils/currency";
import type { AssetPrice } from "@/lib/net-worth/prices";

export interface NetWorthBreakdownItem {
  id: string;
  name: string;
  amountIdr: number;
}

export interface NetWorthComputation {
  totalAccountsIdr: number;
  totalStockHoldingsIdr: number;
  totalCryptoHoldingsIdr: number;
  totalEtfHoldingsIdr: number;
  totalReceivablesIdr: number;
  totalSavingsGoalsIdr: number;
  totalDebtsIdr: number;
  totalAssetsIdr: number;
  netWorthIdr: number;
  accounts: NetWorthBreakdownItem[];
  stocks: NetWorthBreakdownItem[];
  crypto: NetWorthBreakdownItem[];
  etf: NetWorthBreakdownItem[];
  receivables: NetWorthBreakdownItem[];
  debts: NetWorthBreakdownItem[];
  goals: NetWorthBreakdownItem[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any };

/**
 * Compute net worth for one user in IDR (canonical base).
 * Values in DB are stored in their own currency; conversion uses
 * the supplied rates (USD-base matrix). Works with both the
 * user-scoped client (RLS) and the service-role admin client
 * (cron) — admin callers must pass an explicit userId.
 */
export async function computeNetWorthForUser(
  supabase: AnyClient,
  userId: string,
  rates: ForexRatesMap,
  prices?: Map<string, AssetPrice>,
): Promise<NetWorthComputation> {
  const toIdr = (amount: number, currency: string) =>
    convertAmount(amount, currency || "IDR", "IDR", rates);

  const [accountsRes, stocksRes, cryptoRes, etfRes, debtsRes, goalsRes] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("id, name, current_balance, currency")
        .eq("user_id", userId)
        .eq("is_active", true),
      supabase
        .from("stock_holdings")
        .select("id, ticker, total_cost, lots, total_shares, account:accounts(currency)")
        .eq("user_id", userId)
        .gt("total_cost", 0),
      supabase
        .from("crypto_holdings")
        .select("id, symbol, quantity, cost_basis, price_currency")
        .eq("user_id", userId)
        .gt("quantity", 0)
        .gt("cost_basis", 0),
      supabase
        .from("etf_holdings")
        .select("id, ticker, quantity, total_cost, account:accounts(currency)")
        .eq("user_id", userId)
        .gt("total_cost", 0),
      supabase
        .from("debts")
        .select("id, type, counterparty_name, remaining_amount, currency, status")
        .eq("user_id", userId)
        .eq("status", "active"),
      supabase
        .from("savings_goals")
        .select("id, name, current_amount, currency")
        .eq("user_id", userId)
        .gt("current_amount", 0),
    ]);

  const accounts: NetWorthBreakdownItem[] = ((accountsRes.data || []) as any[]).map(
    (a) => ({
      id: a.id,
      name: a.name || "Akun",
      amountIdr: toIdr(Number(a.current_balance) || 0, a.currency),
    }),
  );
  const totalAccountsIdr = accounts.reduce((s, a) => s + a.amountIdr, 0);

  // Market value if cached price exists, else fall back to cost basis.
  const marketOrCost = (
    kind: "stock" | "crypto" | "etf",
    symbol: string,
    quantity: number,
    costIdr: number,
  ): number => {
    const cached = prices?.get(`${kind}:${symbol.toUpperCase()}`);
    if (!cached || cached.price <= 0 || quantity <= 0) return costIdr;
    return toIdr(quantity * cached.price, cached.currency);
  };

  const stocks: NetWorthBreakdownItem[] = ((stocksRes.data || []) as any[]).map(
    (h) => {
      const costIdr = toIdr(
        Number(h.total_cost) || 0,
        h.account?.currency || "IDR",
      );
      const shares =
        Number(h.total_shares) || Number(h.lots || 0) * 100 || 0;
      return {
        id: h.id,
        name: h.ticker || "Saham",
        amountIdr: marketOrCost("stock", h.ticker || "", shares, costIdr),
      };
    },
  );
  const totalStockHoldingsIdr = stocks.reduce((s, x) => s + x.amountIdr, 0);

  const crypto: NetWorthBreakdownItem[] = ((cryptoRes.data || []) as any[]).map(
    (h) => {
      const costIdr = toIdr(
        Number(h.cost_basis) || 0,
        h.price_currency || "IDR",
      );
      return {
        id: h.id,
        name: h.symbol || "Kripto",
        amountIdr: marketOrCost(
          "crypto",
          h.symbol || "",
          Number(h.quantity) || 0,
          costIdr,
        ),
      };
    },
  );
  const totalCryptoHoldingsIdr = crypto.reduce((s, x) => s + x.amountIdr, 0);

  const etf: NetWorthBreakdownItem[] = ((etfRes.data || []) as any[]).map(
    (h) => {
      const costIdr = toIdr(
        Number(h.total_cost) || 0,
        h.account?.currency || "IDR",
      );
      return {
        id: h.id,
        name: h.ticker || "ETF",
        amountIdr: marketOrCost(
          "etf",
          h.ticker || "",
          Number(h.quantity) || 0,
          costIdr,
        ),
      };
    },
  );
  const totalEtfHoldingsIdr = etf.reduce((s, x) => s + x.amountIdr, 0);

  const receivables: NetWorthBreakdownItem[] = [];
  const debts: NetWorthBreakdownItem[] = [];
  let totalReceivablesIdr = 0;
  let totalDebtsIdr = 0;
  for (const d of (debtsRes.data || []) as any[]) {
    const amt = toIdr(Number(d.remaining_amount) || 0, d.currency);
    const item = {
      id: d.id,
      name: d.counterparty_name || "Pihak lain",
      amountIdr: amt,
    };
    if (d.type === "receivable") {
      receivables.push(item);
      totalReceivablesIdr += amt;
    } else {
      debts.push(item);
      totalDebtsIdr += amt;
    }
  }

  const goals: NetWorthBreakdownItem[] = ((goalsRes.data || []) as any[]).map(
    (g) => ({
      id: g.id,
      name: g.name || "Target",
      amountIdr: toIdr(Number(g.current_amount) || 0, g.currency),
    }),
  );
  const totalSavingsGoalsIdr = goals.reduce((s, x) => s + x.amountIdr, 0);

  const totalAssetsIdr =
    totalAccountsIdr +
    totalStockHoldingsIdr +
    totalCryptoHoldingsIdr +
    totalEtfHoldingsIdr +
    totalReceivablesIdr +
    totalSavingsGoalsIdr;
  const netWorthIdr = totalAssetsIdr - totalDebtsIdr;

  return {
    totalAccountsIdr,
    totalStockHoldingsIdr,
    totalCryptoHoldingsIdr,
    totalEtfHoldingsIdr,
    totalReceivablesIdr,
    totalSavingsGoalsIdr,
    totalDebtsIdr,
    totalAssetsIdr,
    netWorthIdr,
    accounts,
    stocks,
    crypto,
    etf,
    receivables,
    debts,
    goals,
  };
}
