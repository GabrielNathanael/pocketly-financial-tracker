"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeISODate } from "@/lib/utils/date";
import {
  EnrichedCryptoHolding,
  EnrichedCryptoTrade,
  CurrencyCode,
} from "@/types/database";

const cleanSymbol = (value: string) => value.trim().toUpperCase();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCryptoFeeCategory(supabase: any, userId: string) {
  const { data } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "expense")
    .in("name", ["Crypto Trading Fee", "Biaya Trading Kripto", "Investment"])
    .limit(1)
    .maybeSingle();
  if (data) return data;
  const { data: created, error } = await supabase
    .from("categories")
    .insert({
      user_id: userId,
      name: "Crypto Trading Fee",
      type: "expense",
      icon: "Coins",
      color: "#F97316",
      is_default: false,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Gagal membuat kategori biaya kripto: ${error.message}`);
  return created;
}

async function syncCryptoHolding(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  accountId: string,
  symbol: string,
) {
  const { data: trades, error } = await supabase
    .from("crypto_trades")
    .select("*")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .ilike("symbol", symbol)
    .order("trade_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  let quantity = 0;
  let costBasis = 0;
  const latestTradePrice = trades?.length
    ? Number(trades[trades.length - 1].price_per_unit) || 0
    : 0;
  for (const trade of trades || []) {
    const qty = Number(trade.quantity);
    if (trade.type === "buy") {
      quantity += qty;
      costBasis += Number(trade.gross_amount) + Number(trade.fee_amount || 0);
    } else {
      const currentCost = quantity > 0 ? (qty / quantity) * costBasis : 0;
      quantity = Math.max(0, quantity - qty);
      costBasis = Math.max(0, costBasis - currentCost);
    }
  }

  const { data: current } = await supabase
    .from("crypto_holdings")
    .select("id, manual_price, price_currency, name, notes")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .ilike("symbol", symbol)
    .maybeSingle();

  if (quantity <= 0.000000000001) {
    if (current) {
      const { error: deleteError } = await supabase
        .from("crypto_holdings")
        .delete()
        .eq("id", current.id);
      if (deleteError) throw new Error(deleteError.message);
    }
    return;
  }

  const payload = {
    user_id: userId,
    account_id: accountId,
    symbol,
    name: current?.name || symbol,
    quantity,
    cost_basis: costBasis,
    average_buy_price: costBasis / quantity,
    manual_price: Number(current?.manual_price || latestTradePrice),
    price_currency: current?.price_currency || "IDR",
    notes: current?.notes || null,
    updated_at: new Date().toISOString(),
  };
  const query = current
    ? supabase.from("crypto_holdings").update(payload).eq("id", current.id)
    : supabase.from("crypto_holdings").insert(payload);
  const { error: saveError } = await query;
  if (saveError) throw new Error(saveError.message);
}

export async function getCryptoHoldings(): Promise<EnrichedCryptoHolding[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("crypto_holdings")
    .select("*, account:accounts(*)")
    .eq("user_id", user.id)
    .order("symbol", { ascending: true });
  if (error) {
    console.error("Error fetching crypto holdings:", error);
    return [];
  }
  return (data || []) as unknown as EnrichedCryptoHolding[];
}

export async function getCryptoTrades(): Promise<EnrichedCryptoTrade[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("crypto_trades")
    .select("*, account:accounts(*)")
    .eq("user_id", user.id)
    .order("trade_date", { ascending: false });
  if (error) {
    console.error("Error fetching crypto trades:", error);
    return [];
  }
  return (data || []) as unknown as EnrichedCryptoTrade[];
}

export async function recordCryptoBuy(input: {
  accountId: string;
  symbol: string;
  name?: string;
  quantity: number;
  grossAmount: number;
  feeAmount?: number;
  pricePerUnit: number;
  notes?: string | null;
  tradeDate?: string;
}) {
  return recordCryptoTrade({ ...input, type: "buy" });
}

export async function recordCryptoSell(input: {
  holdingId: string;
  quantity: number;
  grossAmount: number;
  feeAmount?: number;
  pricePerUnit: number;
  notes?: string | null;
  tradeDate?: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const { data: holding, error } = await supabase
    .from("crypto_holdings")
    .select("*")
    .eq("id", input.holdingId)
    .eq("user_id", user.id)
    .single();
  if (error || !holding) return { error: "Aset kripto tidak ditemukan" };
  if (input.quantity <= 0 || input.quantity > Number(holding.quantity)) {
    return { error: "Jumlah kripto yang dijual melebihi kepemilikan" };
  }
  return recordCryptoTrade({
    accountId: holding.account_id,
    symbol: holding.symbol,
    name: holding.name,
    quantity: input.quantity,
    grossAmount: input.grossAmount,
    feeAmount: input.feeAmount,
    pricePerUnit: input.pricePerUnit,
    notes: input.notes,
    tradeDate: input.tradeDate,
    type: "sell",
    holdingId: holding.id,
  });
}

async function recordCryptoTrade(input: {
  accountId: string;
  symbol: string;
  name?: string;
  quantity: number;
  grossAmount: number;
  feeAmount?: number;
  pricePerUnit: number;
  notes?: string | null;
  tradeDate?: string;
  type: "buy" | "sell";
  holdingId?: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const symbol = cleanSymbol(input.symbol);
  const quantity = Number(input.quantity);
  const grossAmount = Number(input.grossAmount);
  const feeAmount = Number(input.feeAmount || 0);
  const pricePerUnit = Number(input.pricePerUnit);
  if (!symbol || quantity <= 0 || grossAmount <= 0 || pricePerUnit <= 0 || feeAmount < 0) {
    return { error: "Jumlah, nominal, harga, dan biaya harus valid" };
  }

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, name, currency, current_balance")
    .eq("id", input.accountId)
    .eq("user_id", user.id)
    .single();
  if (accountError || !account) return { error: "Akun investasi tidak ditemukan" };

  const balance = Number(account.current_balance);
  const cashEffect = grossAmount;
  if (input.type === "buy" && balance < grossAmount + feeAmount) {
    return { error: `Saldo ${account.name} tidak mencukupi untuk nominal dan biaya` };
  }
  if (input.type === "sell" && feeAmount > grossAmount) {
    return { error: "Biaya penjualan tidak boleh melebihi hasil penjualan" };
  }

  const { data: existing } = await supabase
    .from("crypto_holdings")
    .select("cost_basis, quantity")
    .eq("id", input.holdingId || "")
    .maybeSingle();
  const costBasis = input.type === "sell" && existing
    ? (quantity / Number(existing.quantity)) * Number(existing.cost_basis)
    : input.type === "buy"
      ? grossAmount + feeAmount
      : 0;
  const realizedPnl = input.type === "sell"
    ? grossAmount - feeAmount - costBasis
    : 0;

  const { error: balanceError } = await supabase
    .from("accounts")
    .update({ current_balance: input.type === "buy" ? balance - cashEffect : balance + cashEffect })
    .eq("id", account.id)
    .eq("user_id", user.id);
  if (balanceError) return { error: balanceError.message };

  const tradeDate = normalizeISODate(input.tradeDate);
  const { data: trade, error: tradeError } = await supabase.from("crypto_trades").insert({
    user_id: user.id,
    account_id: account.id,
    holding_id: input.holdingId || null,
    symbol,
    type: input.type,
    quantity,
    gross_amount: grossAmount,
    fee_amount: feeAmount,
    fee_currency: account.currency as CurrencyCode,
    price_per_unit: pricePerUnit,
    cost_basis: costBasis,
    realized_pnl: realizedPnl,
    notes: input.notes?.trim() || null,
    trade_date: tradeDate,
  }).select("id").single();
  if (tradeError) {
    await supabase.from("accounts").update({ current_balance: balance }).eq("id", account.id);
    return { error: tradeError.message };
  }

  if (feeAmount > 0 && trade) {
    const category = await getCryptoFeeCategory(supabase, user.id);
    if (category) {
      const { error: feeError } = await supabase.from("transactions").insert({
        user_id: user.id,
        account_id: account.id,
        category_id: category.id,
        crypto_trade_id: trade.id,
        type: "expense",
        amount: feeAmount,
        currency: account.currency,
        description: `Biaya trading kripto ${symbol} (${account.name})`,
        transaction_date: tradeDate,
      });
      if (feeError) {
        console.error("Failed to record crypto fee:", feeError);
        await supabase.from("crypto_trades").delete().eq("id", trade.id).eq("user_id", user.id);
        await supabase.from("accounts").update({ current_balance: balance }).eq("id", account.id).eq("user_id", user.id);
        return { error: "Gagal mencatat biaya trading kripto; transaksi dibatalkan." };
      }
    }
  }

  try {
    await syncCryptoHolding(supabase, user.id, account.id, symbol);
  } catch (syncError) {
    console.error("Failed to sync crypto holding:", syncError);
    return { error: syncError instanceof Error ? syncError.message : "Gagal menyinkronkan aset kripto" };
  }
  revalidatePath("/investments");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/net-worth");
  revalidatePath("/transactions");
  return { success: true, realizedPnl };
}

export async function deleteCryptoTrade(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: trade, error: fetchError } = await supabase
    .from("crypto_trades")
    .select("*, account:accounts(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (fetchError || !trade) return { error: "Transaksi kripto tidak ditemukan" };

  const account = trade.account as unknown as { id: string; current_balance: number } | null;
  const cashEffect = Number(trade.gross_amount);

  if (account) {
    const balance = Number(account.current_balance) || 0;
    const nextBalance = trade.type === "buy" ? balance + cashEffect : balance - cashEffect;
    if (nextBalance < 0) return { error: "Saldo akun tidak cukup untuk membatalkan transaksi jual ini" };
    const { error: balanceError } = await supabase
      .from("accounts")
      .update({ current_balance: nextBalance })
      .eq("id", account.id)
      .eq("user_id", user.id);
    if (balanceError) return { error: balanceError.message };
  }

  const { error: deleteError } = await supabase
    .from("crypto_trades")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (deleteError) return { error: deleteError.message };

  await syncCryptoHolding(supabase, user.id, trade.account_id, cleanSymbol(trade.symbol));
  revalidatePath("/investments");
  revalidatePath("/accounts");
  revalidatePath("/net-worth");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { success: true };
}

export async function updateCryptoTrade(input: {
  id: string;
  quantity: number;
  grossAmount: number;
  feeAmount?: number;
  pricePerUnit: number;
  notes?: string | null;
  tradeDate?: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const quantity = Number(input.quantity);
  const grossAmount = Number(input.grossAmount);
  const feeAmount = Number(input.feeAmount || 0);
  const pricePerUnit = Number(input.pricePerUnit);
  if (quantity <= 0 || grossAmount <= 0 || feeAmount < 0 || pricePerUnit <= 0) {
    return { error: "Jumlah, nominal, harga, dan biaya harus valid" };
  }

  const { data: trade, error: fetchError } = await supabase
    .from("crypto_trades")
    .select("*, account:accounts(*)")
    .eq("id", input.id)
    .eq("user_id", user.id)
    .single();
  if (fetchError || !trade) return { error: "Transaksi kripto tidak ditemukan" };
  if (trade.type === "sell" && feeAmount > grossAmount) {
    return { error: "Biaya penjualan tidak boleh melebihi hasil penjualan" };
  }

  const account = trade.account as unknown as { id: string; current_balance: number } | null;
  const oldCashEffect = Number(trade.gross_amount);
  const newCashEffect = grossAmount;
  if (account) {
    const balance = Number(account.current_balance) || 0;
    const nextBalance = trade.type === "buy"
      ? balance + oldCashEffect - newCashEffect
      : balance - oldCashEffect + newCashEffect;
    if (nextBalance < 0) return { error: "Saldo akun tidak mencukupi untuk perubahan ini" };
    const { error: balanceError } = await supabase
      .from("accounts")
      .update({ current_balance: nextBalance })
      .eq("id", account.id)
      .eq("user_id", user.id);
    if (balanceError) return { error: balanceError.message };
  }

  const newCostBasis = trade.type === "buy"
    ? grossAmount + feeAmount
    : Number(trade.cost_basis || 0) * (quantity / Number(trade.quantity));
  const realizedPnl = trade.type === "sell"
    ? grossAmount - feeAmount - newCostBasis
    : 0;
  const tradeDate = normalizeISODate(input.tradeDate || trade.trade_date);

  const { error: updateError } = await supabase
    .from("crypto_trades")
    .update({
      quantity,
      gross_amount: grossAmount,
      fee_amount: feeAmount,
      price_per_unit: pricePerUnit,
      cost_basis: newCostBasis,
      realized_pnl: realizedPnl,
      notes: input.notes?.trim() || null,
      trade_date: tradeDate,
    })
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (updateError) return { error: updateError.message };

  await supabase.from("transactions").delete().eq("crypto_trade_id", input.id);
  if (feeAmount > 0) {
    const category = await getCryptoFeeCategory(supabase, user.id);
    if (category) {
      await supabase.from("transactions").insert({
        user_id: user.id,
        account_id: trade.account_id,
        category_id: category.id,
        crypto_trade_id: input.id,
        type: "expense",
        amount: feeAmount,
        currency: trade.fee_currency,
        description: `Biaya trading kripto ${trade.symbol}`,
        transaction_date: tradeDate,
      });
    }
  }

  await syncCryptoHolding(supabase, user.id, trade.account_id, cleanSymbol(trade.symbol));
  revalidatePath("/investments");
  revalidatePath("/accounts");
  revalidatePath("/net-worth");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { success: true, realizedPnl };
}

export async function updateCryptoManualPrice(input: {
  holdingId: string;
  manualPrice: number;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  if (input.manualPrice < 0) return { error: "Harga manual tidak boleh negatif" };
  const { error } = await supabase
    .from("crypto_holdings")
    .update({ manual_price: input.manualPrice, price_updated_at: new Date().toISOString() })
    .eq("id", input.holdingId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/investments");
  revalidatePath("/net-worth");
  return { success: true };
}

export async function createInvestmentCashTransfer(input: {
  fromAccountId: string;
  toAccountId: string;
  grossAmount: number;
  feeAmount?: number;
  description?: string | null;
  transferDate?: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const grossAmount = Number(input.grossAmount);
  const feeAmount = Number(input.feeAmount || 0);
  if (input.fromAccountId === input.toAccountId) return { error: "Akun sumber dan tujuan harus berbeda" };
  if (grossAmount <= 0 || feeAmount < 0 || feeAmount >= grossAmount) {
    return { error: "Nominal bruto dan biaya withdrawal tidak valid" };
  }

  const [{ data: from }, { data: to }] = await Promise.all([
    supabase.from("accounts").select("*").eq("id", input.fromAccountId).eq("user_id", user.id).single(),
    supabase.from("accounts").select("*").eq("id", input.toAccountId).eq("user_id", user.id).single(),
  ]);
  if (!from || !to) return { error: "Akun investasi atau akun tujuan tidak ditemukan" };
  if (from.currency !== to.currency) return { error: "Transfer saldo akun investasi saat ini harus menggunakan mata uang yang sama" };
  if (Number(from.current_balance) < grossAmount + feeAmount) return { error: "Saldo akun investasi tidak mencukupi untuk nominal dan biaya" };

  const netAmount = grossAmount;
  const transferDate = input.transferDate || new Date().toISOString();
  const { data: transfer, error: transferError } = await supabase.from("transfers").insert({
    user_id: user.id,
    from_account_id: from.id,
    to_account_id: to.id,
    amount: grossAmount,
    from_currency: from.currency,
    to_currency: to.currency,
    exchange_rate_used: 1,
    fee_amount: feeAmount,
    fee_mode: "added_to_source",
    net_amount: netAmount,
    description: input.description?.trim() || "Penarikan saldo akun investasi",
    transfer_date: transferDate,
  }).select("id").single();
  if (transferError) return { error: transferError.message };

  if (feeAmount > 0) {
    const category = await getCryptoFeeCategory(supabase, user.id);
    if (category) {
      const { error: feeError } = await supabase.from("transactions").insert({
        user_id: user.id,
        account_id: from.id,
        category_id: category.id,
        transfer_id: transfer.id,
        type: "expense",
        amount: feeAmount,
        currency: from.currency,
        description: `Biaya withdrawal akun investasi ke ${to.name}`,
        transaction_date: transferDate,
      });
      if (feeError) console.error("Failed to record investment cash transfer fee:", feeError);
    }
  }
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/net-worth");
  revalidatePath("/transactions");
  return { success: true, netAmount, feeAmount };
}
