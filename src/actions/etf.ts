// @ts-nocheck
"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeISODate } from "@/lib/utils/date";
import { getUserTimeZone } from "@/lib/utils/timezone-server";
import { EnrichedEtfHolding, EnrichedEtfTrade } from "@/types/database";
import { roundEtfQuantity } from "@/lib/utils/etf";

const cleanTicker = (v: string) => v.trim().toUpperCase();
const EPS = 1e-9;

function revalidateEtfPaths() {
  revalidatePath("/investments");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/net-worth");
  revalidatePath("/transactions");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getEtfFeeCategory(supabase: any, userId: string) {
  const { data } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "expense")
    .in("name", ["ETF Trading Fee", "Biaya Trading ETF", "Investment"])
    .limit(1)
    .maybeSingle();
  if (data) return data;
  const { data: created, error } = await supabase
    .from("categories")
    .insert({
      user_id: userId,
      name: "ETF Trading Fee",
      type: "expense",
      icon: "TrendingUp",
      color: "#6366F1",
      is_default: false,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created;
}

/**
 * Insert the broker-fee expense for an ETF trade.
 * Tries the `etf_trade_id` link first (migration 018). If the column has
 * not been applied yet, it falls back to a plain insert so the trade never
 * fails for this cosmetic linkage.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertEtfFee(supabase: any, args: {
  userId: string;
  accountId: string;
  categoryId: string;
  fee: number;
  currency: string;
  tradeId: string;
  description: string;
  tradeDate: string;
}) {
  const base = {
    user_id: args.userId,
    account_id: args.accountId,
    category_id: args.categoryId,
    type: "expense",
    amount: args.fee,
    currency: args.currency,
    description: args.description,
    transaction_date: args.tradeDate,
  };
  const { error } = await supabase
    .from("transactions")
    .insert({ ...base, etf_trade_id: args.tradeId });
  if (!error) return { error: null as null | unknown };
  const msg = String((error as { message?: string })?.message ?? "");
  if (/etf_trade_id|column/i.test(msg)) {
    const { error: fallbackError } = await supabase
      .from("transactions")
      .insert(base);
    return { error: fallbackError ?? null };
  }
  return { error };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deleteEtfFee(supabase: any, tradeId: string) {
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("etf_trade_id", tradeId);
  // Column may not exist yet (pre-018). Orphan fee rows are harmless
  // in that state, so intentionally swallow this specific error.
  if (error && /etf_trade_id|column/i.test(String(error.message ?? ""))) {
    return;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncEtfHolding(supabase: any, userId: string, accountId: string, ticker: string) {
  const clean = cleanTicker(ticker);
  const { data: trades, error } = await supabase
    .from("etf_trades")
    .select("*")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .ilike("ticker", clean)
    .order("trade_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  let quantity = 0;
  let costBasis = 0;
  for (const t of trades || []) {
    const q = Number(t.quantity);
    if (t.type === "buy") {
      quantity += q;
      costBasis += Number(t.buy_cost) || 0;
    } else {
      const cur = quantity > 0 ? (q / quantity) * costBasis : 0;
      quantity = Math.max(0, quantity - q);
      costBasis = Math.max(0, costBasis - cur);
    }
  }
  const { data: current } = await supabase
    .from("etf_holdings")
    .select("id, broker_name, notes")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .ilike("ticker", clean)
    .maybeSingle();
  if (quantity <= EPS) {
    if (current) await supabase.from("etf_holdings").delete().eq("id", current.id);
    return;
  }
  const payload = {
    user_id: userId,
    account_id: accountId,
    ticker: clean,
    quantity,
    total_cost: costBasis,
    avg_buy_price: costBasis / quantity,
    broker_name: current?.broker_name || null,
    notes: current?.notes || null,
    updated_at: new Date().toISOString(),
  };
  const q = current
    ? supabase.from("etf_holdings").update(payload).eq("id", current.id)
    : supabase.from("etf_holdings").insert(payload);
  const { error: se } = await q;
  if (se) throw new Error(se.message);
}

export async function getEtfHoldings(): Promise<EnrichedEtfHolding[]> {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await sb
    .from("etf_holdings")
    .select("*, account:accounts(*)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return (data as EnrichedEtfHolding[]) || [];
}

export async function getEtfTrades(): Promise<EnrichedEtfTrade[]> {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await sb
    .from("etf_trades")
    .select("*, account:accounts(*)")
    .eq("user_id", user.id)
    .order("trade_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return (data as EnrichedEtfTrade[]) || [];
}

export interface RecordEtfTradeInput {
  accountId: string;
  ticker: string;
  type: "buy" | "sell";
  quantity: number;
  pricePerUnit: number;
  feeAmount?: number;
  brokerName?: string;
  tradeDate?: string;
  notes?: string | null;
}

export async function recordEtfTrade(input: RecordEtfTradeInput) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const ticker = cleanTicker(input.ticker);
  const qty = roundEtfQuantity(Number(input.quantity));
  const price = Number(input.pricePerUnit);
  const fee = Number(input.feeAmount || 0);

  if (!ticker) return { error: "Ticker ETF wajib diisi (misal: VOO, QQQ, SCHD)" };
  if (!(qty > 0)) return { error: "Jumlah unit ETF harus lebih dari 0" };
  if (!(price > 0)) return { error: "Harga per unit ETF harus lebih dari 0" };
  if (!(fee >= 0)) return { error: "Biaya broker tidak boleh negatif" };

  const gross = qty * price;
  if (!(gross > 0)) return { error: "Nominal transaksi ETF tidak valid" };
  if (input.type === "sell" && fee > gross + EPS) {
    return { error: "Biaya jual tidak boleh melebihi hasil penjualan bruto" };
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", input.accountId)
    .eq("user_id", user.id)
    .single();
  if (!account) return { error: "Akun broker tidak ditemukan" };

  const balance = Number(account.current_balance) || 0;
  let buyCost = 0;
  let realizedPnl = 0;

  if (input.type === "buy") {
    if (balance < gross + fee - EPS) {
      return {
        error: `Saldo ${account.name} tidak cukup. Dibutuhkan: ${gross + fee}, Tersedia: ${balance}`,
      };
    }
    buyCost = gross + fee;
  } else {
    const { data: holding } = await supabase
      .from("etf_holdings")
      .select("*")
      .eq("user_id", user.id)
      .eq("account_id", account.id)
      .ilike("ticker", ticker)
      .maybeSingle();
    const held = Number(holding?.quantity || 0);
    if (!(held + EPS >= qty)) {
      return {
        error: `Jumlah jual melebihi kepemilikan. Tersedia: ${held} unit, Dijual: ${qty} unit`,
      };
    }
    buyCost = held > 0 ? (qty / held) * Number(holding.total_cost || 0) : 0;
    realizedPnl = gross - fee - buyCost;
  }

  const cashEffect = input.type === "buy" ? gross + fee : gross - fee;
  const nextBalance =
    input.type === "buy" ? balance - cashEffect : balance + cashEffect;
  const { error: be } = await supabase
    .from("accounts")
    .update({ current_balance: nextBalance })
    .eq("id", account.id)
    .eq("user_id", user.id);
  if (be) return { error: be.message };

  const tradeDate = normalizeISODate(input.tradeDate, await getUserTimeZone());
  const { data: trade, error: te } = await supabase
    .from("etf_trades")
    .insert({
      user_id: user.id,
      account_id: account.id,
      ticker,
      type: input.type,
      quantity: qty,
      price_per_unit: price,
      gross_amount: gross,
      fee_amount: fee,
      buy_cost: buyCost,
      realized_pnl: realizedPnl,
      notes: input.notes?.trim() || null,
      trade_date: tradeDate,
    })
    .select("id")
    .single();
  if (te || !trade) {
    await supabase
      .from("accounts")
      .update({ current_balance: balance })
      .eq("id", account.id);
    return { error: te?.message || "Gagal mencatat transaksi ETF" };
  }

  if (fee > EPS) {
    const cat = await getEtfFeeCategory(supabase, user.id);
    const { error: fe } = await insertEtfFee(supabase, {
      userId: user.id,
      accountId: account.id,
      categoryId: cat.id,
      fee,
      currency: account.currency || "IDR",
      tradeId: trade.id,
      description: `Biaya trading ETF ${ticker} (${account.name})`,
      tradeDate,
    });
    if (fe) {
      await supabase.from("etf_trades").delete().eq("id", trade.id);
      await supabase
        .from("accounts")
        .update({ current_balance: balance })
        .eq("id", account.id);
      return { error: "Gagal mencatat biaya broker ETF; transaksi dibatalkan" };
    }
  }

  // Keep broker name on the holding if provided.
  if (input.brokerName?.trim()) {
    await supabase
      .from("etf_holdings")
      .update({ broker_name: input.brokerName.trim() })
      .eq("user_id", user.id)
      .eq("account_id", account.id)
      .ilike("ticker", ticker);
  }

  try {
    await syncEtfHolding(supabase, user.id, account.id, ticker);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyinkronkan kepemilikan ETF" };
  }
  revalidateEtfPaths();
  return { success: true, realizedPnl, quantity: qty, grossAmount: gross };
}

/**
 * Beli ETF berdasarkan NOMINAL (cicilan / DCA).
 * User cukup isi "uang yang mau dipakai" + harga per unit,
 * jumlah unit dihitung otomatis (fraksional, 6 desimal).
 * Transaksi berikutnya bisa diulang — setiap cicilan menambah posisi
 * dan harga rata-rata dihitung ulang lewat syncEtfHolding.
 */
export async function recordEtfBuyByNominal(input: {
  accountId: string;
  ticker: string;
  nominalAmount: number; // bruto (qty x price), fee dihitung terpisah
  pricePerUnit: number;
  feeAmount?: number;
  brokerName?: string;
  tradeDate?: string;
  notes?: string | null;
}) {
  const nominal = Number(input.nominalAmount);
  const price = Number(input.pricePerUnit);
  if (!(nominal > 0)) return { error: "Nominal cicilan harus lebih dari 0" };
  if (!(price > 0)) return { error: "Harga per unit ETF harus lebih dari 0" };
  const quantity = roundEtfQuantity(nominal / price);
  if (!(quantity > 0)) {
    return {
      error:
        "Nominal terlalu kecil untuk 1 unit minimum (0,000001). Naikkan nominal atau turunkan harga.",
    };
  }
  // Snap gross to the rounded quantity so preview == ledger exactly.
  const snappedGross = quantity * price;
  const result = await recordEtfTrade({
    accountId: input.accountId,
    ticker: input.ticker,
    type: "buy",
    quantity,
    pricePerUnit: price,
    feeAmount: input.feeAmount,
    brokerName: input.brokerName,
    tradeDate: input.tradeDate,
    notes: input.notes,
  });
  if (result.error) return result;
  return { ...result, quantity, grossAmount: snappedGross };
}

/**
 * Jual ETF sebagian berdasarkan persentase kepemilikan
 * (25% / 50% / 75% / 100%). Sisa posisi tetap disimpan.
 */
export async function recordEtfSellByPercent(input: {
  holdingId: string;
  percent: number; // 0-100
  pricePerUnit: number;
  feeAmount?: number;
  tradeDate?: string;
  notes?: string | null;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const pct = Number(input.percent);
  if (!(pct > 0 && pct <= 100)) return { error: "Persentase jual harus 1–100%" };
  const price = Number(input.pricePerUnit);
  if (!(price > 0)) return { error: "Harga jual per unit harus lebih dari 0" };

  const { data: holding } = await supabase
    .from("etf_holdings")
    .select("*")
    .eq("id", input.holdingId)
    .eq("user_id", user.id)
    .single();
  if (!holding) return { error: "Kepemilikan ETF tidak ditemukan" };

  const held = Number(holding.quantity) || 0;
  if (!(held > 0)) return { error: "Tidak ada unit ETF yang dimiliki" };

  // 100% -> sell everything (avoid dust); otherwise fractional partial.
  const qty =
    pct >= 100
      ? held
      : roundEtfQuantity((held * pct) / 100);
  if (!(qty > 0)) return { error: "Jumlah jual terlalu kecil" };

  return recordEtfTrade({
    accountId: holding.account_id,
    ticker: holding.ticker,
    type: "sell",
    quantity: qty,
    pricePerUnit: price,
    feeAmount: input.feeAmount,
    tradeDate: input.tradeDate,
    notes: input.notes,
  });
}

export async function updateEtfTrade(input: {
  id: string;
  quantity: number;
  pricePerUnit: number;
  feeAmount?: number;
  notes?: string | null;
  tradeDate?: string;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const qty = roundEtfQuantity(Number(input.quantity));
  const price = Number(input.pricePerUnit);
  const fee = Number(input.feeAmount || 0);
  if (!(qty > 0)) return { error: "Jumlah unit ETF harus lebih dari 0" };
  if (!(price > 0)) return { error: "Harga per unit ETF harus lebih dari 0" };
  if (!(fee >= 0)) return { error: "Biaya broker tidak boleh negatif" };

  const gross = qty * price;
  if (!(gross > 0)) return { error: "Nominal transaksi ETF tidak valid" };

  const { data: trade } = await supabase
    .from("etf_trades")
    .select("*, account:accounts(*)")
    .eq("id", input.id)
    .eq("user_id", user.id)
    .single();
  if (!trade) return { error: "Transaksi ETF tidak ditemukan" };

  const account = trade.account as unknown as {
    id: string;
    name: string;
    currency: string;
    current_balance: number;
  } | null;
  if (!account) return { error: "Akun broker tidak ditemukan" };

  const oldGross = Number(trade.gross_amount) || 0;
  const oldFee = Number(trade.fee_amount) || 0;
  const oldQty = Number(trade.quantity) || 0;
  const oldBuyCost = Number(trade.buy_cost) || 0;

  const oldCashEffect =
    trade.type === "buy" ? oldGross + oldFee : oldGross - oldFee;
  const newCashEffect = trade.type === "buy" ? gross + fee : gross - fee;
  const delta = newCashEffect - oldCashEffect;

  if (trade.type === "sell" && fee > gross + EPS) {
    return { error: "Biaya jual tidak boleh melebihi hasil penjualan bruto" };
  }

  // Proportional buy cost for sells (partial-sell aware).
  let newBuyCost = gross + fee;
  let realizedPnl = 0;
  if (trade.type === "sell") {
    const { data: holding } = await supabase
      .from("etf_holdings")
      .select("*")
      .eq("user_id", user.id)
      .eq("account_id", account.id)
      .ilike("ticker", trade.ticker)
      .maybeSingle();
    // Current holding already excludes this sell. Add it back to get the
    // total units available before the sale, and add its cost back.
    const heldNow = Number(holding?.quantity || 0);
    const costNow = Number(holding?.total_cost || 0);
    const maxQty = heldNow + oldQty;
    if (!(maxQty + EPS >= qty)) {
      return {
        error: `Jumlah jual melebihi kepemilikan. Tersedia: ${maxQty} unit, Dijual: ${qty} unit`,
      };
    }
    const totalCostBefore = costNow + oldBuyCost;
    newBuyCost = maxQty > 0 ? (qty / maxQty) * totalCostBefore : 0;
    realizedPnl = gross - fee - newBuyCost;
  }

  const balance = Number(account.current_balance) || 0;
  const nextBalance =
    trade.type === "buy" ? balance - delta : balance + delta;
  if (trade.type === "buy" && nextBalance < -EPS) {
    return {
      error: `Saldo ${account.name} tidak cukup untuk perubahan ini.`,
    };
  }
  if (trade.type === "sell" && nextBalance < -EPS) {
    return {
      error: `Saldo ${account.name} tidak cukup untuk membatalkan/mengubah penjualan ini.`,
    };
  }

  const { error: balanceError } = await supabase
    .from("accounts")
    .update({ current_balance: nextBalance })
    .eq("id", account.id)
    .eq("user_id", user.id);
  if (balanceError) return { error: balanceError.message };

  const tradeDate = input.tradeDate
    ? normalizeISODate(input.tradeDate, await getUserTimeZone())
    : trade.trade_date;

  const { error: updErr } = await supabase
    .from("etf_trades")
    .update({
      quantity: qty,
      price_per_unit: price,
      gross_amount: gross,
      fee_amount: fee,
      buy_cost: newBuyCost,
      realized_pnl: realizedPnl,
      notes: input.notes?.trim() || null,
      trade_date: tradeDate,
    })
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (updErr) {
    await supabase
      .from("accounts")
      .update({ current_balance: balance })
      .eq("id", account.id);
    return { error: updErr.message };
  }

  // Rebuild fee expense so the ledger never shows a stale amount.
  await deleteEtfFee(supabase, input.id);
  if (fee > EPS && newBuyCost !== undefined) {
    const cat = await getEtfFeeCategory(supabase, user.id);
    await insertEtfFee(supabase, {
      userId: user.id,
      accountId: account.id,
      categoryId: cat.id,
      fee,
      currency: account.currency || "IDR",
      tradeId: input.id,
      description: `Biaya trading ETF ${trade.ticker} (${account.name})`,
      tradeDate,
    });
  }

  try {
    await syncEtfHolding(supabase, user.id, account.id, cleanTicker(trade.ticker));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyinkronkan kepemilikan ETF" };
  }
  revalidateEtfPaths();
  return { success: true, realizedPnl };
}

export async function deleteEtfTrade(id: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: trade } = await supabase
    .from("etf_trades")
    .select("*, account:accounts(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!trade) return { error: "Transaksi ETF tidak ditemukan" };

  const account = trade.account as unknown as {
    id: string;
    current_balance: number;
  } | null;
  const gross = Number(trade.gross_amount) || 0;
  const fee = Number(trade.fee_amount) || 0;

  if (account) {
    const bal = Number(account.current_balance) || 0;
    const next =
      trade.type === "buy" ? bal + gross + fee : bal - (gross - fee);
    if (next < -EPS) return { error: "Saldo tidak cukup untuk membatalkan transaksi ini" };
    const { error: be } = await supabase
      .from("accounts")
      .update({ current_balance: next })
      .eq("id", account.id)
      .eq("user_id", user.id);
    if (be) return { error: be.message };
  }

  // Fee link has ON DELETE CASCADE (018), but delete explicitly too so
  // pre-018 rows edited/deleted here do not orphan (best effort).
  await deleteEtfFee(supabase, id);
  const { error: de } = await supabase
    .from("etf_trades")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (de) return { error: de.message };

  try {
    await syncEtfHolding(supabase, user.id, trade.account_id, cleanTicker(trade.ticker));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyinkronkan kepemilikan ETF" };
  }
  revalidateEtfPaths();
  return { success: true };
}
