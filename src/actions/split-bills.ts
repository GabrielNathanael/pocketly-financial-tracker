"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createTransaction } from "@/actions/transactions";
import { CURRENCY_CODES, DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/constants/currencies";
import {
  calculateSplitBill,
  buildMyPortionDescriptionFromRows,
} from "@/lib/utils/split-bill";
import type { TransactionItem } from "@/lib/utils/transaction-items";

const SUPPORTED_CURRENCIES = new Set<string>(CURRENCY_CODES);
function normalizeCurrency(v: unknown): CurrencyCode {
  const up = String(v || "").toUpperCase();
  return (SUPPORTED_CURRENCIES.has(up) ? up : DEFAULT_CURRENCY) as CurrencyCode;
}
import type {
  SplitBillFull,
  SplitBillContact,
  SplitBill,
  SplitBillParticipant,
  SplitBillItem,
  SplitBillItemAssignment,
  SplitBillCharge,
  SplitBillImage,
} from "@/types/split-bill";

async function getAuthed() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesi kamu sudah habis. Silakan login ulang.");
  return { supabase, user };
}

/**
 * Error dari Postgres/Supabase itu teknis banget ("violates foreign key constraint ...").
 * User nggak perlu lihat itu — Logs aja di server, di UI muncul pesan singkat & ramah.
 */
function friendlySaveError(err: unknown, fallback = "Gagal menyimpan patungan. Coba lagi ya."): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  console.error("[split-bill] simpan gagal:", raw);
  const m = raw.toLowerCase();
  if (m.includes("foreign key") || m.includes("violates")) {
    return "Ada data peserta yang sudah tidak valid. Muat ulang halaman lalu coba lagi.";
  }
  if (m.includes("duplicate key")) return "Data-nya sudah ada. Coba lagi ya.";
  if (m.includes("row-level security") || m.includes("policy")) {
    return "Kamu belum punya akses untuk menyimpan data ini.";
  }
  if (m.includes("timeout") || m.includes("network") || m.includes("fetch failed")) {
    return "Koneksi ke server terputus. Coba lagi ya.";
  }
  if (m.includes("not-null")) return "Ada data yang belum lengkap. Isi dulu bagian yang kosong.";
  return fallback;
}

export async function getSplitBills(): Promise<SplitBill[]> {
  const { supabase, user } = await getAuthed();
  const sb = supabase as any;
  const { data, error } = await sb
    .from("split_bills")
    .select("*")
    .eq("user_id", user.id)
    .order("bill_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  const bills = (data || []) as SplitBill[];
  const recordedIds = bills.map((b) => b.my_recorded_transaction_id).filter((id): id is string => !!id);
  if (recordedIds.length === 0) return bills;

  const { data: txs } = await sb
    .from("transactions")
    .select("id")
    .eq("user_id", user.id)
    .in("id", recordedIds);
  const existing = new Set((txs || []).map((t: any) => t.id as string));
  const stale = bills.filter((b) => b.my_recorded_transaction_id && !existing.has(b.my_recorded_transaction_id));

  if (stale.length > 0) {
    await Promise.all(
      stale.map((b) =>
        sb
          .from("split_bills")
          .update({ my_recorded_transaction_id: null, my_recorded_at: null, updated_at: new Date().toISOString() })
          .eq("id", b.id)
          .eq("user_id", user.id)
      )
    );
    for (const b of stale) {
      b.my_recorded_transaction_id = null;
      b.my_recorded_at = null;
    }
  }
  return bills;
}

export async function getSplitBillById(id: string): Promise<SplitBillFull | null> {
  const { supabase, user } = await getAuthed();
  const sb = supabase as any;
  const { data: bill, error } = await sb
    .from("split_bills")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (error || !bill) return null;

  // Clear stale recorded-transaction marker if the linked transaction no longer exists
  if (bill.my_recorded_transaction_id) {
    const { data: tx } = await sb
      .from("transactions")
      .select("id")
      .eq("id", bill.my_recorded_transaction_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!tx) {
      await sb
        .from("split_bills")
        .update({ my_recorded_transaction_id: null, my_recorded_at: null, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);
      bill.my_recorded_transaction_id = null;
      bill.my_recorded_at = null;
    }
  }

  const [participantsRes, itemsRes, assignmentsRes, chargesRes, imagesRes] = await Promise.all([
    sb.from("split_bill_participants").select("*").eq("split_bill_id", id).eq("user_id", user.id).order("sort_order"),
    sb.from("split_bill_items").select("*").eq("split_bill_id", id).eq("user_id", user.id).order("sort_order"),
    sb.from("split_bill_item_assignments").select("*").eq("split_bill_id", id).eq("user_id", user.id),
    sb.from("split_bill_charges").select("*").eq("split_bill_id", id).eq("user_id", user.id).order("sort_order"),
    sb.from("split_bill_images").select("*").eq("split_bill_id", id).eq("user_id", user.id).order("sort_order"),
  ]);

  const images = (imagesRes.data || []) as SplitBillImage[];
  const imagesWithUrls: SplitBillImage[] = await Promise.all(
    images.map(async (img) => {
      const { data } = await supabase.storage.from("split-bill-images").createSignedUrl(img.storage_path, 60 * 60 * 24);
      return { ...img, signed_url: data?.signedUrl };
    })
  );

  return {
    ...(bill as SplitBill),
    participants: (participantsRes.data || []) as SplitBillParticipant[],
    items: (itemsRes.data || []) as SplitBillItem[],
    assignments: (assignmentsRes.data || []) as SplitBillItemAssignment[],
    charges: (chargesRes.data || []) as SplitBillCharge[],
    images: imagesWithUrls,
  };
}

type SaveSplitBillInput = {
  id?: string;
  title: string;
  bill_date: string;
  currency: string;
  subtotal_amount: number;
  grand_total_amount: number;
  status: "draft" | "balanced";
  /** proportional = biaya dibagi sesuai nilai item; equal = semua orang bayar sama */
  split_mode?: "proportional" | "equal";
  notes?: string | null;
  /** Skip revalidatePath (e.g. when creating draft during server render/redirect). */
  skipRevalidate?: boolean;
  participants: Array<{
    id?: string;
    name: string;
    is_me?: boolean;
    contact_id?: string | null;
    avatar_style?: string | null;
    avatar_seed?: string | null;
    sort_order?: number;
  }>;
  items: Array<{ id?: string; name: string; quantity: number; unit_price: number; line_subtotal: number; item_discount?: number; item_discount_mode?: "percent" | "fixed"; sort_order?: number; notes?: string | null }>;
  charges: Array<{ id?: string; name: string; kind: "tax" | "service" | "discount" | "other"; amount_mode: "percent" | "fixed"; amount_value: number; sort_order?: number }>;
  assignments: Array<{ item_key: string; participant_key: string; share_quantity: number }>;
};

export async function createManualSplitBillDraft(): Promise<{ id?: string; error?: string }> {
  return saveSplitBill({
    title: "",
    bill_date: new Date().toISOString().slice(0, 10),
    currency: DEFAULT_CURRENCY,
    subtotal_amount: 0,
    grand_total_amount: 0,
    status: "draft",
    participants: [],
    items: [],
    charges: [],
    assignments: [],
    skipRevalidate: true,
  });
}

export async function saveSplitBill(input: SaveSplitBillInput): Promise<{ id?: string; error?: string }> {
  let billId: string | undefined = input.id;
  let isNew = !billId;
  let cleanupSupabase: any = null;
  let cleanupUser: { id: string } | null = null;
  let oldSnapshot: { participants: any[]; items: any[]; charges: any[]; assignments: any[]; my_participant_id: string | null } | null = null;
  let validContactIds: Set<string> | null = null;
  let recordedTxId: string | null = null;

  try {
    const { supabase, user } = await getAuthed();
    const sb = supabase as any;
    cleanupSupabase = sb;
    cleanupUser = user;

    billId = input.id;
    isNew = !billId;
    const currency = normalizeCurrency(input.currency);
    const billDate = /^\d{4}-\d{2}-\d{2}$/.test(String(input.bill_date || "")) ? input.bill_date : new Date().toISOString().slice(0, 10);
    const billPayload = {
      user_id: user.id,
      title: (input.title || "").slice(0, 200),
      bill_date: billDate,
      currency,
      subtotal_amount: Math.max(Number(input.subtotal_amount) || 0, 0),
      grand_total_amount: Math.max(Number(input.grand_total_amount) || 0, 0),
      status: input.status === "balanced" ? "balanced" : "draft",
      split_mode: input.split_mode === "equal" ? "equal" : "proportional",
      notes: (input.notes || null)?.slice(0, 2000) ?? null,
      updated_at: new Date().toISOString(),
    };

    if (billId) {
      // Snapshot old children for best-effort restore if replace fails mid-way.
      const [pRes, iRes, cRes, aRes, bRes, contactRes] = await Promise.all([
        sb.from("split_bill_participants").select("*").eq("split_bill_id", billId).eq("user_id", user.id),
        sb.from("split_bill_items").select("*").eq("split_bill_id", billId).eq("user_id", user.id),
        sb.from("split_bill_charges").select("*").eq("split_bill_id", billId).eq("user_id", user.id),
        sb.from("split_bill_item_assignments").select("*").eq("split_bill_id", billId).eq("user_id", user.id),
        sb.from("split_bills").select("my_participant_id,my_recorded_transaction_id").eq("id", billId).eq("user_id", user.id).maybeSingle(),
        sb.from("split_bill_contacts").select("id").eq("user_id", user.id),
      ]);
      oldSnapshot = {
        participants: pRes.data || [],
        items: iRes.data || [],
        charges: cRes.data || [],
        assignments: aRes.data || [],
        my_participant_id: bRes.data?.my_participant_id || null,
      };
      // Transaksi "porsi saya" yang sudah tercatat (dipakai buat auto-sync).
      recordedTxId = bRes.data?.my_recorded_transaction_id || null;
      // Kontak yang Valid — peserta yang nunjuk kontak yang sudah dihapus akan dibikin null
      // (kalau nggak, insert peserta gagal karena foreign key).
      validContactIds = new Set(((contactRes.data || []) as any[]).map((c) => c.id as string));

      // Update header + hapus children bisa bareng (beda tabel) -> hemat 1 round-trip.
      const [updateRes] = await Promise.all([
        sb.from("split_bills").update(billPayload).eq("id", billId).eq("user_id", user.id),
        sb.from("split_bill_item_assignments").delete().eq("split_bill_id", billId).eq("user_id", user.id),
        sb.from("split_bill_items").delete().eq("split_bill_id", billId).eq("user_id", user.id),
        sb.from("split_bill_charges").delete().eq("split_bill_id", billId).eq("user_id", user.id),
        sb.from("split_bill_participants").delete().eq("split_bill_id", billId).eq("user_id", user.id),
        sb.from("split_bills").update({ my_participant_id: null }).eq("id", billId).eq("user_id", user.id),
      ]);
      if (updateRes.error) throw new Error(updateRes.error.message);
    } else {
      const { data, error } = await sb.from("split_bills").insert(billPayload).select("id").single();
      if (error || !data) throw new Error(error?.message || "Gagal membuat split bill");
      billId = data.id as string;
      const { data: contactRows } = await sb.from("split_bill_contacts").select("id").eq("user_id", user.id);
      validContactIds = new Set(((contactRows || []) as any[]).map((c) => c.id as string));
    }

    // participants — insert paralel (mapping client key -> uuid tetap eksak)
    const participantIdMap = new Map<string, string>();
    let myParticipantRealId: string | null = null;
    const seenMe = new Set<string>();
    const participantRows: any[] = [];
    const participantKeys: string[] = [];
    for (let i = 0; i < (input.participants || []).length; i++) {
      const p = input.participants[i];
      const key = p.id || `p_${i}`;
      // Only allow a single "me" participant; later duplicates are treated as normal.
      const isMe = !!p.is_me && !seenMe.has("me");
      if (isMe) seenMe.add("me");
      participantRows.push({
        split_bill_id: billId,
        user_id: user.id,
        name: (p.name || (isMe ? "Saya" : "Peserta")).slice(0, 100),
        is_me: isMe,
        // Kalau kontak-nya udah dihapus, lepaskan (biar nggak nabrak foreign key).
        contact_id: p.contact_id && (!validContactIds || validContactIds.has(p.contact_id)) ? p.contact_id : null,
        avatar_style: p.avatar_style || null,
        avatar_seed: p.avatar_seed || null,
        sort_order: p.sort_order ?? i,
      });
      participantKeys.push(key);
    }
    // charges — rows disiapkan dulu biar bisa di-insert bareng sama peserta (hemat 1 round-trip)
    const chargeRows: any[] = [];
    for (let i = 0; i < (input.charges || []).length; i++) {
      const c = input.charges[i];
      const rawValue = Number(c.amount_value) || 0;
      const value = c.amount_mode === "percent" ? Math.min(Math.max(rawValue, 0), 100) : Math.max(rawValue, 0);
      chargeRows.push({
        split_bill_id: billId,
        user_id: user.id,
        name: (c.name || c.kind).slice(0, 100),
        kind: c.kind,
        amount_mode: c.amount_mode,
        amount_value: value,
        sort_order: c.sort_order ?? i,
      });
    }

    // peserta + biaya bisa bareng (nggak saling bergantung) -> hemat 1 round-trip
    const [inserted, chargeRes] = await Promise.all([
      participantRows.length
        ? Promise.all(
            participantRows.map((row) =>
              sb.from("split_bill_participants").insert(row).select("id").single(),
            ),
          )
        : Promise.resolve([]),
      chargeRows.length
        ? sb.from("split_bill_charges").insert(chargeRows)
        : Promise.resolve({ error: null, data: null }),
    ]);
    if (chargeRes?.error) throw new Error(chargeRes.error.message || "Gagal simpan biaya");
    for (let i = 0; i < inserted.length; i++) {
      const res = inserted[i];
      if (res.error || !res.data) throw new Error(res.error?.message || "Gagal simpan peserta");
      participantIdMap.set(participantKeys[i], res.data.id as string);
      if (participantRows[i].is_me) myParticipantRealId = res.data.id as string;
    }

    // items — insert paralel
    const itemIdMap = new Map<string, string>();
    const itemQtyMap = new Map<string, number>();
    const itemRows: any[] = [];
    const itemKeys: string[] = [];
    for (let i = 0; i < (input.items || []).length; i++) {
      const it = input.items[i];
      const qty = Math.max(Number(it.quantity) || 0, 0);
      const unitPrice = Math.max(Number(it.unit_price) || 0, 0);
      const lineSubtotal = Math.max(Number(it.line_subtotal) || unitPrice * qty, 0);
      const itemDiscountMode: "percent" | "fixed" = it.item_discount_mode === "percent" ? "percent" : "fixed";
      const rawDiscount = Number(it.item_discount) || 0;
      const itemDiscount = itemDiscountMode === "percent"
        ? Math.min(Math.max(rawDiscount, 0), 100)
        : Math.min(Math.max(rawDiscount, 0), lineSubtotal);
      itemRows.push({
        split_bill_id: billId,
        user_id: user.id,
        name: (it.name || `Item ${i + 1}`).slice(0, 200),
        quantity: qty,
        unit_price: unitPrice,
        line_subtotal: lineSubtotal,
        item_discount: itemDiscount,
        item_discount_mode: itemDiscountMode,
        sort_order: it.sort_order ?? i,
        notes: (it.notes || null)?.slice(0, 500) ?? null,
      });
      itemKeys.push(it.id || `i_${i}`);
    }
    // items + update my_participant_id bisa bareng -> hemat 1 round-trip
    const [itemInserts] = await Promise.all([
      itemRows.length
        ? Promise.all(itemRows.map((row) => sb.from("split_bill_items").insert(row).select("id").single()))
        : Promise.resolve([]),
      (async () => {
        if (myParticipantRealId) {
          await sb.from("split_bills").update({ my_participant_id: myParticipantRealId }).eq("id", billId).eq("user_id", user.id);
        }
        // Catatan: peserta "Saya" itu OPSIONAL. Kalau tidak ada yang ditandai "Saya",
        // my_participant_id dibiarkan null (nggak ada auto-paksa peserta pertama jadi "Saya").
      })(),
    ]);
    for (let i = 0; i < itemInserts.length; i++) {
      const res = itemInserts[i];
      if (res.error || !res.data) throw new Error(res.error?.message || "Gagal simpan item");
      itemIdMap.set(itemKeys[i], res.data.id as string);
      itemQtyMap.set(res.data.id as string, itemRows[i].quantity);
    }

    // assignments (dedupe by item+participant; cap share per item and total per item)
    const assignmentByKey = new Map<string, { itemId: string; participantId: string; share: number }>();
    const usedByItem = new Map<string, number>();
    for (const a of input.assignments || []) {
      const itemId = itemIdMap.get(a.item_key) || a.item_key;
      const participantId = participantIdMap.get(a.participant_key) || a.participant_key;
      if (!itemId || !participantId) continue;
      const itemQty = itemQtyMap.get(itemId) ?? Number.MAX_SAFE_INTEGER;
      const dedupeKey = `${itemId}__${participantId}`;
      const requested = Math.min(Math.max(Number(a.share_quantity) || 0, 0), itemQty);
      if (requested <= 0) continue;
      const prev = assignmentByKey.get(dedupeKey)?.share || 0;
      const usedOther = (usedByItem.get(itemId) || 0) - prev;
      const remaining = Math.max(0, itemQty - usedOther);
      const share = Math.min(requested, remaining);
      if (share <= 0) {
        assignmentByKey.delete(dedupeKey);
        usedByItem.set(itemId, usedOther);
        continue;
      }
      assignmentByKey.set(dedupeKey, { itemId, participantId, share });
      usedByItem.set(itemId, usedOther + share);
    }

    const assignmentRows = Array.from(assignmentByKey.values()).map((a) => ({
      split_bill_id: billId,
      item_id: a.itemId,
      participant_id: a.participantId,
      user_id: user.id,
      share_quantity: a.share,
    }));
    if (assignmentRows.length) {
      const { error } = await sb.from("split_bill_item_assignments").insert(assignmentRows);
      if (error) throw new Error(error.message || "Gagal simpan pembagian");
    }

    // --- Auto-sync transaksi "porsi saya" -------------------------------
    // Kalau patungan ini sudah punya transaksi tercatat, dan porsi "Saya"
    // berubah, transaksinya ikut di-update (transaksi YANG SAMA, bukan baru).
    if (recordedTxId) {
      try {
        const meId = participantRows.find((r: any) => r.is_me)
          ? participantIdMap.get(participantKeys[participantRows.findIndex((r: any) => r.is_me)]) || null
          : null;
        const calc = calculateSplitBill({
          currency: billPayload.currency,
          grandTotal: billPayload.grand_total_amount,
          items: itemRows.map((r: any, i: number) => ({
            ...r,
            id: itemIdMap.get(itemKeys[i]) || itemKeys[i],
          })) as any,
          participants: participantRows.map((r: any, i: number) => ({
            ...r,
            id: participantIdMap.get(participantKeys[i]) || participantKeys[i],
          })) as any,
          assignments: assignmentRows as any,
          charges: chargeRows as any,
          splitMode: billPayload.split_mode === "equal" ? "equal" : "proportional",
        });
        const myTotal = Number(
          calc.per_person.find((p: any) => p.participant_id === meId)?.total || 0,
        );
        const description = buildMyPortionDescriptionFromRows({
          title: billPayload.title,
          items: itemRows.map((r: any, i: number) => ({
            id: itemIdMap.get(itemKeys[i]) || itemKeys[i],
            name: r.name,
          })),
          assignments: assignmentRows as any,
          myId: meId,
        });
        // Rincian item porsi (untuk kolom JSONB transactions.items)
        const myItems: TransactionItem[] = (assignmentRows as any[])
          .filter((a) => a.participant_id === meId)
          .map((a) => {
            const idx = itemRows.findIndex(
              (_r: any, i: number) =>
                (itemIdMap.get(itemKeys[i]) || itemKeys[i]) === a.item_id,
            );
            const it = idx >= 0 ? itemRows[idx] : null;
            if (!it) return null;
            const qty = Number(it.quantity) || 0;
            const share = Number(a.share_quantity) || 0;
            const grossLine = qty > 0 ? (Number(it.line_subtotal) * share) / qty : 0;
            const itemDiscountNominal = it.item_discount_mode === "percent"
              ? (Number(it.line_subtotal) * Math.min(Math.max(Number(it.item_discount) || 0, 0), 100)) / 100
              : Math.min(Math.max(Number(it.item_discount) || 0, 0), Number(it.line_subtotal) || 0);
            const discShare = qty > 0 ? (itemDiscountNominal * share) / qty : 0;
            const netAmount = Math.max(0, grossLine - discShare);
            const effectivePrice = share > 0 ? netAmount / share : 0;
            return {
              name: String(it.name || "Item"),
              quantity: String(share),
              price: String(effectivePrice),
              subtotal: String(Math.round(netAmount)),
            };
          })
          .filter(Boolean) as TransactionItem[];

        if (myTotal > 0) {
          const { data: tx } = await sb
            .from("transactions")
            .select("*, account:accounts(id,currency,current_balance)")
            .eq("id", recordedTxId)
            .eq("user_id", user.id)
            .maybeSingle();
          if (tx) {
            const existingDesc = String(tx.description || "");
            // Jangan timpa memo/catatan yang sudah ada (mis. diskon atau hasil edit user).
            const memoMatch = existingDesc.match(/\[Memo:\s*([\s\S]*?)\]/);
            const preservedMemo = memoMatch ? ` [Memo: ${memoMatch[1].trim()}]` : "";
            const nextDesc = `${description}${preservedMemo}`.slice(0, 2000);
            const sameAmount = Number(tx.amount) === myTotal;
            const sameDesc = existingDesc === nextDesc;
            if (!sameAmount || !sameDesc) {
              const delta = myTotal - Number(tx.amount || 0);
              const balance = Number((tx as any).account?.current_balance) || 0;
              const blocked = delta > 0 && balance - delta < 0;
              if (!blocked) {
                await sb
                  .from("transactions")
                  .update({
                    amount: myTotal,
                    description: nextDesc,
                    items: myItems.length > 0 ? myItems : null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", recordedTxId)
                  .eq("user_id", user.id);
              } else {
                console.warn("[split-bill] auto-sync dilewati: saldo akun tidak cukup");
              }
            }
          }
        }
      } catch (syncErr) {
        // Auto-sync gagal = bukan error fatal buat penyimpanan patungan.
        console.error("[split-bill] auto-sync transaksi gagal", syncErr);
      }
    }

    if (!input.skipRevalidate) {
      revalidatePath("/split-bill");
      revalidatePath(`/split-bill/${billId}`);
    }
    return { id: billId };
  } catch (e: any) {
    console.error(e);
    // If we created a brand-new bill but a child insert failed, remove the orphan header.
    if (isNew && billId && cleanupSupabase && cleanupUser) {
      try {
        await cleanupSupabase.from("split_bills").delete().eq("id", billId).eq("user_id", cleanupUser.id);
      } catch {
        // best effort
      }
    }
    // Best-effort restore for existing bills to avoid leaving them empty/partial.
    if (!isNew && billId && cleanupSupabase && cleanupUser && oldSnapshot) {
      try {
        await cleanupSupabase.from("split_bill_item_assignments").delete().eq("split_bill_id", billId).eq("user_id", cleanupUser.id);
        await cleanupSupabase.from("split_bill_items").delete().eq("split_bill_id", billId).eq("user_id", cleanupUser.id);
        await cleanupSupabase.from("split_bill_charges").delete().eq("split_bill_id", billId).eq("user_id", cleanupUser.id);
        await cleanupSupabase.from("split_bill_participants").delete().eq("split_bill_id", billId).eq("user_id", cleanupUser.id);
        if (oldSnapshot.participants.length) await cleanupSupabase.from("split_bill_participants").insert(oldSnapshot.participants);
        if (oldSnapshot.items.length) await cleanupSupabase.from("split_bill_items").insert(oldSnapshot.items);
        if (oldSnapshot.charges.length) await cleanupSupabase.from("split_bill_charges").insert(oldSnapshot.charges);
        if (oldSnapshot.assignments.length) await cleanupSupabase.from("split_bill_item_assignments").insert(oldSnapshot.assignments);
        await cleanupSupabase.from("split_bills").update({ my_participant_id: oldSnapshot.my_participant_id }).eq("id", billId).eq("user_id", cleanupUser.id);
      } catch (restoreErr) {
        console.error("Failed to restore split bill snapshot", restoreErr);
      }
    }
    return { error: friendlySaveError(e) };
  }
}

export async function deleteSplitBill(id: string): Promise<{ error?: string }> {
  try {
    const { supabase, user } = await getAuthed();
    const sb = supabase as any;
    const { data: images } = await sb
      .from("split_bill_images")
      .select("storage_path")
      .eq("split_bill_id", id)
      .eq("user_id", user.id);
    const paths = (images || []).map((i: any) => i.storage_path).filter(Boolean);
    if (paths.length) {
      try {
        await supabase.storage.from("split-bill-images").remove(paths);
      } catch (storageErr) {
        console.warn("Failed to remove split bill images from storage", storageErr);
      }
    }
    const { error } = await sb.from("split_bills").delete().eq("id", id).eq("user_id", user.id);
    if (error) return { error: friendlySaveError(error, "Gagal menghapus patungan. Coba lagi ya.") };
    revalidatePath("/split-bill");
    return {};
  } catch (e: any) {
    return { error: friendlySaveError(e, "Gagal menghapus patungan. Coba lagi ya.") };
  }
}

export async function deleteSplitBills(ids: string[]): Promise<{ error?: string; deleted?: number }> {
  try {
    const unique = Array.from(new Set((ids || []).filter(Boolean)));
    if (unique.length === 0) return { deleted: 0 };
    const { supabase, user } = await getAuthed();
    const sb = supabase as any;

    const { data: images } = await sb
      .from("split_bill_images")
      .select("storage_path")
      .in("split_bill_id", unique)
      .eq("user_id", user.id);
    const paths = (images || []).map((i: any) => i.storage_path).filter(Boolean);
    if (paths.length) {
      try {
        await supabase.storage.from("split-bill-images").remove(paths);
      } catch (storageErr) {
        console.warn("Failed to remove split bill images from storage", storageErr);
      }
    }

    const { error } = await sb
      .from("split_bills")
      .delete()
      .in("id", unique)
      .eq("user_id", user.id);
    if (error) return { error: friendlySaveError(error, "Gagal menghapus patungan. Coba lagi ya.") };
    revalidatePath("/split-bill");
    return { deleted: unique.length };
  } catch (e: any) {
    return { error: friendlySaveError(e, "Gagal menghapus patungan. Coba lagi ya.") };
  }
}

// Contacts
export async function getSplitBillContacts(): Promise<SplitBillContact[]> {
  const { supabase, user } = await getAuthed();
  const { data } = await (supabase as any)
    .from("split_bill_contacts")
    .select("*")
    .eq("user_id", user.id)
    .order("name");
  return (data || []) as SplitBillContact[];
}

export async function upsertSplitBillContact(
  name: string,
  id?: string,
  avatar?: { style?: string | null; seed?: string | null },
): Promise<{ id?: string; error?: string }> {
  try {
    const { supabase, user } = await getAuthed();
    const sb = supabase as any;
    const trimmed = (name || "").trim().slice(0, 100);
    if (!trimmed) return { error: "Nama kontak kosong" };
    const avatarPatch = {
      avatar_style: avatar?.style ?? null,
      avatar_seed: avatar?.seed ?? null,
    };
    if (id) {
      const { error } = await sb
        .from("split_bill_contacts")
        .update({ name: trimmed, ...avatarPatch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) return { error: friendlySaveError(error, "Gagal menyimpan kontak. Coba lagi ya.") };
      return { id };
    }
    // Insert or return the existing contact (case-insensitive name uniqueness).
    const { data: existing } = await sb
      .from("split_bill_contacts")
      .select("id")
      .eq("user_id", user.id)
      .ilike("name", trimmed)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await sb
        .from("split_bill_contacts")
        .update({ ...avatarPatch, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .eq("user_id", user.id);
      if (error) return { error: friendlySaveError(error, "Gagal menyimpan kontak. Coba lagi ya.") };
      return { id: existing.id };
    }

    const { data, error } = await sb
      .from("split_bill_contacts")
      .insert({ user_id: user.id, name: trimmed, ...avatarPatch })
      .select("id")
      .single();
    if (error) return { error: friendlySaveError(error, "Gagal menyimpan kontak. Coba lagi ya.") };
    return { id: data.id };
  } catch (e: any) {
    return { error: friendlySaveError(e, "Gagal menyimpan kontak. Coba lagi ya.") };
  }
}

export async function deleteSplitBillContact(id: string) {
  const { supabase, user } = await getAuthed();
  await (supabase as any).from("split_bill_contacts").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/split-bill");
}

// Images
export async function uploadSplitBillImage(formData: FormData): Promise<{ image?: SplitBillImage; error?: string }> {
  try {
    const { supabase, user } = await getAuthed();
    const sb = supabase as any;
    const billId = String(formData.get("splitBillId") || "");
    const file = formData.get("file");
    if (!billId || !(file instanceof Blob)) return { error: "Data tidak valid" };

    const { count } = await sb
      .from("split_bill_images")
      .select("id", { count: "exact", head: true })
      .eq("split_bill_id", billId)
      .eq("user_id", user.id);
    if ((count || 0) >= 3) return { error: "Maksimal 3 gambar per patungan" };

    const path = `${user.id}/${billId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("split-bill-images")
      .upload(path, file, { contentType: "image/jpeg", upsert: false });
    if (upErr) return { error: friendlySaveError(upErr, "Gagal menyimpan foto struk. Coba lagi ya.") };

    // Re-check count inside the action to reduce race overshoot.
    const { count: countAfter } = await sb
      .from("split_bill_images")
      .select("id", { count: "exact", head: true })
      .eq("split_bill_id", billId)
      .eq("user_id", user.id);
    if ((countAfter || 0) >= 3) {
      await supabase.storage.from("split-bill-images").remove([path]);
      return { error: "Maksimal 3 gambar per patungan" };
    }

    const { data, error } = await sb
      .from("split_bill_images")
      .insert({
        split_bill_id: billId,
        user_id: user.id,
        storage_path: path,
        file_name: (file as File).name || "receipt.jpg",
        mime_type: "image/jpeg",
        size_bytes: file.size,
        sort_order: countAfter || 0,
      })
      .select("*")
      .single();
    if (error || !data) {
      await supabase.storage.from("split-bill-images").remove([path]).catch(() => undefined);
      return { error: friendlySaveError(error, "Gagal menyimpan foto struk. Coba lagi ya.") };
    }

    const { data: signed } = await supabase.storage.from("split-bill-images").createSignedUrl(path, 60 * 60 * 24);
    revalidatePath(`/split-bill/${billId}`);
    return { image: { ...(data as SplitBillImage), signed_url: signed?.signedUrl } };
  } catch (e: any) {
    return { error: friendlySaveError(e, "Gagal menyimpan foto struk. Coba lagi ya.") };
  }
}

export async function deleteSplitBillImage(imageId: string, splitBillId: string) {
  const { supabase, user } = await getAuthed();
  const sb = supabase as any;
  const { data } = await sb
    .from("split_bill_images")
    .select("storage_path")
    .eq("id", imageId)
    .eq("user_id", user.id)
    .maybeSingle();
  // Delete the DB row first; if storage removal fails, the row is already gone and
  // a future manual cleanup can handle the orphan file.
  await sb.from("split_bill_images").delete().eq("id", imageId).eq("user_id", user.id);
  if (data?.storage_path) {
    try {
      await supabase.storage.from("split-bill-images").remove([data.storage_path]);
    } catch (storageErr) {
      console.warn("Failed to remove split bill image from storage", storageErr);
    }
  }
  revalidatePath(`/split-bill/${splitBillId}`);
}

export async function getSplitBillImageSignedUrl(imageId: string): Promise<{ url?: string; error?: string }> {
  try {
    const { supabase, user } = await getAuthed();
    const sb = supabase as any;
    const { data } = await sb
      .from("split_bill_images")
      .select("storage_path")
      .eq("id", imageId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data?.storage_path) return { error: "Foto struk tidak ditemukan." };
    const { data: signed } = await supabase.storage.from("split-bill-images").createSignedUrl(data.storage_path, 60 * 60 * 24);
    return { url: signed?.signedUrl };
  } catch (e: any) {
    return { error: friendlySaveError(e, "Gagal membuka foto struk. Coba lagi ya.") };
  }
}

// Record my portion as expense transaction (snapshot, weak ref)
export async function recordMyPortion(input: {
  splitBillId: string;
  accountId: string;
  categoryId: string;
  amount: number;
  currency: string;
  date: string; // yyyy-mm-dd
  description: string;
  /** Rincian item porsi (disimpan di kolom JSONB `transactions.items`) */
  items?: TransactionItem[];
}): Promise<{ transactionId?: string; error?: string }> {
  try {
    const { supabase, user } = await getAuthed();
    const sb = supabase as any;
    const description = (input.description || "Split Bill - porsi saya").slice(0, 2000);
    const { data: bill } = await sb
      .from("split_bills")
      .select("id, my_recorded_transaction_id, my_participant_id")
      .eq("id", input.splitBillId)
      .eq("user_id", user.id)
      .single();
    if (!bill) return { error: "Split bill tidak ditemukan" };
    const amount = Number(input.amount) || 0;
    if (amount <= 0) return { error: "Nominal porsi harus lebih dari 0" };

    // Validate currency matches the chosen account (createTransaction also enforces this).
    const { data: acc } = await sb
      .from("accounts")
      .select("id, currency")
      .eq("id", input.accountId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!acc) return { error: "Akun tidak ditemukan" };
    if (String(acc.currency || "IDR").toUpperCase() !== (input.currency || "IDR").toUpperCase()) {
      return { error: "Currency transaksi harus sama dengan currency akun." };
    }

    // Validate category belongs to user (expense recording).
    const { data: cat } = await sb
      .from("categories")
      .select("id, type")
      .eq("id", input.categoryId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!cat) return { error: "Kategori tidak ditemukan" };

    if (bill.my_recorded_transaction_id) {
      const { data: tx } = await sb
        .from("transactions")
        .select("id")
        .eq("id", bill.my_recorded_transaction_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (tx) return { error: "Porsi sudah dicatat" };
      // if tx gone, allow re-record and clear stale marker
      await sb
        .from("split_bills")
        .update({ my_recorded_transaction_id: null, my_recorded_at: null })
        .eq("id", input.splitBillId)
        .eq("user_id", user.id);
    }

    const res = await createTransaction({
      accountId: input.accountId,
      categoryId: input.categoryId,
      type: "expense",
      amount,
      currency: input.currency as any,
      description,
      // Rincian item disimpan juga di kolom JSONB `transactions.items`
      items: input.items && input.items.length > 0 ? input.items : undefined,
      transactionDate: new Date(input.date + "T12:00:00").toISOString(),
    });
    const createdTx: any = (res as any).data;
    if (res.error || !createdTx?.id) {
      return { error: friendlySaveError(res.error, "Gagal mencatat transaksi. Coba lagi ya.") };
    }

    const { error: markerError } = await sb
      .from("split_bills")
      .update({
        my_recorded_transaction_id: createdTx.id,
        my_recorded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.splitBillId)
      .eq("user_id", user.id);
    if (markerError) {
      // Avoid leaving an unlinked recorded transaction if we failed to mark the split bill.
      try {
        await sb.from("transactions").delete().eq("id", createdTx.id).eq("user_id", user.id);
      } catch {
        // best effort
      }
      return { error: friendlySaveError(markerError, "Gagal menandai porsi tercatat. Coba lagi ya.") };
    }

    revalidatePath("/split-bill");
    revalidatePath(`/split-bill/${input.splitBillId}`);
    revalidatePath("/transactions");
    return { transactionId: createdTx.id };
  } catch (e: any) {
    return { error: friendlySaveError(e, "Gagal mencatat porsi. Coba lagi ya.") };
  }
}

export async function syncMyPortionTransaction(input: {
  splitBillId: string;
  amount: number;
  currency: string;
  description: string;
  /** Rincian item porsi (disimpan di kolom JSONB `transactions.items`) */
  items?: TransactionItem[];
}): Promise<{ error?: string }> {
  try {
    const { supabase, user } = await getAuthed();
    const sb = supabase as any;
    const { data: bill } = await sb
      .from("split_bills")
      .select("my_recorded_transaction_id")
      .eq("id", input.splitBillId)
      .eq("user_id", user.id)
      .single();
    if (!bill?.my_recorded_transaction_id) return { error: "Belum ada transaksi tercatat" };

    const amount = Number(input.amount) || 0;
    if (amount <= 0) return { error: "Nominal porsi harus lebih dari 0" };

    const { data: tx } = await sb
      .from("transactions")
      .select("*, account:accounts(id, currency, current_balance)")
      .eq("id", bill.my_recorded_transaction_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!tx) {
      await sb
        .from("split_bills")
        .update({ my_recorded_transaction_id: null, my_recorded_at: null })
        .eq("id", input.splitBillId)
        .eq("user_id", user.id);
      return { error: "Transaksi tercatat tidak ditemukan" };
    }

    const accountCurrency = String(tx.account?.currency || "IDR").toUpperCase();
    const nextCurrency = (input.currency || accountCurrency).toUpperCase();
    if (nextCurrency !== accountCurrency) {
      return { error: "Currency transaksi harus sama dengan currency akun." };
    }

    // Guard account balance when the expense amount changes (mirrors transaction update guard).
    const currentAmount = Number((tx as any).amount) || 0;
    const currentBalance = Number(tx.account?.current_balance) || 0;
    const delta = amount - currentAmount; // positive => more expense
    if (delta > 0 && currentBalance - delta < 0) {
      return { error: `Saldo akun tidak mencukupi untuk memperbarui porsi (butuh ${delta}).` };
    }

    const description = (input.description || "Split Bill - porsi saya").slice(0, 2000);
    const { error } = await sb
      .from("transactions")
      .update({
        amount,
        currency: nextCurrency,
        description,
        // Rincian item (JSONB) — null kalau nggak ada item.
        items: input.items && input.items.length > 0 ? input.items : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bill.my_recorded_transaction_id)
      .eq("user_id", user.id);
    if (error) return { error: friendlySaveError(error, "Gagal memperbarui porsi tercatat. Coba lagi ya.") };
    revalidatePath("/transactions");
    revalidatePath(`/split-bill/${input.splitBillId}`);
    return {};
  } catch (e: any) {
    return { error: friendlySaveError(e, "Gagal memperbarui porsi tercatat. Coba lagi ya.") };
  }
}
