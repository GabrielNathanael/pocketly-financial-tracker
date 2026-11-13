"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";
import { useLanguage } from "@/lib/i18n/language-context";
import { CURRENCY_CODES, DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/constants/currencies";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { CameraLiveView } from "@/components/ui/camera-live-view";
import { ReceiptScanOverlay } from "@/components/ui/receipt-scan-overlay";
import { DiceAvatar } from "@/components/ui/dice-avatar";
import { AvatarPicker } from "@/components/split-bill/avatar-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { defaultAvatarFor, type AvatarRef } from "@/lib/utils/avatar";
import { DatePicker } from "@/components/ui/date-picker";
import { formatItemsSummary, type TransactionItem } from "@/lib/utils/transaction-items";
import { getItemNetSubtotal } from "@/lib/utils/split-bill";
import {
  Plus,
  Trash2,
  ArrowLeft,
  Camera,
  ImagePlus,
  ScanLine,
  Share2,
  Copy,
  Check,
  UserPlus,
  X,
  Receipt,
  BookmarkPlus,
  PenLine,
  ChevronRight,
  ArrowUp,
  Loader2,
} from "lucide-react";
import type { Account, Category } from "@/types/database";
import type { SplitBillFull, SplitBillContact, SplitBillImage } from "@/types/split-bill";
import { calculateSplitBill, formatSplitSummaryText } from "@/lib/utils/split-bill";
import {
  saveSplitBill,
  deleteSplitBill,
  uploadSplitBillImage,
  deleteSplitBillImage,
  getSplitBillImageSignedUrl,
  upsertSplitBillContact,
  deleteSplitBillContact,
  recordMyPortion,
  syncMyPortionTransaction,
} from "@/actions/split-bills";
import { scanSplitBillReceipt } from "@/lib/ocr/split-bill-scan-client";
import { friendlyScanError } from "@/lib/ocr/scan-error";
import { getLocalDateString } from "@/lib/utils/date";

type LocalParticipant = {
  key: string;
  name: string;
  is_me: boolean;
  contact_id?: string | null;
  avatar_style?: string | null;
  avatar_seed?: string | null;
};
type LocalItem = { key: string; name: string; quantity: number; unit_price: number; line_subtotal: number; item_discount: number; item_discount_mode?: "percent" | "fixed" };
type LocalCharge = { key: string; name: string; kind: "tax" | "service" | "discount" | "other"; amount_mode: "percent" | "fixed"; amount_value: number };
type LocalAssignment = { item_key: string; participant_key: string; share_quantity: number };

const SUPPORTED = new Set<string>(CURRENCY_CODES);

/** Delay autosave setelah perubahan terakhir (ms). */
const AUTOSAVE_DEBOUNCE_MS = 2000;
/** Jeda minimum antar autosave (ms) — biar tidak spam server. */
const AUTOSAVE_MIN_GAP_MS = 5000;
function normalizeCurrency(v?: string | null): CurrencyCode {
  const up = (v || "").toUpperCase();
  if (SUPPORTED.has(up)) return up as CurrencyCode;
  return DEFAULT_CURRENCY;
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function toNum(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function formatQty(v: number): string {
  const n = Number(v) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, "");
}

export function SplitBillDetailClient({
  bill,
  initialContacts,
  accounts,
  categories,
  initialUi,
  initialMode,
}: {
  bill: SplitBillFull | null;
  initialContacts: SplitBillContact[];
  accounts: Account[];
  categories: Category[];
  /** Posisi langkah terakhir (dari cookie) supaya refresh kembali ke langkah yang sama. */
  initialUi?: { step: 1 | 2 | 3 | 4; editing: boolean; isEditing?: boolean } | null;
  /** Mulai langsung ke flow tertentu (dari halaman awal: scan / manual). */
  initialMode?: "scan" | "manual";
}) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const previewScrollSyncRef = useRef(false);

  const defaultCurrency: CurrencyCode = bill
    ? normalizeCurrency(bill.currency)
    : normalizeCurrency(accounts.find((a) => SUPPORTED.has((a.currency || "").toUpperCase()))?.currency || DEFAULT_CURRENCY);

  const [contacts, setContacts] = useState<SplitBillContact[]>(initialContacts);
  const [title, setTitle] = useState(bill?.title || "");
  const [billDate, setBillDate] = useState(bill?.bill_date || getLocalDateString());
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);
  const [notes] = useState(bill?.notes || "");
  const [status, setStatus] = useState<"draft" | "balanced">(bill?.status || "draft");
  const [grandTotal, setGrandTotal] = useState<number>(Number(bill?.grand_total_amount) || 0);
  const [isGrandTotalManual, setIsGrandTotalManual] = useState<boolean>(() => {
    if (!bill) return false;
    const saved = Number(bill.grand_total_amount) || 0;
    const itemsNet = (bill.items || []).reduce((sum, it) => sum + getItemNetSubtotal(it), 0);
    const chargesNet = (bill.charges || []).reduce((sum, ch) => {
      const raw = Number(ch.amount_value) || 0;
      const val = ch.amount_mode === "percent" ? (itemsNet * raw) / 100 : raw;
      return sum + (ch.kind === "discount" ? -Math.abs(val) : Math.abs(val));
    }, 0);
    const computed = Math.round((itemsNet + chargesNet) * 100) / 100;
    return saved > 0 && Math.abs(saved - computed) >= 0.01;
  });

  const [participants, setParticipants] = useState<LocalParticipant[]>(
    bill?.participants?.length
      ? bill.participants.map((p) => ({ key: p.id, name: p.name, is_me: p.is_me, contact_id: p.contact_id, avatar_style: p.avatar_style, avatar_seed: p.avatar_seed }))
      : []
  );
  const [items, setItems] = useState<LocalItem[]>(
    bill?.items?.length
      ? bill.items.map((i) => ({
          key: i.id,
          name: i.name,
          quantity: toNum(i.quantity, 1),
          unit_price: toNum(i.unit_price, 0),
          line_subtotal: toNum(i.line_subtotal, 0),
          item_discount: toNum(i.item_discount, 0),
          item_discount_mode: i.item_discount_mode === "percent" ? "percent" : "fixed",
        }))
      : []
  );
  const [charges, setCharges] = useState<LocalCharge[]>(
    bill?.charges?.length
      ? bill.charges.map((c) => ({
          key: c.id,
          name: c.name,
          kind: c.kind,
          amount_mode: c.amount_mode,
          amount_value: toNum(c.amount_value, 0),
        }))
      : []
  );
  const [assignments, setAssignments] = useState<LocalAssignment[]>(() => {
    if (!bill) return [];
    return bill.assignments
      .map((a) => ({
        item_key: a.item_id,
        participant_key: a.participant_id,
        share_quantity: toNum(a.share_quantity, 0),
      }))
      .filter((a) => a.share_quantity > 0);
  });
  const [images, setImages] = useState<SplitBillImage[]>(bill?.images || []);
  const [billId, setBillId] = useState<string | null>(bill?.id || null);
  const [, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "dirty" | "saving" | "saved">("idle");
  const lastSavedSigRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveRunningRef = useRef(false);
  const lastAutosaveAtRef = useRef(0);
  const billIdRef = useRef<string | null>(bill?.id || null);
  const saveStatusResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const [isScanning, setIsScanning] = useState(false);
  const [scanSheetOpen, setScanSheetOpen] = useState(false);
  type ScanImageEntry = { id: string; file: File; previewUrl: string; status: "ready" | "scanning" | "done" | "error"; result?: Awaited<ReturnType<typeof scanSplitBillReceipt>>; error?: string };
  const [scanImages, setScanImages] = useState<ScanImageEntry[]>([]);
  const [scanSelectedId, setScanSelectedId] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusText, setScanStatusText] = useState("");
  const scanImagesRef = useRef<ScanImageEntry[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showRescanConfirm, setShowRescanConfirm] = useState(false);
  const [showEqualConfirm, setShowEqualConfirm] = useState(false);
  const [showRecord, setShowRecord] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [avatarPickerFor, setAvatarPickerFor] = useState<
    { kind: "participant"; key: string } | { kind: "contact"; id: string } | null
  >(null);
  const [recordState, setRecordState] = useState({ accountId: "", categoryId: "", description: "", date: getLocalDateString() });
  const [recordItems, setRecordItems] = useState<TransactionItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [myRecordedTxId, setMyRecordedTxId] = useState<string | null>(bill?.my_recorded_transaction_id || null);
  const [lastSyncedSig, setLastSyncedSig] = useState<string | null>(() => {
    if (!bill?.my_recorded_transaction_id) return null;
    try {
      const me = bill.participants.find((p) => p.is_me) || bill.participants[0];
      if (!me) return null;
      const initialCalc = calculateSplitBill({
        currency: bill.currency || "IDR",
        grandTotal: Number(bill.grand_total_amount) || 0,
        items: bill.items as unknown as Parameters<typeof calculateSplitBill>[0]["items"],
        participants: bill.participants as unknown as Parameters<typeof calculateSplitBill>[0]["participants"],
        assignments: bill.assignments as unknown as Parameters<typeof calculateSplitBill>[0]["assignments"],
        charges: bill.charges as unknown as Parameters<typeof calculateSplitBill>[0]["charges"],
      });
      const my = initialCalc.per_person.find((p) => p.participant_id === me.id)?.total || 0;
      const desc = buildInitialMyPortionDescription(bill, me.id, language);
      return `${bill.currency || "IDR"}:${my}:${desc}`;
    } catch {
      return null;
    }
  });
  const [newParticipantName, setNewParticipantName] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingBill, setIsDeletingBill] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<SplitBillImage | null>(null);
  const [entryMode, setEntryMode] = useState<"choose" | "scan" | "manual" | "ready">(
    bill ? "ready" : initialMode ? "ready" : "choose",
  );
  const [splitMode, setSplitMode] = useState<"proportional" | "equal">(
    (bill?.split_mode as "proportional" | "equal") || "proportional",
  );
  // Draft kosong tetap dibuka dalam mode edit (supaya user bisa langsung isi item).
  const [editingDetails, setEditingDetails] = useState(
    initialUi?.editing ?? (!bill || ((bill.items?.length ?? 0) === 0 && bill.status === "draft")),
  );
  // Default to results for completed/balanced bills; otherwise start at item check for easier editing/flow.
  const [step, setStep] = useState<1 | 2 | 3 | 4>(
    initialUi?.step ?? (bill?.status === "balanced" ? 4 : 1),
  );
  const [activeAssigneeKey, setActiveAssigneeKey] = useState<string | null>(null);
  // Balanced/completed bills open in view mode unless the user was editing before refresh.
  const [isEditing, setIsEditing] = useState(
    initialUi?.isEditing ?? (!bill || bill.status === "draft"),
  );
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const [actionsVisible, setActionsVisible] = useState(true);
  const pushedEditHistoryRef = useRef(false);
  const editModeRequestedRef = useRef(false);
  const stepTouchStart = useRef<{ x: number; y: number } | null>(null);

  const clearScanSheet = useCallback(() => {
    setCameraActive(false);
    setCameraError(null);
    scanImagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    scanImagesRef.current = [];
    setScanImages([]);
    setScanSelectedId(null);
    setScanSheetOpen(false);
    setIsScanning(false);
    setScanProgress(0);
    setScanStatusText("");
  }, []);

  // Keep billId ref in sync (autosave needs the latest id without re-running effects).
  useEffect(() => {
    billIdRef.current = billId;
  }, [billId]);

  // Simpan posisi langkah (+ mode edit) di cookie per patungan, supaya saat
  // refresh user balik ke langkah yang sama, bukan ke Step 1.
  // Pakai billId (state client) — bukan prop bill — supaya patungan yang baru
  // dibuat di sesi ini langsung memakai key yang benar.
  const uiCookieKey = `split-bill-ui-${billId || "new"}`;
  useEffect(() => {
    if (typeof document === "undefined") return;
    try {
      const value = `${step}${editingDetails ? "e" : ""}${isEditing ? "x" : ""}`;
      const opts = `path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
      document.cookie = `${uiCookieKey}=${value}; ${opts}`;
      // Kalau halaman ini dirender oleh "/split-bill?mode=..." (patungan dibuat
      // di sesi ini), tulis juga key "new" supaya langkah tetap ketemu saat refresh.
      if (!bill?.id && uiCookieKey !== "split-bill-ui-new") {
        document.cookie = `split-bill-ui-new=${value}; ${opts}`;
      }
      // Kalau bill sudah punya id, "new" sudah tidak relevan -> hapus supaya
      // loading skeleton tidak salah baca step dari bill lain.
      if (billId) {
        document.cookie = `split-bill-ui-new=; path=/; max-age=0`;
      }
    } catch {
      // ignore
    }
  }, [step, editingDetails, uiCookieKey, bill?.id, isEditing, billId]);

  // Indikator "Tersimpan" kembali ke netral setelah beberapa detik.
  const scheduleSaveStatusReset = useCallback(() => {
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
    saveStatusResetRef.current = setTimeout(() => {
      saveStatusResetRef.current = null;
      setSaveStatus("idle");
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
    };
  }, []);

  useEffect(() => {
    scanImagesRef.current = scanImages;
  }, [scanImages]);

  useEffect(() => {
    return () => {
      scanImagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  useEffect(() => {
    if (cameraActive || !scanSheetOpen) return;
    if (previewScrollSyncRef.current) {
      previewScrollSyncRef.current = false;
      return;
    }
    const el = previewScrollRef.current;
    if (!el || !el.clientWidth) return;
    const idx = scanImages.findIndex((x) => x.id === scanSelectedId);
    if (idx < 0) return;
    const target = idx * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) > 2) {
      previewScrollSyncRef.current = true;
      el.scrollTo({ left: target, behavior: "auto" });
    }
  }, [scanSelectedId, scanImages, cameraActive, scanSheetOpen]);

  useEffect(() => {
    const el = actionsRef.current;
    if (!el) { setActionsVisible(true); return; }
    const observer = new IntersectionObserver(
      ([entry]) => setActionsVisible(entry.isIntersecting),
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isEditing, billId, step, editingDetails]);

  // Back / swipe: keluar dari mode edit item dulu, bukan ke list.
  // Sentinel history HANYA di-push kalau user eksplisit masuk mode edit
  // (tombol "Ubah item"). Kalau tidak, leaving Step 1 akan memanggil
  // history.back() -> pindah halaman & state ke-reset.
  useEffect(() => {
    const inEdit = step === 1 && editingDetails;
    if (!inEdit) {
      if (pushedEditHistoryRef.current) {
        pushedEditHistoryRef.current = false;
        window.history.back();
      }
      return;
    }
    if (editModeRequestedRef.current && !pushedEditHistoryRef.current) {
      window.history.pushState({ splitBillEdit: true }, "");
      pushedEditHistoryRef.current = true;
    }
    const onPopState = () => {
      if (pushedEditHistoryRef.current) {
        pushedEditHistoryRef.current = false;
        setEditingDetails(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [editingDetails, step]);

  const calcParticipants = useMemo(
    () =>
      participants.map((p, i) => ({
        id: p.key,
        split_bill_id: billId || "",
        user_id: "",
        contact_id: p.contact_id || null,
        avatar_style: p.avatar_style || null,
        avatar_seed: p.avatar_seed || null,
        name: p.name || (p.is_me ? t.splitBill.me : "Participant"),
        is_me: !!p.is_me,
        sort_order: i,
        created_at: "",
      })),
    [participants, billId, t.splitBill.me]
  );
  const calcItems = useMemo(
    () =>
      items.map((i, idx) => ({
        id: i.key,
        split_bill_id: billId || "",
        user_id: "",
        name: i.name || `${t.splitBill.item} ${idx + 1}`,
        quantity: toNum(i.quantity, 0),
        unit_price: toNum(i.unit_price, 0),
        line_subtotal: toNum(i.line_subtotal, 0),
        item_discount: toNum(i.item_discount, 0),
        item_discount_mode: (i.item_discount_mode === "percent" ? "percent" : "fixed") as "percent" | "fixed",
        sort_order: idx,
        notes: null as string | null,
        created_at: "",
      })),
    [items, billId, t.splitBill.item]
  );
  const calcCharges = useMemo(
    () =>
      charges.map((c, i) => ({
        id: c.key,
        split_bill_id: billId || "",
        user_id: "",
        name: c.name,
        kind: c.kind,
        amount_mode: c.amount_mode,
        amount_value: toNum(c.amount_value, 0),
        sort_order: i,
        created_at: "",
      })),
    [charges, billId]
  );
  const calcAssignments = useMemo(
    () =>
      assignments.map((a) => ({
        id: `${a.item_key}_${a.participant_key}`,
        item_id: a.item_key,
        participant_id: a.participant_key,
        split_bill_id: billId || "",
        user_id: "",
        share_quantity: toNum(a.share_quantity, 0),
        created_at: "",
      })),
    [assignments, billId]
  );

  const calc = useMemo(
    () =>
      calculateSplitBill({
        currency,
        grandTotal,
        items: calcItems as unknown as Parameters<typeof calculateSplitBill>[0]["items"],
        participants: calcParticipants as unknown as Parameters<typeof calculateSplitBill>[0]["participants"],
        assignments: calcAssignments as unknown as Parameters<typeof calculateSplitBill>[0]["assignments"],
        charges: calcCharges as unknown as Parameters<typeof calculateSplitBill>[0]["charges"],
        splitMode,
      }),
    [currency, grandTotal, calcItems, calcParticipants, calcAssignments, calcCharges, splitMode]
  );

  // Keep grand total in sync with computed value when not manually overridden.
  // Uses queueMicrotask to avoid synchronous setState-in-effect lint while preserving behavior.
  useEffect(() => {
    if (isGrandTotalManual) return;
    const computed = Number(calc.computed_grand_total) || 0;
    if (Math.abs((Number(grandTotal) || 0) - computed) >= 0.001) {
      queueMicrotask(() => setGrandTotal(computed));
    }
  }, [calc.computed_grand_total, grandTotal, isGrandTotalManual]);

  const itemsSubtotalNet = useMemo(
    () =>
      items.reduce(
        (s, it) =>
          s +
          getItemNetSubtotal({
            line_subtotal: toNum(it.line_subtotal),
            item_discount: toNum(it.item_discount),
            item_discount_mode: it.item_discount_mode === "percent" ? "percent" : "fixed",
          }),
        0
      ),
    [items]
  );

  /** Total biaya tingkat struk, dipisah per jenis (pajak/service/diskon/lainnya). */
  const chargeTotals = useMemo(() => {
    const buckets: Record<string, { kind: string; label: string; amount: number }> = {
      tax: { kind: "tax", label: t.splitBill.tax, amount: 0 },
      service: { kind: "service", label: t.splitBill.service, amount: 0 },
      discount: { kind: "discount", label: t.splitBill.discount, amount: 0 },
      other: { kind: "other", label: t.splitBill.other, amount: 0 },
    };
    for (const ch of charges) {
      const raw = toNum(ch.amount_value, 0);
      const amount = ch.amount_mode === "percent" ? (calc.items_subtotal * raw) / 100 : raw;
      const key =
        ch.kind === "tax" || ch.kind === "service" || ch.kind === "discount" ? ch.kind : "other";
      buckets[key].amount += ch.kind === "discount" ? -Math.abs(amount) : amount;
    }
    const order = ["tax", "service", "other", "discount"];
    return order.map((k) => buckets[k]).filter((b) => Math.abs(b.amount) > 0.004);
  }, [charges, calc.items_subtotal, t.splitBill.tax, t.splitBill.service, t.splitBill.discount, t.splitBill.other]);

  const meParticipant = participants.find((p) => p.is_me);
  const myTotal = meParticipant ? (calc.per_person.find((p) => p.participant_id === meParticipant.key)?.total || 0) : 0;
  const targetGrand = Number(grandTotal) || calc.computed_grand_total;
  const tolerance = ["IDR", "JPY", "KRW", "VND"].includes(currency.toUpperCase()) ? 0.5 : 0.01;
  const sumsToTarget = Math.abs(targetGrand - calc.per_person.reduce((s, p) => s + p.total, 0)) < tolerance;
  const computedVsTargetDiff = targetGrand - calc.computed_grand_total;
  const hasTargetMismatch = Math.abs(computedVsTargetDiff) >= tolerance;
  const canMarkBalanced =
    calc.is_balanced &&
    !hasTargetMismatch &&
    sumsToTarget &&
    items.length > 0 &&
    participants.length > 0;
  const myPortionDescription = buildMyPortionDescription(title, items, assignments, meParticipant?.key, language);
  const myPortionSignature = `${currency}:${myTotal}:${myPortionDescription}`;
  // Rincian item porsi saya (untuk kolom JSONB transactions.items)
  const meParticipantKey = meParticipant?.key ?? null;
  const myPortionItems = (() => {
    if (!meParticipantKey) return [];
    const lines =
      calc.per_person.find((p) => p.participant_id === meParticipantKey)?.item_lines ?? [];
    return lines
      .map((l) => {
        const it = items.find((i) => i.key === l.item_id);
        const shareQty = Number(l.share_quantity) || 0;
        const amount = Number(l.amount) || 0;
        const effectivePrice = shareQty > 0 ? amount / shareQty : 0;
        return {
          name: l.name || it?.name || "",
          quantity: String(l.share_quantity),
          price: String(effectivePrice),
          subtotal: String(amount),
        };
      })
      .filter((i) => i.name.trim() && (Number(i.subtotal) > 0 || Number(i.price) > 0));
  })();
  const needsSync = !!myRecordedTxId && lastSyncedSig !== null && myPortionSignature !== lastSyncedSig;

  const setAssignment = (itemKey: string, participantKey: string, share: number) => {
    setAssignments((prev) => {
      const next = prev.filter((a) => !(a.item_key === itemKey && a.participant_key === participantKey));
      if (share > 0.000001) next.push({ item_key: itemKey, participant_key: participantKey, share_quantity: share });
      return next;
    });
  };
  const getAssignment = (itemKey: string, participantKey: string) =>
    assignments.find((a) => a.item_key === itemKey && a.participant_key === participantKey)?.share_quantity || 0;

  const assignedQtyForItem = (itemKey: string) =>
    assignments.filter((a) => a.item_key === itemKey).reduce((s, a) => s + toNum(a.share_quantity), 0);

  const addParticipant = (name: string, contact_id?: string | null, avatar?: AvatarRef | null) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = uid("p");
    const ref = avatar ?? defaultAvatarFor(trimmed);
    setParticipants((prev) => {
      // New participants are never auto-marked as "me"; the user chooses explicitly.
      return [
        ...prev,
        {
          key,
          name: trimmed,
          is_me: false,
          contact_id: contact_id || null,
          avatar_style: ref.style ?? null,
          avatar_seed: ref.seed ?? null,
        },
      ];
    });
    setActiveAssigneeKey((cur) => cur || key);
  };

  /** Bagi rata: hapus assignment per-item, semua orang bayar sama. */
  const applyEqualSplit = () => {
    setAssignments([]);
    setSplitMode("equal");
    toast.success(t.splitBill.splitEvenlyApplied);
  };

  /** Switch ke mode Merata — kalau ada assignment, konfirmasi dulu. */
  const requestEqualSplit = () => {
    if (splitMode === "equal") return;
    if (assignments.length > 0) {
      setShowEqualConfirm(true);
      return;
    }
    applyEqualSplit();
  };

  const setMe = (key: string) => {
    setParticipants((prev) => prev.map((p) => ({ ...p, is_me: p.key === key ? !p.is_me : false })));
  };

  // --- Interaksi avatar peserta ---
  // Tap          -> buka picker avatar
  // Long-press   -> tandai/batal tandai "Saya" (mobile)
  // Double-click -> tandai/batal tandai "Saya" (desktop)
  const avatarTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarLongPressFiredRef = useRef(false);

  // Bersihkan timer saat component di-unmount
  useEffect(() => {
    return () => {
      if (avatarTapTimerRef.current) clearTimeout(avatarTapTimerRef.current);
      if (avatarLongPressTimerRef.current) clearTimeout(avatarLongPressTimerRef.current);
    };
  }, []);
  const handleAvatarTap = (key: string) => {
    if (avatarLongPressFiredRef.current) {
      avatarLongPressFiredRef.current = false;
      return;
    }
    if (avatarTapTimerRef.current) clearTimeout(avatarTapTimerRef.current);
    // Delay biar double-click (desktop) sempat membatalkan
    avatarTapTimerRef.current = setTimeout(() => {
      avatarTapTimerRef.current = null;
      setAvatarPickerFor({ kind: "participant", key });
    }, 250);
  };

  const handleAvatarDoubleClick = (key: string) => {
    if (avatarTapTimerRef.current) {
      clearTimeout(avatarTapTimerRef.current);
      avatarTapTimerRef.current = null;
    }
    avatarLongPressFiredRef.current = true;
    setMe(key);
    setTimeout(() => {
      avatarLongPressFiredRef.current = false;
    }, 400);
  };

  const handleAvatarTouchStart = (key: string) => {
    avatarLongPressFiredRef.current = false;
    if (avatarLongPressTimerRef.current) clearTimeout(avatarLongPressTimerRef.current);
    avatarLongPressTimerRef.current = setTimeout(() => {
      avatarLongPressTimerRef.current = null;
      avatarLongPressFiredRef.current = true;
      if (avatarTapTimerRef.current) {
        clearTimeout(avatarTapTimerRef.current);
        avatarTapTimerRef.current = null;
      }
      setMe(key);
    }, 500);
  };

  const handleAvatarTouchEnd = () => {
    if (avatarLongPressTimerRef.current) {
      clearTimeout(avatarLongPressTimerRef.current);
      avatarLongPressTimerRef.current = null;
    }
  };

  /** Hapus peserta beserta assignment-nya (langsung, tanpa konfirmasi). */
  const removeParticipant = (key: string) => {
    setParticipants((prev) => prev.filter((p) => p.key !== key));
    setAssignments((prev) => prev.filter((a) => a.participant_key !== key));
    setActiveAssigneeKey((cur) => (cur === key ? null : cur));
  };

  const addItem = () => {
    setEditingDetails(true);
    setItems((prev) => [...prev, { key: uid("i"), name: "", quantity: 1, unit_price: 0, line_subtotal: 0, item_discount: 0, item_discount_mode: "fixed" }]);
  };
  const addCharge = () => {
    setEditingDetails(true);
    setCharges((prev) => [...prev, { key: uid("c"), name: "", kind: "tax", amount_mode: "percent", amount_value: 0 }]);
  };

  const addScanFiles = (files: FileList | File[]): string | null => {
    const arr = Array.from(files || []);
    if (!arr.length) return null;
    const remainingSlots = Math.max(0, 5 - scanImages.length);
    const candidates = arr.slice(0, remainingSlots);
    if (candidates.length < arr.length) toast.error(t.splitBill.maxImages);
    if (!candidates.length) return null;
    const toAdd = candidates.map((file) => ({
      id: uid("scan"),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "ready" as const,
    }));
    setScanImages((prev) => {
      const next = [...prev, ...toAdd];
      setScanSelectedId((cur) => cur || next[0]?.id || null);
      return next;
    });
    return toAdd[toAdd.length - 1]?.id || null;
  };

  const startCamera = useCallback(() => {
    setCameraError(null);
    setCameraActive(true);
    setScanSelectedId(null);
  }, []);

  const handleCameraCapture = (file: File) => {
    const id = addScanFiles([file]);
    setCameraActive(false);
    if (id) setScanSelectedId(id);
  };

  // Tutup sheet scan: kalau datang dari halaman utama (mode scan/manual),
  // balik ke halaman utama Split Bill.
  const closeScanSheet = () => {
    if (initialMode) {
      router.push("/split-bill");
      return;
    }
    clearScanSheet();
  };

  const openScanSheet = () => {
    setScanSheetOpen(true);
    void startCamera();
  };

  const removeScanImageEntry = (id: string) => {
    setScanImages((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((x) => x.id !== id);
      setScanSelectedId((cur) => (cur === id ? (next[0]?.id || null) : cur));
      return next;
    });
  };

  const computeMergedChargesTotal = (itemsSubtotal: number, list: LocalCharge[]) => {
    return list.reduce((sum, c) => {
      const val = c.amount_mode === "percent" ? (itemsSubtotal * toNum(c.amount_value)) / 100 : toNum(c.amount_value);
      return c.kind === "discount" ? sum - Math.abs(val) : sum + val;
    }, 0);
  };

  const executeScanAndMergeImages = async () => {
    if (scanImages.length === 0) return;
    setShowRescanConfirm(false);

    // Re-scan replaces existing data & photos with this session's result.
    // If the scan fails, keep the previous state/photos (no changes committed).
    const previousImages = [...images];

    setIsScanning(true);
    setScanProgress(4);
    setScanStatusText(language === "id" ? "Menyiapkan foto..." : "Preparing photos...");

    const results: Array<{ entry: typeof scanImages[number]; res: Awaited<ReturnType<typeof scanSplitBillReceipt>> }> = [];
    const nextEntries = [...scanImages];
    const total = nextEntries.length;

    for (let i = 0; i < nextEntries.length; i++) {
      const entry = nextEntries[i];
      if (entry.result) {
        results.push({ entry, res: entry.result });
        continue;
      }
      nextEntries[i] = { ...entry, status: "scanning", error: undefined };
      setScanImages([...nextEntries]);
      setScanSelectedId(entry.id);

      // Satu foto = satupotongan progress. Naik cepat di awal, lalu mendekati
      // batas foto tsb secara asymptotic selagi menunggu AI sungguhan.
      const base = (i / total) * 100;
      const target = ((i + 0.92) / total) * 100;
      setScanProgress(Math.round(base + (target - base) * 0.3));
      setScanStatusText(
        t.splitBill.scanPreparing
          .replace("{i}", String(i + 1))
          .replace("{n}", String(total)),
      );
      const progressTick = setInterval(() => {
        setScanProgress((prev) => Math.min(target, prev + (target - prev) * 0.13));
      }, 220);
      const stageTimer = setTimeout(() => {
        setScanStatusText(
          t.splitBill.scanReading
            .replace("{i}", String(i + 1))
            .replace("{n}", String(total)),
        );
      }, 320);

      try {
        const res = await scanSplitBillReceipt(entry.file, currency);
        nextEntries[i] = { ...entry, status: "ready", result: res, error: undefined };
        results.push({ entry: nextEntries[i], res });
      } catch (e) {
        // Pesan teknis (Gemini/Postgres) diterjemahkan jadi kalimat ramah user.
        const msg = friendlyScanError(e, language);
        nextEntries[i] = { ...entry, status: "error", error: msg };
      } finally {
        clearInterval(progressTick);
        clearTimeout(stageTimer);
        setScanProgress(Math.round(((i + 1) / total) * 100));
      }
      setScanImages([...nextEntries]);
    }

    setScanStatusText(t.splitBill.scanCharges);
    setScanProgress(100);

    if (results.length === 0) {
      // All failed: keep previous session/data & photos intact.
      setIsScanning(false);
      setScanStatusText(language === "id" ? "Semua foto gagal dipindai." : "All photos failed to scan.");
      toast.error(language === "id" ? "Gagal membaca struk" : "Failed to read receipt");
      return;
    }

    // Build merged result from this session only (full re-scan / replace).
    const mergedItems: LocalItem[] = [];
    const mergedCharges: LocalCharge[] = [];
    const chargeSeen = new Set<string>();

    let mergedTitle = title;
    let mergedDate = billDate;
    let mergedCurrency = currency;

    for (const { res } of results) {
      if (!mergedTitle && res.merchant) mergedTitle = res.merchant;
      if (res.date && (!mergedDate || mergedDate === billDate)) mergedDate = res.date;
      if (res.currency) {
        const up = res.currency.toUpperCase();
        if (SUPPORTED.has(up)) mergedCurrency = up as CurrencyCode;
      }
      for (const it of res.items || []) {
        mergedItems.push({
          key: uid("i"),
          name: it.name,
          quantity: toNum(it.quantity, 1),
          unit_price: toNum(it.unit_price, 0),
          line_subtotal: toNum(it.line_subtotal, 0),
          item_discount: toNum(it.item_discount, 0),
          item_discount_mode: it.item_discount_mode === "percent" ? "percent" : "fixed",
        });
      }
      for (const c of res.charges || []) {
        const sig = `${c.kind}|${c.amount_mode}|${toNum(c.amount_value, 0)}|${(c.name || "").toLowerCase()}`;
        if (chargeSeen.has(sig)) continue;
        chargeSeen.add(sig);
        mergedCharges.push({
          key: uid("c"),
          name: c.name,
          kind: c.kind,
          amount_mode: c.amount_mode,
          amount_value: toNum(c.amount_value, 0),
        });
      }
    }

    const mergedSubtotal = mergedItems.reduce(
      (s, i) => s + getItemNetSubtotal({ line_subtotal: toNum(i.line_subtotal), item_discount: toNum(i.item_discount), item_discount_mode: i.item_discount_mode === "percent" ? "percent" : "fixed" }),
      0
    );
    const mergedChargesTotal = computeMergedChargesTotal(mergedSubtotal, mergedCharges);
    const mergedGrand = Math.round((mergedSubtotal + mergedChargesTotal) * 100) / 100;

    // Commit scanned data (replace previous scan results).
    setAssignments([]);
    setItems(mergedItems);
    setCharges(mergedCharges);
    if (mergedTitle) setTitle(mergedTitle);
    if (mergedDate) setBillDate(mergedDate);
    setCurrency(mergedCurrency);
    setGrandTotal(mergedGrand || 0);
    setEntryMode("ready");
    setStep(1);
    setEditingDetails(false);

    const payload = {
      id: billId || undefined,
      title: mergedTitle || title,
      bill_date: mergedDate,
      currency: mergedCurrency,
      subtotal_amount: mergedSubtotal,
      grand_total_amount: mergedGrand || mergedSubtotal,
      status: "draft" as const,
      split_mode: splitMode,
      notes,
      participants: participants.map((p, i) => ({
        id: p.key,
        name: p.name || (p.is_me ? t.splitBill.me : "Participant"),
        is_me: p.is_me,
        contact_id: p.contact_id || null,
        avatar_style: p.avatar_style || null,
        avatar_seed: p.avatar_seed || null,
        sort_order: i,
      })),
      items: mergedItems.map((it, i) => ({
        id: it.key,
        name: it.name,
        quantity: toNum(it.quantity, 1),
        unit_price: toNum(it.unit_price, 0),
        line_subtotal: toNum(it.line_subtotal, 0),
        item_discount: toNum(it.item_discount, 0),
        item_discount_mode: (it.item_discount_mode === "percent" ? "percent" : "fixed") as "percent" | "fixed",
        sort_order: i,
      })),
      charges: mergedCharges.map((c, i) => ({
        id: c.key,
        name: c.name,
        kind: c.kind,
        amount_mode: c.amount_mode,
        amount_value: toNum(c.amount_value, 0),
        sort_order: i,
      })),
      assignments: [] as { item_key: string; participant_key: string; share_quantity: number }[],
    };

    try {
      const wasNewBeforeScan = !billIdRef.current;
      let savedId = billIdRef.current || billId;
      if (!savedId) {
        savedId = await handleSave("draft", { silent: true, payload, skipRouteReplace: true });
        if (savedId) setBillId(savedId);
      } else {
        await handleSave("draft", { silent: true, payload, skipRouteReplace: true });
      }

      let idToUse = savedId || billIdRef.current || billId;

      // Replace previous photos with this session's photos (only after scan success).
      if (idToUse) {
        for (const oldImg of previousImages) {
          try {
            await deleteSplitBillImage(oldImg.id, idToUse);
          } catch (err) {
            console.error(err);
          }
        }
      }

      const uploaded: SplitBillImage[] = [];
      for (const entry of nextEntries) {
        try {
          let useId = savedId || billIdRef.current || billId;
          if (!useId) {
            useId = await handleSave("draft", { silent: true, payload, skipRouteReplace: true });
            if (useId) savedId = useId;
          }
          if (!useId) continue;
          if (uploaded.length >= 3) break;
          const fd = new FormData();
          fd.append("splitBillId", useId);
          const blob = await compressImage(entry.file);
          fd.append("file", blob, "receipt.jpg");
          const up = await uploadSplitBillImage(fd);
          if (up.image) uploaded.push(up.image);
        } catch (err) {
          console.error(err);
        }
      }
      setImages(uploaded);

      toast.success(t.splitBill.scanSuccess);
      if (results.length < nextEntries.length) {
        toast.error(
          language === "id"
            ? "Sebagian foto gagal dipindai, hasil yang berhasil sudah digunakan."
            : "Some photos failed to scan; successful results were used."
        );
      }

      idToUse = savedId || billIdRef.current || idToUse;
      if (wasNewBeforeScan && idToUse) {
        const targetUrl = `/split-bill/${idToUse}${initialMode === "scan" ? "?mode=scan" : ""}`;
        router.replace(targetUrl, { scroll: false });
      }
    } finally {
      setIsScanning(false);
      setScanProgress(0);
      setScanStatusText("");
      setEntryMode("ready");
      setStep(1);
      setEditingDetails(false);
      clearScanSheet();
    }
  };

  const requestScanAndMergeImages = () => {
    if (scanImages.length === 0) return;
    const hasExistingData = items.length > 0 || assignments.length > 0 || images.length > 0 || !!billId;
    if (hasExistingData) {
      setShowRescanConfirm(true);
      return;
    }
    void executeScanAndMergeImages();
  };

  const buildPayload = (nextStatus: "draft" | "balanced", idOverride?: string | null) => ({
    id: (idOverride ?? billId) || undefined,
    title,
    bill_date: billDate,
    currency,
    subtotal_amount: itemsSubtotalNet,
    grand_total_amount: Number(grandTotal) || calc.computed_grand_total,
    status: nextStatus,
    split_mode: splitMode,
    notes,
    participants: participants.map((p, i) => ({
      id: p.key,
      name: p.name || (p.is_me ? t.splitBill.me : "Participant"),
      is_me: p.is_me,
      contact_id: p.contact_id || null,
      avatar_style: p.avatar_style || null,
      avatar_seed: p.avatar_seed || null,
      sort_order: i,
    })),
    items: items.map((it, i) => ({
      id: it.key,
      name: it.name,
      quantity: toNum(it.quantity, 1),
      unit_price: toNum(it.unit_price, 0),
      line_subtotal: toNum(it.line_subtotal, 0),
      item_discount: toNum(it.item_discount, 0),
      item_discount_mode: (it.item_discount_mode === "percent" ? "percent" : "fixed") as "percent" | "fixed",
      sort_order: i,
    })),
    charges: charges.map((c, i) => ({
      id: c.key,
      name: c.name,
      kind: c.kind,
      amount_mode: c.amount_mode,
      amount_value: toNum(c.amount_value, 0),
      sort_order: i,
    })),
    assignments: assignments.map((a) => ({
      item_key: a.item_key,
      participant_key: a.participant_key,
      share_quantity: toNum(a.share_quantity, 0),
    })),
  });

  const enqueueSerializedSave = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = saveQueueRef.current.then(fn, fn);
    saveQueueRef.current = run.then(() => undefined, () => undefined);
    return run as Promise<T>;
  };

  const handleSave = async (
    nextStatus: "draft" | "balanced",
    opts?: { silent?: boolean; syncAfter?: boolean; allowUnbalanced?: boolean; payload?: ReturnType<typeof buildPayload>; manualEntry?: boolean; skipRouteReplace?: boolean }
  ): Promise<string | null> => {
    return enqueueSerializedSave(async () => {
      const effectiveId = billIdRef.current || billId || null;
      let payload = (opts?.payload || buildPayload(nextStatus, effectiveId ?? billIdRef.current ?? billId)) as Parameters<typeof saveSplitBill>[0];
      if (effectiveId) payload = { ...payload, id: effectiveId };
      if (nextStatus === "balanced" && !canMarkBalanced && !opts?.allowUnbalanced) {
        toast.error(t.splitBill.mustBalance);
        return null;
      }
      const wasNew = !effectiveId;
      setIsSaving(true);
      setSaveStatus("saving");
      try {
        const res = await saveSplitBill(payload as Parameters<typeof saveSplitBill>[0]);
        if (res.error || !res.id) {
          setSaveStatus("dirty");
          toast.error(res.error || "Failed to save");
          return null;
        }
        const savedId = res.id;
        if (billIdRef.current !== savedId) {
          billIdRef.current = savedId;
        }
        setBillId(savedId);
        setStatus(nextStatus);
        lastSavedSigRef.current = payloadSignature({
          ...(payload as Record<string, unknown>),
          id: savedId,
        } as Parameters<typeof payloadSignature>[0]);
        setSaveStatus("saved");
        scheduleSaveStatusReset();

        if (opts?.syncAfter && myRecordedTxId && needsSync) {
          const syncRes = await syncMyPortionTransaction({
            splitBillId: savedId,
            amount: myTotal,
            currency,
            description: myPortionDescription,
            items: myPortionItems,
          });
          if (!syncRes.error) {
            setLastSyncedSig(myPortionSignature);
            if (!opts?.silent) toast.success(t.splitBill.synced);
          } else {
            toast.error(syncRes.error);
          }
        }

        if (!opts?.silent) toast.success(t.splitBill.saved);
        if (wasNew && !opts?.skipRouteReplace) {
          const isManualEntry = !!opts?.manualEntry || initialMode === "manual";
          const targetUrl = `/split-bill/${savedId}${isManualEntry ? "?manual=1" : ""}`;
          router.replace(targetUrl, { scroll: false });
        }
        return savedId;
      } finally {
        setIsSaving(false);
      }
    });
  };

  // --- Autosave: state tidak boleh hilang saat refresh / navigasi ---
  const runAutosave = async () => {
    if (autosaveRunningRef.current || isScanning) return;
    autosaveRunningRef.current = true;
    try {
      await enqueueSerializedSave(async () => {
        if (isScanning) return;
        const effectiveId = billIdRef.current || billId || null;
        const nextStatus: "draft" | "balanced" = canMarkBalanced ? "balanced" : "draft";
        const payload = buildPayload(nextStatus, effectiveId ?? billIdRef.current ?? billId) as unknown as Parameters<typeof saveSplitBill>[0];
        if (payloadSignature(payload) === lastSavedSigRef.current) return;

        setSaveStatus("saving");
        lastAutosaveAtRef.current = Date.now();
        try {
          const res = await saveSplitBill(payload);
          if (res.error || !res.id) {
            setSaveStatus("dirty");
            return;
          }
          const savedId = res.id;
          const wasNew = !effectiveId;
          billIdRef.current = savedId;
          setBillId(savedId);
          setStatus(nextStatus);
          lastSavedSigRef.current = payloadSignature({
            ...(payload as Record<string, unknown>),
            id: savedId,
          } as Parameters<typeof payloadSignature>[0]);
          setSaveStatus("saved");
          scheduleSaveStatusReset();
          if (wasNew && !isScanning) {
            const isManualEntry = initialMode === "manual";
            const targetUrl = `/split-bill/${savedId}${isManualEntry ? "?manual=1" : ""}`;
            router.replace(targetUrl, { scroll: false });
          }
        } catch {
          setSaveStatus("dirty");
        }
      });
    } finally {
      autosaveRunningRef.current = false;
    }
  };

  // Signature of everything that gets persisted (status excluded on purpose).
  const currentSig = useMemo(
    () => payloadSignature(buildPayload("draft", billId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [title, billDate, currency, grandTotal, notes, participants, items, charges, assignments, billId],
  );

  // Baseline: state awal dianggap sudah tersimpan (dari DB) supaya tidak autosave sia-sia.
  useEffect(() => {
    if (lastSavedSigRef.current === null) {
      lastSavedSigRef.current = payloadSignature(buildPayload("draft", billIdRef.current || billId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Jadwalkan autosave ~2 detik setelah perubahan terakhir, dengan jeda minimum
  // antar-save supaya tidak "spam" server saat user utak-atik terus-menerus.
  useEffect(() => {
    if (isScanning || entryMode === "choose") return;
    if (lastSavedSigRef.current === null) return;
    if (currentSig === lastSavedSigRef.current) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setSaveStatus("dirty");
    const schedule = () => {
      const elapsed = Date.now() - lastAutosaveAtRef.current;
      const wait = Math.max(AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MIN_GAP_MS - elapsed);
      autosaveTimerRef.current = setTimeout(() => {
        autosaveTimerRef.current = null;
        void runAutosave();
      }, wait);
    };
    schedule();
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSig, isScanning, entryMode]);

  // Patungan baru: buat dulu bill-nya (kosong) sebelum user mengisi data.
  // Kalau tidak, autosave harus mengubah URL -> Next.js remount -> user kehilangan
  // fokus input & posisi langkah.
  const ensureBillCreated = async (opts?: { manual?: boolean }) => {
    if (billIdRef.current) return;
    await handleSave("draft", { silent: true, manualEntry: !!opts?.manual });
  };

  // Mulai langsung ke flow tertentu (dari halaman awal: Scan / Manual).
  useEffect(() => {
    if (!initialMode) return;
    if (initialMode === "scan") {
      queueMicrotask(() => openScanSheet());
    } else {
      queueMicrotask(() => {
        setEntryMode("ready");
        setStep(1);
        setEditingDetails(true);
        void ensureBillCreated({ manual: true });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode]);

  /** Hapus satu foto struk — patungannya tetap ada, hanya file gambarnya yang dibuang. */
  const confirmDeleteImage = async () => {
    const img = imageToDelete;
    setImageToDelete(null);
    if (!img || !billId) return;
    try {
      await deleteSplitBillImage(img.id, billId);
      setImages((prev) => prev.filter((x) => x.id !== img.id));
      toast.success(language === "id" ? "Foto struk dihapus" : "Receipt photo deleted");
    } catch {
      toast.error(language === "id" ? "Gagal hapus foto" : "Failed to delete photo");
    }
  };

  /** Strip foto struk + tombol hapus (dipakai di Step 1, Step 4 & di tampilan hasil). */
  const renderReceiptPhotos = () => (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
        {language === "id" ? "Foto struk" : "Receipt photos"} ({images.length}/3)
      </span>
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-1">
        {images.map((img) => (
          <div
            key={img.id}
            className="relative w-16 h-16 rounded-lg overflow-hidden border border-[#E5E7EB] dark:border-[#27272A] shrink-0 bg-[#F8F9FA] dark:bg-[#1A1A20] group"
          >
            {img.signed_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img.signed_url} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => window.open(img.signed_url, "_blank")} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-[#94A3B8]">...</div>
            )}
            {/* Hapus foto (patungan tetap ada, hanya gambarnya yang dibuang) */}
            {billId && (
              <button
                type="button"
                onClick={() => setImageToDelete(img)}
                className="absolute top-0 right-0 w-5 h-5 rounded-bl-lg bg-black/65 text-white flex items-center justify-center hover:bg-rose-600 transition-colors"
                title={language === "id" ? "Hapus foto" : "Delete photo"}
                aria-label={language === "id" ? "Hapus foto" : "Delete photo"}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const buildMyPortionRecordItems = (): TransactionItem[] => {
    if (!meParticipantKey) return [];
    const myLines = calc.per_person.find((p) => p.participant_id === meParticipantKey)?.item_lines ?? [];
    return myLines
      .map((l) => {
        const item = items.find((i) => i.key === l.item_id);
        const shareQty = Number(l.share_quantity) || 0;
        const amount = Number(l.amount) || 0;
        const effectivePrice = shareQty > 0 ? amount / shareQty : 0;
        return {
          name: l.name || item?.name || "",
          quantity: String(l.share_quantity),
          price: String(effectivePrice),
          subtotal: String(amount),
        };
      })
      .filter((i) => i.name.trim() && (Number(i.subtotal) > 0 || Number(i.price) > 0));
  };

  const openRecord = () => {
    const compatible = accounts.filter((a) => (a.currency || "").toUpperCase() === currency.toUpperCase());
    const preferred = compatible[0] || accounts[0];
    setRecordState({
      accountId: preferred?.id || "",
      categoryId: "",
      description: myPortionDescription,
      date: billDate || getLocalDateString(),
    });
    setRecordItems(buildMyPortionRecordItems());
    setShowRecord(true);
  };

  const myPersonCalc = meParticipantKey
    ? calc.per_person.find((p) => p.participant_id === meParticipantKey)
    : undefined;

  const myDiscountMemo = useMemo(() => {
    if (!myPersonCalc) return "";
    const parts: string[] = [];
    const globalDiscount = Math.abs(Number(myPersonCalc.charges_breakdown?.discount) || 0);
    if (globalDiscount > 0.0001) {
      parts.push(`${language === "id" ? "Diskon" : "Discount"}: -${formatCurrency(globalDiscount, currency)}`);
    }
    const itemDiscounts = (myPersonCalc.item_lines || [])
      .filter((l) => (Number(l.discount_amount) || 0) > 0.0001)
      .map((l) => `${language === "id" ? "Diskon" : "Discount"} ${l.name}: -${formatCurrency(Number(l.discount_amount) || 0, currency)}`);
    if (itemDiscounts.length > 0) {
      parts.push(...itemDiscounts);
    }
    return parts.join("\n");
  }, [myPersonCalc, currency, language]);

  const doRecord = async () => {
    if (isRecording) return;
    setIsRecording(true);
    try {
      let id = billIdRef.current || billId;
      if (!id) {
        id = await handleSave(status, { silent: true });
        if (!id) return;
      }
      id = billIdRef.current || id;
      if (!recordState.accountId || !recordState.categoryId) {
        toast.error(t.splitBill.selectAccountCategory);
        return;
      }
      const finalDesc = myPortionDescription.slice(0, 2000);
      const validRecordItems = recordItems.filter((i) => i.name.trim() && Number(i.price) > 0);
      let descWithItems = finalDesc;
      if (validRecordItems.length) {
        const summary = formatItemsSummary(validRecordItems, currency);
        if (summary) {
          const memoPart = myDiscountMemo ? ` [Memo: ${myDiscountMemo}]` : "";
          const overhead = finalDesc.length + memoPart.length + " [Items: ]".length;
          const available = Math.max(0, 2000 - overhead);
          const clipped = summary.length > available ? summary.slice(0, available).trimEnd() + "…" : summary;
          if (clipped) descWithItems = `${finalDesc} [Items: ${clipped}]${memoPart}`;
          else descWithItems = `${finalDesc}${memoPart}`;
        } else if (myDiscountMemo) {
          descWithItems = `${finalDesc} [Memo: ${myDiscountMemo}]`.slice(0, 2000);
        }
      } else if (myDiscountMemo) {
        descWithItems = `${finalDesc} [Memo: ${myDiscountMemo}]`.slice(0, 2000);
      }
      const res = await recordMyPortion({
        splitBillId: id,
        accountId: recordState.accountId,
        categoryId: recordState.categoryId,
        amount: myTotal,
        currency,
        date: recordState.date || billDate || getLocalDateString(),
        description: descWithItems,
        items: validRecordItems,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.transactionId) {
        setMyRecordedTxId(res.transactionId);
        setLastSyncedSig(`${currency}:${myTotal}:${finalDesc}`);
      }
      toast.success(t.splitBill.recordSuccess);
      setShowRecord(false);
    } finally {
      setIsRecording(false);
    }
  };

  const shareSummary = async () => {
    const text = formatSplitSummaryText({ title, currency, grandTotal: targetGrand, calc, includeBrand: true, language, splitMode });
    if (navigator.share) {
      try {
        await navigator.share({ title: `Pocketly - ${title || t.splitBill.title}`, text });
        return;
      } catch {
        // User cancelled or share failed — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t.splitBill.copied);
    } catch {
      toast.error(t.splitBill.copyFailed);
    }
  };

  const copySummary = async () => {
    const text = formatSplitSummaryText({ title, currency, grandTotal: targetGrand, calc, includeBrand: true, language, splitMode });
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t.splitBill.copied);
    } catch {
      toast.error(t.splitBill.copyFailed);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _refreshImageUrl = async (imgId: string) => {
    const res = await getSplitBillImageSignedUrl(imgId);
    if (res.url) {
      setImages((prev) => prev.map((i) => (i.id === imgId ? { ...i, signed_url: res.url } : i)));
    }
  };

  const saveContact = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (contacts.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return;
    const res = await upsertSplitBillContact(trimmed);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (res.id) {
      setContacts((prev) => [...prev, { id: res.id!, user_id: "", name: trimmed, created_at: "", updated_at: "" }].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(t.splitBill.saveContact);
    }
  };

  const removeContact = async (id: string) => {
    await deleteSplitBillContact(id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    // Lepaskan relasi peserta -> kontak ini juga di state lokal.
    // (di DB FK-nya sudah jadi NULL, tapi kalau state lokal masih nunjuk ke kontak
    //  yang udah dihapus, save berikutnya bakal gagal karena foreign key.)
    setParticipants((prev) =>
      prev.map((p) => (p.contact_id === id ? { ...p, contact_id: null } : p)),
    );
  };

  /** Ganti avatar peserta (dan kontaknya kalau dia kontak tersimpan). */
  const applyAvatar = async (ref: AvatarRef) => {
    const target = avatarPickerFor;
    setAvatarPickerFor(null);
    if (!target) return;
    if (target.kind === "participant") {
      const p = participants.find((x) => x.key === target.key);
      setParticipants((prev) =>
        prev.map((x) =>
          x.key === target.key
            ? { ...x, avatar_style: ref.style ?? null, avatar_seed: ref.seed ?? null }
            : x,
        ),
      );
      // Kalau peserta ini juga kontak tersimpan, samakan avatar di kontak.
      const contact = contacts.find(
        (c) =>
          (p?.contact_id && c.id === p.contact_id) ||
          c.name.trim().toLowerCase() === (p?.name || "").trim().toLowerCase(),
      );
      if (contact) {
        const res = await upsertSplitBillContact(contact.name, contact.id, ref);
        if (!res.error) {
          setContacts((prev) =>
            prev.map((c) =>
              c.id === contact.id
                ? { ...c, avatar_style: ref.style ?? null, avatar_seed: ref.seed ?? null }
                : c,
            ),
          );
        }
      }
    } else {
      const contact = contacts.find((c) => c.id === target.id);
      if (!contact) return;
      const res = await upsertSplitBillContact(contact.name, contact.id, ref);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setContacts((prev) =>
        prev.map((c) =>
          c.id === target.id
            ? { ...c, avatar_style: ref.style ?? null, avatar_seed: ref.seed ?? null }
            : c,
        ),
      );
      // Peserta dengan nama sama ikut pakai avatar ini.
      setParticipants((prev) =>
        prev.map((p) =>
          (p.contact_id && p.contact_id === target.id) ||
          p.name.trim().toLowerCase() === contact.name.trim().toLowerCase()
            ? { ...p, avatar_style: ref.style ?? null, avatar_seed: ref.seed ?? null }
            : p,
        ),
      );
    }
  };



  const handleDeleteBill = async () => {
    if (!billId || isDeletingBill) return;
    setIsDeletingBill(true);
    try {
      const res = await deleteSplitBill(billId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setShowDeleteConfirm(false);
      router.push("/split-bill");
    } finally {
      setIsDeletingBill(false);
    }
  };

  const steps = [
    { id: 1 as const, label: t.splitBill.stepItems },
    { id: 2 as const, label: t.splitBill.stepParticipants },
    { id: 3 as const, label: t.splitBill.stepAssign },
    { id: 4 as const, label: t.splitBill.stepSummary },
  ];

  const goToStep = (s: 1 | 2 | 3 | 4) => {
    if (s === 3 && participants.length > 0) {
      setActiveAssigneeKey((cur) => (cur && participants.some((p) => p.key === cur)) ? cur : participants[0].key);
    }
    setStep(s);
  };

  const personLabel = (p: { name: string; is_me: boolean }) => {
    if (!p.is_me) return p.name;
    const n = (p.name || "").trim().toLowerCase();
    const me = t.splitBill.me.trim().toLowerCase();
    return n === me ? p.name : `${p.name}`;
  };

  // Tanggal ringkas: "12 Nov 2026" (singkatan bulan, sesuai bahasa)
  const formatBillDate = (d: string) => {
    if (!d) return "";
    try {
      return new Date(`${d}T00:00:00`).toLocaleDateString(
        language === "id" ? "id-ID" : "en-US",
        { day: "numeric", month: "short", year: "numeric" },
      );
    } catch {
      return d;
    }
  };

  const handleStepTouchStart = (e: React.TouchEvent) => {
    const t0 = e.touches[0];
    stepTouchStart.current = { x: t0.clientX, y: t0.clientY };
  };

  const handleStepTouchEnd = (e: React.TouchEvent) => {
    if (!stepTouchStart.current) return;
    const t1 = e.changedTouches[0];
    const dx = t1.clientX - stepTouchStart.current.x;
    const dy = t1.clientY - stepTouchStart.current.y;
    stepTouchStart.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0 && step < 4) goToStep((step + 1) as 1 | 2 | 3 | 4);
    if (dx > 0 && step > 1) goToStep((step - 1) as 1 | 2 | 3 | 4);
  };

  const renderScanSheet = () => {
    if (!scanSheetOpen) return null;
    const canAddMore = scanImages.length < 3;
    const capturedCount = scanImages.length;
    const totalSlots = 3;

    const onPreviewScroll = () => {
      const el = previewScrollRef.current;
      if (!el || !el.clientWidth) return;
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      const img = scanImages[idx];
      if (img && img.id !== scanSelectedId) {
        previewScrollSyncRef.current = true;
        setScanSelectedId(img.id);
      }
    };

    // Live camera (full screen, iOS-camera style floating controls)
    if (cameraActive) {
      return (
        <CameraLiveView
          isOpen
          onClose={() => {
            if (capturedCount > 0) {
              setCameraActive(false);
              setScanSelectedId((cur) => cur || scanImages[0]?.id || null);
            } else {
              closeScanSheet();
            }
          }}
          onCapture={handleCameraCapture}
          onPickImage={() => scanInputRef.current?.click()}
          error={cameraError}
          onError={setCameraError}
          onRetry={() => startCamera()}
        >
          {/* Captured thumbnails (top-left, under the close button) */}
          {capturedCount > 0 && (
            <div className="absolute left-4 top-[calc(max(1rem,env(safe-area-inset-top))+3.75rem)] flex flex-col gap-1.5">
              {scanImages.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => {
                    setScanSelectedId(img.id);
                    setCameraActive(false);
                  }}
                  className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-white/70 bg-black/40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Primary action (above the shutter) */}
          {capturedCount > 0 && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[calc(max(1.5rem,env(safe-area-inset-bottom))+6.5rem)] w-[min(92%,24rem)]">
              <button
                type="button"
                onClick={requestScanAndMergeImages}
                disabled={isScanning}
                className="w-full h-12 rounded-full bg-white text-black text-sm font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform disabled:opacity-60"
              >
                <ScanLine className="w-4 h-4" />
                {language === "id" ? `Pindai ${capturedCount} foto` : `Scan ${capturedCount} photo${capturedCount > 1 ? "s" : ""}`}
              </button>
            </div>
          )}

          {/* hidden input for uploading multiple photos */}
          <input
            ref={scanInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (e.target) e.target.value = "";
              if (files.length) {
                addScanFiles(files);
                setCameraActive(false);
              }
            }}
          />
        </CameraLiveView>
      );
    }

    // Preview / fallback (camera not running yet)
    return (
      <div className="fixed inset-0 z-70 flex flex-col bg-black border-black">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-white/10">
          <button
            type="button"
            onClick={closeScanSheet}
            className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            aria-label={language === "id" ? "Tutup" : "Close"}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="text-center min-w-0">
            <p className="text-sm font-bold text-white">{language === "id" ? "Foto Struk" : "Receipt Photos"}</p>
            <p className="text-[11px] text-white/50">{capturedCount}/{totalSlots}</p>
          </div>
          <div className="w-10" />
        </div>

        {/* Preview (swipeable) */}
        <div className="flex-1 min-h-0 bg-black">
          {capturedCount > 0 ? (
            isScanning ? (
              /* Scan happens in place: same preview layout, only the scan effect is added */
              <div className="relative w-full h-full">
                <ReceiptScanOverlay
                  contained
                  backdrop={false}
                  padding="p-4"
                  imageClassName="rounded-xl"
                  showStatus={false}
                  imageUrl={
                    (scanImages.find((i) => i.status === "scanning") ||
                      scanImages.find((i) => i.id === scanSelectedId) ||
                      scanImages[0])?.previewUrl
                  }
                  scanning
                />
              </div>
            ) : (
              <div
                ref={previewScrollRef}
                onScroll={onPreviewScroll}
                className="flex h-full w-full overflow-x-auto snap-x snap-mandatory scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {scanImages.map((img) => (
                  <div key={img.id} className="relative w-full h-full shrink-0 snap-center flex items-center justify-center p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.previewUrl} alt="" className="max-h-full max-w-full object-contain rounded-xl" />
                    {img.status === "error" && (
                      <div className="absolute top-6 right-6 bg-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">!</div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="h-full flex items-center justify-center p-4">
              <div className="w-full h-full max-h-[70vh] rounded-2xl border border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="w-16 h-16 rounded-full border-2 border-white/15 flex items-center justify-center">
                  <Camera className="w-7 h-7 text-white/50" />
                </div>
                <p className="text-sm font-semibold text-white">
                  {language === "id" ? "Ambil atau upload foto struk" : "Take or upload receipt photos"}
                </p>
                <p className="text-xs text-white/50">
                  {cameraError || (language === "id"
                    ? "Bisa foto berkali-kali & upload beberapa gambar (maks 3), lalu pindai."
                    : "Take multiple photos or upload images (max 3), then scan.")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {capturedCount > 0 && (
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {scanImages.map((img) => (
                <div
                  key={img.id}
                  className={cn(
                    "relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0",
                    scanSelectedId === img.id ? "border-white" : "border-white/20",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setScanSelectedId(img.id);
                      const i = scanImages.findIndex((x) => x.id === img.id);
                      const el = previewScrollRef.current;
                      if (i >= 0 && el) {
                        previewScrollSyncRef.current = true;
                        el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
                      }
                    }}
                    className="w-full h-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                  {img.status === "scanning" && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {!isScanning && (
                    <button
                      type="button"
                      onClick={() => removeScanImageEntry(img.id)}
                      className="absolute top-0 right-0 bg-black/70 text-white rounded-bl-md p-0.5 hover:bg-rose-600 transition-colors"
                      aria-label={language === "id" ? "Hapus foto" : "Remove photo"}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom controls */}
        <div className="px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-white/10 flex flex-col gap-2">
          {isScanning && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 text-xs text-white/70">
                <span className="truncate">{scanStatusText || (language === "id" ? "Memindai..." : "Scanning...")}</span>
                <span className="font-mono shrink-0">{Math.round(scanProgress)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                <div className="h-full bg-white transition-all duration-300" style={{ width: `${Math.max(5, Math.round(scanProgress))}%` }} />
              </div>
            </div>
          )}
          {!isScanning && scanImages.some((x) => x.status === "error") && (
            <p className="text-[11px] text-amber-300">
              {language === "id" ? "Ada foto gagal dipindai. Hapus lalu pindai ulang." : "Some photos failed. Remove and scan again."}
            </p>
          )}

          <div className="flex items-center gap-2">
            {!isScanning && (
              <>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="h-11 w-11 shrink-0 rounded-xl border border-white/20 bg-white/10 text-white flex items-center justify-center hover:bg-white/15 transition-colors"
                  aria-label={language === "id" ? "Buka kamera" : "Open camera"}
                  title={language === "id" ? "Buka kamera" : "Open camera"}
                >
                  <Camera className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scanInputRef.current?.click()}
                  disabled={!canAddMore}
                  className="relative h-11 w-11 shrink-0 rounded-xl border border-white/20 bg-white/10 text-white flex items-center justify-center hover:bg-white/15 transition-colors disabled:opacity-40"
                  aria-label={language === "id" ? "Upload foto" : "Upload photos"}
                  title={language === "id" ? "Upload foto" : "Upload photos"}
                >
                  <ImagePlus className="w-5 h-5" />
                  {capturedCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 rounded-full bg-white text-black text-[10px] font-bold flex items-center justify-center">
                      {capturedCount}
                    </span>
                  )}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={requestScanAndMergeImages}
              disabled={isScanning || capturedCount === 0}
              className="h-11 flex-1 rounded-xl bg-white text-black text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
            >
              <ScanLine className="w-4 h-4" />
              {capturedCount > 0
                ? (language === "id" ? `Pindai ${capturedCount} foto` : `Scan ${capturedCount} photo${capturedCount > 1 ? "s" : ""}`)
                : (language === "id" ? "Pindai foto" : "Scan photos")}
            </button>
          </div>

          {/* hidden input for uploading multiple photos */}
          <input
            ref={scanInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (e.target) e.target.value = "";
              if (files.length) {
                addScanFiles(files);
                setCameraActive(false);
              }
            }}
          />
        </div>
      </div>
    );
  };

  // Gesture: geser ke atas pada kartu hasil = catat porsi saya (mobile)
  const resultTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleResultTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    resultTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };
  const handleResultTouchEnd = (e: React.TouchEvent) => {
    const start = resultTouchStartRef.current;
    resultTouchStartRef.current = null;
    if (!start) return;
    const end = e.changedTouches[0];
    const dy = end.clientY - start.y;
    const dx = Math.abs(end.clientX - start.x);
    if (dy < -60 && dx < 70) {
      // Kasih tahu alasannya kalau gesture ini gabisa dipakai (bukan diamaja).
      if (myRecordedTxId) {
        toast.success(
          language === "id"
            ? "Porsi kamu sudah tercatat di transaksi."
            : "Your portion is already recorded as a transaction.",
        );
        return;
      }
      if (!meParticipant) {
        toast.error(
          language === "id"
            ? "Belum ada peserta yang ditandai sebagai 'Saya'. Tahan avatar (atau klik 2×) untuk menandainya."
            : "No participant is marked as 'You' yet. Long-press the avatar (or double-click) to mark it.",
        );
        return;
      }
      if (canMarkBalanced) openRecord();
      else toast.error(t.splitBill.mustBalance);
    }
  };

  // Initial choice screen for new split bills
  if (entryMode === "choose" && !billId) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <div className="flex items-center gap-2 py-2">
          <Link href="/split-bill" className="p-2 rounded-lg hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20]"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="text-lg font-bold">{t.splitBill.newBill}</h1>
        </div>
        <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] p-5 sm:p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-bold">{t.splitBill.chooseStart}</h2>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">{t.splitBill.chooseStartDesc}</p>
          </div>
          {/* inputs moved into full-screen scan sheet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={openScanSheet}
              className="text-left p-4 rounded-xl border border-[#E5E7EB] dark:border-[#27272A] hover:border-[#0F172A] dark:hover:border-[#FAFAFA] hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20] transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-300 flex items-center justify-center mb-3"><Camera className="w-5 h-5" /></div>
              <p className="font-bold text-sm">{t.splitBill.startScan}</p>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">{t.splitBill.startScanDesc}</p>
            </button>
            <button
              onClick={() => {
                setEntryMode("ready");
                setStep(1);
                void ensureBillCreated({ manual: true });
              }}
              className="text-left p-4 rounded-xl border border-[#E5E7EB] dark:border-[#27272A] hover:border-[#0F172A] dark:hover:border-[#FAFAFA] hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20] transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mb-3"><PenLine className="w-5 h-5" /></div>
              <p className="font-bold text-sm">{t.splitBill.startManual}</p>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">{t.splitBill.startManualDesc}</p>
            </button>
          </div>
        </div>
        {renderScanSheet()}
      </div>
    );
  }

  // Record / sync porsi saya (dipakai di tampilan hasil & Step 4)
  const renderMyPortionBlock = () => {
    // Belum ada peserta "Saya" -> kasih petunjuk cara menandainya.
    if (!meParticipant) {
      return (
        <p className="text-[10px] text-[#94A3B8]">
          {language === "id"
            ? "Tandai salah satu peserta sebagai 'Saya' (tahan avatar / klik 2×) untuk mencatat porsi kamu ke transaksi."
            : "Mark a participant as 'You' (long-press the avatar / double-click) to record your portion as a transaction."}
        </p>
      );
    }
    // Belum pernah dicatat -> petunjuk cara menc Catat (swipe / tombol ↑).
    if (!myRecordedTxId) {
      return (
        <p className="text-[10px] text-[#94A3B8]">
          {language === "id"
            ? "Geser ke atas pada hasil (atau klik ↑ di baris porsi kamu) untuk mencatatnya ke transaksi."
            : "Swipe up on the result (or click ↑ on your row) to record it as a transaction."}
        </p>
      );
    }
    // Sudah tercatat -> transaksi otomatis ikut ter-update setiap autosave,
    // jadi nggak ada blok/tombol manual di sini.
    return null;
  };

  /**
   * Tampilan HASIL — inilah "ringkasan" yang jadi hasil akhir.
   * Satu kartu bersih: angka struk (subtotal → biaya → total) lalu rincian per orang.
   */
  const renderResultView = (opts?: { showShare?: boolean }) => (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-2xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] p-4 sm:p-5 flex flex-col gap-4 shadow-sm"
        onTouchStart={handleResultTouchStart}
        onTouchEnd={handleResultTouchEnd}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold text-[#0F172A] dark:text-[#FAFAFA]">{title || t.splitBill.title}</p>
            <p className="text-xs text-[#64748B]">{formatBillDate(billDate)} · {currency}</p>
          </div>
          {splitMode === "equal" && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] dark:border-[#27272A] px-2.5 py-1 text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8]">
              {t.splitBill.equalSplit}
            </span>
          )}
        </div>
        {/* Angka struk */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[#64748B]">{t.splitBill.subtotal}</span>
            <span className="font-mono font-semibold">{formatCurrency(calc.items_subtotal, currency)}</span>
          </div>
          {chargeTotals.map((c) => (
            <div key={c.kind} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[#64748B]">{c.label}</span>
              <span className={cn("font-mono font-semibold", c.kind === "discount" && "text-rose-600")}>
                {formatCurrency(c.amount, currency)}
              </span>
            </div>
          ))}
          {hasTargetMismatch && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[#64748B]">{t.splitBill.computedTotal}</span>
              <span className="font-mono font-semibold text-amber-600">{formatCurrency(calc.computed_grand_total, currency)}</span>
            </div>
          )}
        </div>

        {/* Total akhir */}
        <div className="flex items-end justify-between gap-3 border-y border-[#E5E7EB] dark:border-[#27272A] py-3">
          <span className="text-sm text-[#64748B]">{t.splitBill.billTotalLabel}</span>
          <span className="text-xl font-bold font-mono">{formatCurrency(targetGrand, currency)}</span>
        </div>

        {hasTargetMismatch && (
          <div className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg px-2 py-1.5 -mt-2">
            {t.splitBill.targetMismatch.replace("{diff}", formatCurrency(computedVsTargetDiff, currency))}
          </div>
        )}

        {!canMarkBalanced && (
          <div className="text-xs font-semibold text-amber-600 -mt-2">
            {calc.unassigned_item_ids.length > 0 && (
              <p>{`${t.splitBill.unassigned}: ${calc.unassigned_item_ids.length} item.`}</p>
            )}
            {Math.abs(targetGrand - calc.per_person.reduce((s, p) => s + p.total, 0)) >= 0.01 && (
              <p>{`${t.splitBill.notBalanced} (${t.splitBill.difference} ${formatCurrency(targetGrand - calc.per_person.reduce((s, p) => s + p.total, 0), currency)})`}</p>
            )}
          </div>
        )}

        {/* Rincian per orang */}
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">{language === "id" ? "Per Orang" : "Per Person"}</p>
          {calc.per_person.length === 0 ? (
            <p className="text-xs text-[#94A3B8]">{language === "id" ? "Belum ada pembagian." : "No split yet."}</p>
          ) : calc.per_person.map((p) => (
            <div key={p.participant_id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 min-w-0">
                  <DiceAvatar
                    name={p.name}
                    style={participants.find((x) => x.key === p.participant_id)?.avatar_style}
                    seed={participants.find((x) => x.key === p.participant_id)?.avatar_seed}
                    size="xs"
                  />
                  <span className="text-sm font-bold truncate">{personLabel({ name: p.name, is_me: p.is_me })}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold font-mono">{formatCurrency(p.total, currency)}</span>
                  {/* Aksi catat porsi: tombol kecil (desktop saja) & gesture swipe up (mobile) */}
                  {p.is_me && !myRecordedTxId && (
                    <button
                      type="button"
                      onClick={() => (canMarkBalanced ? openRecord() : toast.error(t.splitBill.mustBalance))}
                      className="hidden sm:flex w-5 h-5 rounded-full border border-[#E5E7EB] dark:border-[#27272A] text-[#64748B] dark:text-[#94A3B8] items-center justify-center hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] transition-colors shrink-0"
                      title={t.splitBill.recordMyPortion}
                      aria-label={t.splitBill.recordMyPortion}
                    >
                      <ArrowUp className="w-2.5 h-2.5" />
                    </button>
                  )}
                </span>
              </div>
              <div className="pl-1 flex flex-col gap-1">
                {p.item_lines.map((l, idx) => (
                  <div key={`${l.item_id}-${idx}`} className="flex justify-between text-xs text-[#64748B] gap-3">
                    <span className="truncate">
                      {l.name}
                      {splitMode !== "equal" && ` × ${formatQty(l.share_quantity)}`}
                    </span>
                    <span className="font-mono shrink-0 flex items-center gap-1.5">
                      {Math.abs(l.discount_amount || 0) > 0.004 && (
                        <>
                          <span className="line-through opacity-60">{formatCurrency(l.gross_amount, currency)}</span>
                          <span>{formatCurrency(l.amount, currency)}</span>
                        </>
                      )}
                      {Math.abs(l.discount_amount || 0) <= 0.004 && formatCurrency(l.amount, currency)}
                    </span>
                  </div>
                ))}
                {p.charges_breakdown.tax !== 0 && (
                  <div className="flex justify-between text-xs text-[#64748B] gap-3">
                    <span className="truncate">{language === "id" ? "Pajak" : "Tax"}</span>
                    <span className="font-mono shrink-0">{formatCurrency(p.charges_breakdown.tax, currency)}</span>
                  </div>
                )}
                {p.charges_breakdown.service !== 0 && (
                  <div className="flex justify-between text-xs text-[#64748B] gap-3">
                    <span className="truncate">{language === "id" ? "Service" : "Service"}</span>
                    <span className="font-mono shrink-0">{formatCurrency(p.charges_breakdown.service, currency)}</span>
                  </div>
                )}
                {p.charges_breakdown.other !== 0 && (
                  <div className="flex justify-between text-xs text-[#64748B] gap-3">
                    <span className="truncate">{language === "id" ? "Biaya lain" : "Other charges"}</span>
                    <span className="font-mono shrink-0">{formatCurrency(p.charges_breakdown.other, currency)}</span>
                  </div>
                )}
                {p.charges_breakdown.discount !== 0 && (
                  <div className="flex justify-between text-xs text-rose-600 gap-3">
                    <span className="truncate">{language === "id" ? "Diskon" : "Discount"}</span>
                    <span className="font-mono shrink-0">{formatCurrency(p.charges_breakdown.discount, currency)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-1 flex items-center justify-center gap-1.5 text-[10px] text-[#94A3B8]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="w-3.5 h-3.5 rounded object-contain" />
          <span>{language === "id" ? "Dihitung dengan Pocketly" : "Calculated with Pocketly"}</span>
        </div>
      </div>

      {opts?.showShare !== false && (
        <div className="flex gap-2">
          <Button onClick={shareSummary} className="flex-1 h-11"><Share2 className="w-4 h-4 mr-2" />{t.splitBill.share}</Button>
          <Button variant="secondary" onClick={copySummary} className="flex-1 h-11"><Copy className="w-4 h-4 mr-2" />{t.splitBill.copy}</Button>
        </div>
      )}
    </div>
  );

  return (
    <div className={cn("flex flex-col w-full", (billId && !isEditing) ? "max-w-4xl mx-auto gap-4" : "max-w-3xl mx-auto bg-[#F8FAFC] dark:bg-[#09090B]")}>
      {/* View mode for saved bills: the result IS the summary */}
      {billId && !isEditing ? (
        <>
          <div className="flex items-center justify-between gap-2 py-3 px-1 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Link href="/split-bill" className="p-2 rounded-lg hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] shrink-0"><ArrowLeft className="w-4 h-4" /></Link>
              <div className="min-w-0">
                <h1 className="text-lg font-bold truncate">{title || t.splitBill.title}</h1>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#64748B]">{formatBillDate(billDate)} · {currency}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="secondary" onClick={() => { setIsEditing(true); setStep(1); }} className="h-9 text-xs"><PenLine className="w-4 h-4 mr-1" />{t.splitBill.edit}</Button>
              <button onClick={() => setShowDeleteConfirm(true)} className="p-2 rounded-lg text-[#94A3B8] hover:text-[#E11D48]" title={t.splitBill.delete}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto">
            {images.length > 0 && (
              <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] p-4">
                {renderReceiptPhotos()}
              </div>
            )}
            {renderResultView()}
            {renderMyPortionBlock()}
          </div>
        </>
      ) : (
        /* Satu step tampil bergantian, layout sederhana (bukan wizard shell) */
        <>
          <div className="flex items-center justify-between gap-2 py-2 px-1">
            <div className="flex items-center gap-2 min-w-0">
              {step === 1 && editingDetails ? (
                <button
                  type="button"
                  onClick={() => setEditingDetails(false)}
                  className="w-10 h-10 rounded-full border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] flex items-center justify-center hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20] shrink-0"
                  aria-label={language === "id" ? "Kembali" : "Back"}
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : (
                <Link href="/split-bill" className="w-10 h-10 rounded-full border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] flex items-center justify-center hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20] shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              )}
              {billId && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  title={t.splitBill.delete}
                  aria-label={t.splitBill.delete}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate min-w-0 text-[#0F172A] dark:text-[#FAFAFA]">{title || t.splitBill.newBill}</h1>
                <p className="text-[11px] text-[#64748B] truncate mt-0.5">
                  {billDate
                    ? new Date(billDate + "T00:00:00").toLocaleDateString(language === "id" ? "id-ID" : "en-US", { day: "numeric", month: "short", year: "numeric" })
                    : `${steps.find((s) => s.id === step)?.label} · ${step}/4`}
                </p>
              </div>
            </div>
            <div ref={actionsRef} className="flex items-center gap-1.5 shrink-0">
              {saveStatus === "dirty" || saveStatus === "saving" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8] mr-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {language === "id" ? "Menyimpan" : "Saving"}
                </span>
              ) : saveStatus === "saved" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mr-1">
                  <Check className="w-3 h-3" />
                  {language === "id" ? "Tersimpan" : "Saved"}
                </span>
              ) : null}
              {step === 1 && (
                <button
                  type="button"
                  onClick={openScanSheet}
                  disabled={isScanning}
                  title={t.splitBill.scanReceipt}
                  aria-label={t.splitBill.scanReceipt}
                  className="w-10 h-10 rounded-full border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] flex items-center justify-center hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20] disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}
              {step === 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const next = !editingDetails;
                    setEditingDetails(next);
                    // Hanya saat user eksplisit masuk mode edit kita push sentinel history,
                    // supaya tombol Back keluar dari edit (bukan keluar halaman).
                    editModeRequestedRef.current = next;
                  }}
                  title={editingDetails ? (language === "id" ? "Selesai ubah" : "Done") : (language === "id" ? "Ubah item" : "Edit item")}
                  aria-label={editingDetails ? (language === "id" ? "Selesai ubah" : "Done") : (language === "id" ? "Ubah item" : "Edit item")}
                  className="w-10 h-10 rounded-full border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] flex items-center justify-center hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20]"
                >
                  {editingDetails ? <Check className="w-4 h-4" /> : <PenLine className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Stepper (sticky) */}
          <div className="sticky top-0 z-20 bg-[#F8FAFC]/95 dark:bg-[#09090B]/95 backdrop-blur border-b border-[#E5E7EB]/70 dark:border-[#27272A]/70 px-1 py-2">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {steps.map((s, i) => (
                <React.Fragment key={s.id}>
                  <button
                    onClick={() => goToStep(s.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors",
                      step === s.id
                        ? "bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] border-transparent"
                        : "bg-white dark:bg-[#121215] text-[#64748B] dark:text-[#94A3B8] border-[#E5E7EB] dark:border-[#27272A] hover:border-[#94A3B8]"
                    )}
                  >
                    <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold", step === s.id ? "bg-white/20 dark:bg-black/10" : "bg-[#F1F3F5] dark:bg-[#1A1A20]")}>{s.id}</span>
                    {s.label}
                  </button>
                  {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-[#CBD5E1] shrink-0" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Step content (1 step bergantian, scroll halaman normal) */}
          <div className="px-1 py-2" onTouchStart={handleStepTouchStart} onTouchEnd={handleStepTouchEnd}>
      {/* Step 1: Review items/prices (read-only by default), edit only when needed */}
      {step === 1 && (
        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] p-4 flex flex-col gap-4">
          {/* Receipt photos - hanya muncul kalau patungan ini punya foto */}
          {images.length > 0 && renderReceiptPhotos()}

          {editingDetails ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">{t.splitBill.billTitle}</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="px-3 py-2.5 rounded-lg border border-[#E5E7EB] dark:border-[#27272A] bg-transparent text-sm" placeholder={t.splitBill.merchantPlaceholder} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">{t.common.date}</label>
                  <DatePicker value={billDate} onChange={(v) => setBillDate(v)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">{t.splitBill.currency}</label>
                  <SearchableSelect
                    value={currency}
                    onValueChange={(v) => setCurrency(normalizeCurrency(v))}
                    options={CURRENCY_CODES.map((code) => ({
                      value: code,
                      label: `${code} — ${SUPPORTED_CURRENCIES[code].name}`,
                    }))}
                    placeholder={t.splitBill.currency}
                  />
                </div>
              </div>
            </div>
          ) : (
            <span className="text-sm font-bold text-[#0F172A] dark:text-[#FAFAFA]">{t.splitBill.items}</span>
          )}

          {/* Items */}
          <div className="flex flex-col gap-3">
            {editingDetails && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">{t.splitBill.items}</span>
                <Button variant="secondary" className="h-8 text-xs shrink-0" onClick={addItem}><Plus className="w-4 h-4 mr-1" />{t.splitBill.addItem}</Button>
              </div>
            )}
            {items.length === 0 ? (
              <p className="text-xs text-[#94A3B8] py-2">{t.splitBill.addItemHint}</p>
            ) : !editingDetails ? (
              <div className="flex flex-col">
                {items.map((it, idx) => {
                  const disc = toNum(it.item_discount);
                  const net = Math.max(0, toNum(it.line_subtotal) - disc);
                  return (
                    <div key={it.key} className="flex items-start justify-between gap-3 py-3 border-b border-[#F1F3F5] dark:border-[#1A1A20]">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{it.name || `${t.splitBill.item} ${idx + 1}`}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[11px] text-[#64748B]">{formatQty(toNum(it.quantity))} × {formatCurrency(toNum(it.unit_price), currency)}</span>
                          {disc > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                              −{formatCurrency(disc, currency)}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-mono font-semibold shrink-0">{formatCurrency(net, currency)}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((it, idx) => (
                  <div key={it.key} className="rounded-lg border border-[#E5E7EB] dark:border-[#27272A] bg-[#F8F9FA] dark:bg-[#1A1A20] p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input value={it.name} onChange={(e) => setItems((prev) => prev.map((x) => x.key === it.key ? { ...x, name: e.target.value } : x))} placeholder={`${t.splitBill.item} ${idx + 1}`} className="flex-1 min-w-0 px-2.5 py-2 rounded-md border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] text-sm font-medium" />
                      <button onClick={() => { setItems((prev) => prev.filter((x) => x.key !== it.key)); setAssignments((prev) => prev.filter((a) => a.item_key !== it.key)); }} className="p-1.5 text-[#94A3B8] hover:text-rose-500 shrink-0" title={t.splitBill.delete}><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-[#64748B]">{t.splitBill.qty}</label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => { const q = Math.max(0, toNum(it.quantity, 0) - 1); setItems((prev) => prev.map((x) => x.key === it.key ? { ...x, quantity: q, line_subtotal: toNum(x.unit_price) * q } : x)); }}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] text-[#64748B] dark:text-[#94A3B8] text-sm hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20]"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={it.quantity ?? ""}
                            onChange={(e) => { const q = toNum(e.target.value, 0); setItems((prev) => prev.map((x) => x.key === it.key ? { ...x, quantity: q, line_subtotal: toNum(x.unit_price) * q } : x)); }}
                            className="h-8 w-full min-w-0 rounded-md border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] text-xs text-center text-[#0F172A] dark:text-[#FAFAFA] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => { const q = toNum(it.quantity, 0) + 1; setItems((prev) => prev.map((x) => x.key === it.key ? { ...x, quantity: q, line_subtotal: toNum(x.unit_price) * q } : x)); }}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] text-[#64748B] dark:text-[#94A3B8] text-sm hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20]"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1"><label className="text-[10px] font-semibold text-[#64748B]">{t.splitBill.price}</label><NumberInput value={String(it.unit_price ?? "")} onValueChange={(v) => { const p = toNum(v, 0); setItems((prev) => prev.map((x) => x.key === it.key ? { ...x, unit_price: p, line_subtotal: p * toNum(x.quantity) } : x)); }} currency={currency} compact className="w-full" /></div>
                      <div className="flex flex-col gap-1"><label className="text-[10px] font-semibold text-[#64748B]">{t.splitBill.subtotal}</label><NumberInput value={String(it.line_subtotal ?? "")} onValueChange={(v) => setItems((prev) => prev.map((x) => x.key === it.key ? { ...x, line_subtotal: toNum(v, 0) } : x))} currency={currency} compact className="w-full" /></div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-[#64748B]">{t.splitBill.perItemDiscount}</label>
                        <div className="flex items-center gap-1">
                          <div className="min-w-17.5">
                            <SearchableSelect
                              value={it.item_discount_mode === "percent" ? "percent" : "fixed"}
                              onValueChange={(v) => setItems((prev) => prev.map((x) => x.key === it.key ? { ...x, item_discount_mode: v === "percent" ? "percent" : "fixed", item_discount: 0 } : x))}
                              options={[{ value: "percent", label: "%" }, { value: "fixed", label: t.splitBill.fixed }]}
                            />
                          </div>
                          {it.item_discount_mode === "percent" ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              value={it.item_discount ?? ""}
                              onChange={(e) => { const raw = toNum(e.target.value, 0); const clamped = Math.max(0, Math.min(raw, 100)); setItems((prev) => prev.map((x) => x.key === it.key ? { ...x, item_discount: clamped } : x)); }}
                              className="h-9 w-full min-w-0 rounded-md border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] px-2.5 text-sm text-right"
                            />
                          ) : (
                            <NumberInput
                              value={String(it.item_discount ?? "")}
                              onValueChange={(v) => { const raw = toNum(v, 0); const line = toNum(it.line_subtotal, 0); const clamped = Math.max(0, Math.min(raw, line)); setItems((prev) => prev.map((x) => x.key === it.key ? { ...x, item_discount: clamped } : x)); }}
                              currency={currency}
                              compact
                              className="w-full"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-[#64748B] font-mono">= {formatCurrency(getItemNetSubtotal({ line_subtotal: toNum(it.line_subtotal), item_discount: toNum(it.item_discount), item_discount_mode: it.item_discount_mode === "percent" ? "percent" : "fixed" }), currency)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subtotal */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#64748B]">{t.splitBill.subtotal}</span>
            <span className="font-mono font-semibold">{formatCurrency(calc.items_subtotal, currency)}</span>
          </div>

          {/* Charges */}
          {editingDetails ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-bold">{t.splitBill.charges}</span>
                  <p className="text-[10px] text-[#94A3B8] mt-0.5">{t.splitBill.chargesHint}</p>
                </div>
                <Button variant="secondary" className="h-8 text-xs shrink-0" onClick={addCharge}><Plus className="w-4 h-4 mr-1" />{t.splitBill.addCharge}</Button>
              </div>
              {charges.length === 0 ? (
                <p className="text-xs text-[#94A3B8]">{language === "id" ? "Tidak ada biaya tambahan." : "No extra charges."}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {charges.map((c) => {
                    const kindOptions = [
                      { value: "tax", label: t.splitBill.tax },
                      { value: "service", label: t.splitBill.service },
                      { value: "discount", label: t.splitBill.discount },
                      { value: "other", label: t.splitBill.other },
                    ];
                    const modeOptions = [
                      { value: "percent", label: "%" },
                      { value: "fixed", label: t.splitBill.fixed },
                    ];
                    return (
                      <div key={c.key} className="rounded-lg border border-[#E5E7EB] dark:border-[#27272A] bg-[#F8F9FA] dark:bg-[#1A1A20] p-3 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <input value={c.name} onChange={(e) => setCharges((prev) => prev.map((x) => x.key === c.key ? { ...x, name: e.target.value } : x))} className="flex-1 min-w-0 px-2.5 py-2 rounded-md border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] text-sm" placeholder={t.splitBill.other} />
                          <button onClick={() => setCharges((prev) => prev.filter((x) => x.key !== c.key))} className="p-1.5 text-[#94A3B8] hover:text-rose-500 shrink-0" title={t.splitBill.delete}><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[140px_88px_1fr] gap-2 items-center">
                          <div className="min-w-0">
                            <SearchableSelect value={c.kind} onValueChange={(v) => setCharges((prev) => prev.map((x) => x.key === c.key ? { ...x, kind: v as LocalCharge["kind"] } : x))} options={kindOptions} showSearch={false} minSearchItems={99} placeholder={t.splitBill.other} />
                          </div>
                          <div className="w-22">
                            <SearchableSelect value={c.amount_mode} onValueChange={(v) => setCharges((prev) => prev.map((x) => x.key === c.key ? { ...x, amount_mode: v as LocalCharge["amount_mode"] } : x))} options={modeOptions} showSearch={false} minSearchItems={99} placeholder="%" />
                          </div>
                          <div className="col-span-2 sm:col-span-1 flex items-center gap-2 min-w-0">
                            <NumberInput value={String(c.amount_value ?? "")} onValueChange={(v) => { const raw = toNum(v, 0); const clamped = c.amount_mode === "percent" ? Math.min(Math.max(raw, 0), 100) : Math.max(raw, 0); setCharges((prev) => prev.map((x) => x.key === c.key ? { ...x, amount_value: clamped } : x)); }} mode={c.amount_mode === "percent" ? "decimal" : "currency"} currency={c.amount_mode === "percent" ? undefined : currency} showCurrency={c.amount_mode !== "percent"} compact className="w-full min-w-0 flex-1" />
                            <span className="text-xs text-[#64748B] w-10 shrink-0 text-right">{c.amount_mode === "percent" ? "%" : currency}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : charges.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {charges.map((c) => {
                const kindLabel = c.kind === "tax" ? t.splitBill.tax : c.kind === "service" ? t.splitBill.service : c.kind === "discount" ? t.splitBill.discount : t.splitBill.other;
                const computed = c.amount_mode === "percent" ? (calc.items_subtotal * toNum(c.amount_value)) / 100 : toNum(c.amount_value);
                return (
                  <div key={c.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[#64748B] truncate">{c.name || kindLabel}{c.amount_mode === "percent" ? ` ${toNum(c.amount_value)}%` : ""}</span>
                    <span className={cn("font-mono", c.kind === "discount" ? "text-rose-600" : "")}>{c.kind === "discount" ? "−" : ""}{formatCurrency(Math.abs(computed), currency)}</span>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Total */}
          <div className="border-t border-[#E5E7EB] dark:border-[#27272A] pt-3">
            {editingDetails ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wide font-semibold text-[#64748B] dark:text-[#94A3B8]">{t.splitBill.billTotalLabel}</label>
                <NumberInput
                  value={String(grandTotal || "")}
                  onValueChange={(v) => {
                    const next = parseFloat(v) || 0;
                    setGrandTotal(next);
                    const computed = Number(calc.computed_grand_total) || 0;
                    setIsGrandTotalManual(Math.abs(next - computed) >= tolerance);
                  }}
                  currency={currency}
                  className="w-full"
                />
                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-[#64748B]">
                  <span>{t.splitBill.billTotalHint}</span>
                  <div className="flex items-center gap-2">
                    {Math.abs((Number(grandTotal) || calc.computed_grand_total) - calc.computed_grand_total) >= tolerance && (
                      <>
                        <span className="text-amber-600">{t.splitBill.computedTotal}: <span className="font-mono font-semibold">{formatCurrency(calc.computed_grand_total, currency)}</span></span>
                        <button type="button" onClick={() => { setIsGrandTotalManual(false); setGrandTotal(Number(calc.computed_grand_total) || 0); }} className="text-[11px] font-semibold text-[#0F172A] dark:text-[#FAFAFA] underline underline-offset-2">Auto</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[10px] uppercase tracking-wide font-semibold text-[#64748B] dark:text-[#94A3B8]">{t.splitBill.billTotalLabel}</p>
                <p className="text-2xl font-bold tracking-tight">{formatCurrency(targetGrand || calc.computed_grand_total, currency)}</p>
                {Math.abs((targetGrand || calc.computed_grand_total) - calc.computed_grand_total) >= tolerance && (
                  <p className="text-[11px] text-amber-600 mt-1">{t.splitBill.computedTotal}: {formatCurrency(calc.computed_grand_total, currency)}</p>
                )}
              </div>
            )}
            {hasTargetMismatch && (
              <div className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg px-2 py-1.5 mt-2">
                {t.splitBill.targetMismatch.replace("{diff}", formatCurrency(computedVsTargetDiff, currency))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Participants */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-sm font-bold">{t.splitBill.participants}</span>
                <p className="text-[10px] text-[#94A3B8] mt-0.5">{language === "id" ? "Tambah peserta atau pilih dari kontak tersimpan." : "Add participants or pick from saved contacts."}</p>
              </div>
              <Button variant="secondary" className="h-8 text-xs" onClick={() => setShowContacts(true)}><BookmarkPlus className="w-4 h-4 mr-1" />{t.splitBill.contacts}</Button>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <input value={newParticipantName} onChange={(e) => setNewParticipantName(e.target.value)} placeholder={t.splitBill.contactName} className="px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-[#27272A] bg-transparent text-sm w-full sm:w-56" onKeyDown={(e) => { if (e.key === "Enter") { addParticipant(newParticipantName); setNewParticipantName(""); } }} />
              <Button variant="secondary" className="h-9 text-xs" onClick={() => { addParticipant(newParticipantName); setNewParticipantName(""); }}><UserPlus className="w-4 h-4 mr-1" />{t.splitBill.addParticipant}</Button>
            </div>

            <div className="flex flex-col gap-1.5 pt-1 border-t border-[#F1F3F5] dark:border-[#1A1A20]">
              <p className="text-[10px] font-bold uppercase text-[#64748B]">{t.splitBill.participants}</p>
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => {
                  return (
                    <div key={p.key} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#27272A] text-xs font-semibold">
                      <div className="relative shrink-0 mr-1.5">
                        <button
                          onClick={() => handleAvatarTap(p.key)}
                          onDoubleClick={() => handleAvatarDoubleClick(p.key)}
                          onTouchStart={() => handleAvatarTouchStart(p.key)}
                          onTouchEnd={handleAvatarTouchEnd}
                          onTouchMove={handleAvatarTouchEnd}
                          onContextMenu={(e) => e.preventDefault()}
                          className="relative rounded-full"
                          title={language === "id" ? "Ketuk: pilih avatar · Tahan: tandai sebagai saya" : "Tap: pick avatar · Long-press: mark as me"}
                          aria-label={t.splitBill.chooseAvatar}
                        >
                          <DiceAvatar
                            name={personLabel(p)}
                            style={p.avatar_style}
                            seed={p.avatar_seed}
                            size="md"
                            className={cn(
                              p.is_me &&
                                "ring-2 ring-[#0F172A] dark:ring-[#FAFAFA] ring-offset-2 ring-offset-white dark:ring-offset-[#121215]",
                            )}
                          />
                          {p.is_me && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#121215] flex items-center justify-center">
                              <Check className="w-2 h-2 text-white stroke-3" />
                            </span>
                          )}
                        </button>
                        {/* Hapus peserta — nempel di kiri atas lingkaran avatar */}
                        <button
                          type="button"
                          onClick={() => removeParticipant(p.key)}
                          className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#374151] text-[#94A3B8] hover:text-rose-500 hover:border-rose-300 dark:hover:border-rose-800 flex items-center justify-center shadow-sm transition-colors"
                          title={language === "id" ? "Hapus peserta" : "Remove participant"}
                          aria-label={language === "id" ? "Hapus peserta" : "Remove participant"}
                        >
                          <X className="w-2 h-2" />
                        </button>
                      </div>
                      <span>{personLabel(p)}</span>
                    </div>
                  );
                })}
                {participants.length === 0 && <p className="text-xs text-[#94A3B8]">{language === "id" ? "Belum ada peserta." : "No participants yet."}</p>}
              </div>
            </div>
 
          </div>
        </div>
      )}

      {/* Step 3: Assign (person-first) */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] p-4 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-sm font-bold">{t.splitBill.stepAssign}</span>
                <p className="text-[10px] text-[#94A3B8] mt-0.5">
                  {language === "id"
                    ? "Pilih orang dulu, lalu tentukan item & qty milik orang tersebut. Lanjut ke orang berikutnya sampai selesai."
                    : "Pick a person first, then assign their items & quantities. Move to the next person until done."}
                </p>
              </div>

              {/* Mode pembagian: proporsional atau bagi rata (kanan atas) */}
              <div className="inline-flex items-center rounded-xl border border-[#E5E7EB] dark:border-[#27272A] overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setSplitMode("proportional")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold transition-colors",
                    splitMode === "proportional"
                      ? "bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A]"
                      : "bg-white dark:bg-[#121215] text-[#64748B] dark:text-[#94A3B8]",
                  )}
                >
                  {t.splitBill.splitProportional}
                </button>
                <button
                  type="button"
                  onClick={requestEqualSplit}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold transition-colors border-l border-[#E5E7EB] dark:border-[#27272A]",
                    splitMode === "equal"
                      ? "bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A]"
                      : "bg-white dark:bg-[#121215] text-[#64748B] dark:text-[#94A3B8]",
                  )}
                >
                  {t.splitBill.splitEvenly}
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-[#94A3B8]">{t.splitBill.addItemHint}</p>
            ) : participants.length === 0 ? (
              <p className="text-xs text-[#94A3B8]">{language === "id" ? "Tambahkan peserta dulu di langkah sebelumnya." : "Add participants in the previous step first."}</p>
            ) : (
              <>
                {/* Person selector */}
                <div className="flex flex-wrap gap-2">
                  {participants.map((p) => {
                    const active = (activeAssigneeKey || participants[0]?.key) === p.key;
                    return (
                      <button
                        key={p.key}
                        onClick={() => setActiveAssigneeKey(p.key)}
                        className={cn(
                          "px-3 py-2 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-2",
                          active
                            ? "bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] border-transparent"
                            : "bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#FAFAFA] border-[#E5E7EB] dark:border-[#27272A] hover:border-[#94A3B8]"
                        )}
                      >
                        <DiceAvatar
                          name={personLabel(p)}
                          style={p.avatar_style}
                          seed={p.avatar_seed}
                          size="sm"
                          className={cn(
                            active
                              ? "ring-2 ring-white/70 dark:ring-black/25"
                              : "ring-2 ring-transparent",
                          )}
                        />
                        <span className="max-w-30 truncate">{personLabel(p)}</span>
                      </button>
                    );
                  })}
                </div>

                {(() => {
                  const activeKey = (activeAssigneeKey && participants.some((p) => p.key === activeAssigneeKey))
                    ? activeAssigneeKey
                    : participants[0].key;
                  const activePerson = participants.find((p) => p.key === activeKey) || participants[0];

                  return (
                    <div className="flex flex-col gap-3">
                      {splitMode === "equal" && (
                        <p className="text-[11px] text-[#94A3B8]">
                          {language === "id"
                            ? "Mode dibagi rata: semua orang bayar sama, item tidak perlu di-assign ke orang tertentu."
                            : "Equal split mode: everyone pays the same, items don't need to be assigned to anyone."}
                        </p>
                      )}
                      <div className="flex flex-col gap-2">
                        {items.map((it, idx) => {
                          const assignedQty = assignedQtyForItem(it.key);
                          const remaining = Math.max(0, toNum(it.quantity) - assignedQty);
                          const mine = getAssignment(it.key, activePerson.key);
                          const canTake = remaining > 0.0001;
                          const ok = Math.abs(remaining) < 0.0001 && toNum(it.quantity) > 0;
                          const isEqualMode = splitMode === "equal";
                          return (
                            <div key={it.key} className="p-3 rounded-lg border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col gap-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold truncate">{it.name || `${t.splitBill.item} ${idx + 1}`}</p>
                                  <p className="text-[10px] text-[#64748B] font-mono">{formatQty(toNum(it.quantity))} × {formatCurrency(toNum(it.unit_price), currency)}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", isEqualMode ? "bg-[#F1F3F5] text-[#64748B] dark:bg-[#1A1A20] dark:text-[#94A3B8]" : ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300")}>
                                    {isEqualMode
                                      ? (language === "id" ? "Dibagi rata" : "Split evenly")
                                      : ok
                                        ? t.splitBill.assigned
                                        : `${t.splitBill.remaining} ${formatQty(remaining)}`}
                                  </span>
                                  {/* Stack avatar pemilik item (tanpa nama) */}
                                  {(() => {
                                    const owners = participants.filter(
                                      (p) => (getAssignment(it.key, p.key) || 0) > 0.0001,
                                    );
                                    if (owners.length === 0) return null;
                                    return (
                                      <div className="flex items-center -space-x-1.5">
                                        {owners.map((p) => (
                                          <span
                                            key={p.key}
                                            className="rounded-full ring-2 ring-white dark:ring-[#121215]"
                                            title={personLabel(p)}
                                          >
                                            <DiceAvatar
                                              name={personLabel(p)}
                                              style={p.avatar_style}
                                              seed={p.avatar_seed}
                                              size="xs"
                                            />
                                          </span>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>

                              {isEqualMode ? null : (
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setAssignment(it.key, activePerson.key, Math.max(0, toNum(mine) - 1))}
                                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] text-[#64748B] dark:text-[#94A3B8] text-sm hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20]"
                                    >
                                      −
                                    </button>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      value={mine ? String(mine) : ""}
                                      placeholder="0"
                                      onChange={(e) => setAssignment(it.key, activePerson.key, toNum(e.target.value, 0))}
                                      className="h-8 w-14 rounded-md border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] text-xs text-center text-[#0F172A] dark:text-[#FAFAFA] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setAssignment(it.key, activePerson.key, toNum(mine) + 1)}
                                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] text-[#64748B] dark:text-[#94A3B8] text-sm hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20]"
                                    >
                                      +
                                    </button>
                                  </div>
                                  {canTake && (
                                    <button
                                      onClick={() => setAssignment(it.key, activePerson.key, toNum(mine) + remaining)}
                                      className="text-[11px] px-2.5 py-1.5 rounded-md border border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20]"
                                    >
                                      + {language === "id" ? "Ambil sisa" : "Take remaining"} ({formatQty(remaining)})
                                    </button>
                                  )}
                                  {mine > 0.0001 && (
                                    <button
                                      onClick={() => setAssignment(it.key, activePerson.key, 0)}
                                      className="text-[11px] px-2.5 py-1.5 rounded-md border border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20] text-[#64748B]"
                                    >
                                      {language === "id" ? "Kosongkan" : "Clear"}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className={cn("text-xs font-semibold p-2.5 rounded-lg", splitMode === "equal" ? "text-[#64748B] bg-[#F1F3F5] dark:bg-[#1A1A20] dark:text-[#94A3B8]" : calc.unassigned_item_ids.length === 0 ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/20" : "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/20")}>
                        {splitMode === "equal"
                          ? (language === "id" ? "Semua orang bayar sama — pembagian item tidak dipakai." : "Everyone pays the same — per-item assignment is not used.")
                          : calc.unassigned_item_ids.length === 0
                            ? (language === "id" ? "Semua item sudah terbagi. Lanjut ke hasil." : "All items assigned. Continue to results.")
                            : (language === "id"
                                ? `${calc.unassigned_item_ids.length} item belum terbagi penuh`
                                : `${calc.unassigned_item_ids.length} item(s) not fully assigned`)}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Summary — ringkasan = hasil */}
      {step === 4 && (
        <div className="flex flex-col gap-4">
          {images.length > 0 && (
            <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] p-4">
              {renderReceiptPhotos()}
            </div>
          )}
          {renderResultView()}
          {renderMyPortionBlock()}
        </div>
      )}
          </div>

          {/* Floating actions saat actions bar di atas tidak terlihat */}
          {!actionsVisible && (
            <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-2">
              {step === 1 && editingDetails && (
                <button
                  type="button"
                  onClick={() => setEditingDetails(false)}
                  className="w-12 h-12 rounded-full shadow-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20]"
                  title={language === "id" ? "Selesai ubah" : "Done"}
                  aria-label={language === "id" ? "Selesai ubah" : "Done"}
                >
                  <Check className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => !isDeletingBill && setShowDeleteConfirm(false)}
        onConfirm={() => void handleDeleteBill()}
        title={t.splitBill.deleteBillTitle}
        message={t.splitBill.deleteBillConfirm}
        confirmText={t.splitBill.delete}
        cancelText={t.common.cancel}
        variant="danger"
        isLoading={isDeletingBill}
      />

      {/* Hapus foto struk (patungan tetap ada) */}
      <ConfirmDialog
        isOpen={!!imageToDelete}
        onClose={() => setImageToDelete(null)}
        onConfirm={() => void confirmDeleteImage()}
        title={language === "id" ? "Hapus foto struk?" : "Delete receipt photo?"}
        message={
          language === "id"
            ? "Patungan & rinciannya tetap tersimpan, hanya gambar struk ini yang dihapus."
            : "The split bill and its details stay saved, only this receipt image is deleted."
        }
        confirmText={language === "id" ? "Hapus" : "Delete"}
        cancelText={t.common.cancel}
        variant="danger"
      />

      {/* Konfirmasi mode Merata (menghapus assignment per-item) */}
      <ConfirmDialog
        isOpen={showEqualConfirm}
        onClose={() => setShowEqualConfirm(false)}
        onConfirm={() => {
          setShowEqualConfirm(false);
          applyEqualSplit();
        }}
        title={language === "id" ? "Beralih ke dibagi rata?" : "Switch to equal split?"}
        message={
          language === "id"
            ? "Semua pembagian item per orang akan dihapus, karena di mode ini semua orang bayar sama. Rincian item per orang tidak lagi dipakai."
            : "All per-item assignments will be cleared, because in this mode everyone pays the same. Per-person item details are no longer used."
        }
        confirmText={language === "id" ? "Ya, bagi rata" : "Yes, split equally"}
        cancelText={t.common.cancel}
        variant="primary"
      />

      {/* Rescan confirm (non-native) */}
      <ConfirmDialog
        isOpen={showRescanConfirm}
        onClose={() => setShowRescanConfirm(false)}
        onConfirm={() => void executeScanAndMergeImages()}
        title={language === "id" ? "Scan ulang?" : "Rescan?"}
        message={
          language === "id"
            ? "Scan ulang akan mengganti hasil & foto sebelumnya dengan foto sesi ini."
            : "Rescanning will replace previous results & photos with this session."
        }
        confirmText={language === "id" ? "Lanjutkan" : "Continue"}
        cancelText={t.common.cancel}
        variant="primary"
      />

      {/* Contacts Manager — mode select: centang dulu, baru tekan "Pilih" */}
      <BottomSheet isOpen={showContacts} onClose={() => setShowContacts(false)} title={t.splitBill.contacts}>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input value={newContactName} onChange={(e) => setNewContactName(e.target.value)} placeholder={t.splitBill.contactName} className="flex-1 px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-[#27272A] bg-transparent text-sm" />
            <Button onClick={() => { saveContact(newContactName); setNewContactName(""); }} className="h-10 text-xs"><UserPlus className="w-4 h-4 mr-1" />{t.splitBill.save}</Button>
          </div>
          <p className="text-[10px] text-[#94A3B8]">
            {language === "id"
              ? "Ketuk nama untuk mencentang. Ketuk lagi untuk membatalkan. Tekan Pilih untuk menambahkan ke patungan."
              : "Tap a name to tick it. Tap again to untick. Press Select to add them to the split."}
          </p>
          {contacts.length === 0 ? (
            <p className="text-sm text-[#64748B]">{t.splitBill.noContacts}</p>
          ) : (
            <>
              {/* List kontak (scroll sendiri supaya modal tidak terlalu tinggi) */}
              <div className="flex flex-col gap-2 max-h-[42vh] overflow-y-auto pr-1 -mr-1">
              {contacts.map((c) => {
                const added = participants.some(
                  (p) =>
                    (p.contact_id && p.contact_id === c.id) ||
                    p.name.trim().toLowerCase() === c.name.trim().toLowerCase(),
                );
                const picked = selectedContactIds.includes(c.id);
                const toggle = () => {
                  if (added) {
                    // Sudah jadi peserta -> ketuk untuk dikeluarkan dari patungan
                    const target = participants.find(
                      (p) =>
                        (p.contact_id && p.contact_id === c.id) ||
                        p.name.trim().toLowerCase() === c.name.trim().toLowerCase(),
                    );
                    if (!target) return;
                    removeParticipant(target.key);
                    toast.success(
                      language === "id"
                        ? `${c.name} dikeluarkan dari peserta`
                        : `${c.name} removed from participants`,
                    );
                    return;
                  }
                  setSelectedContactIds((prev) =>
                    prev.includes(c.id)
                      ? prev.filter((id) => id !== c.id)
                      : [...prev, c.id],
                  );
                };
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border transition-colors",
                      added
                        ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20"
                        : picked
                          ? "border-[#0F172A] dark:border-[#FAFAFA] bg-[#F1F3F5] dark:bg-[#1A1A20]"
                          : "border-[#E5E7EB] dark:border-[#27272A]",
                    )}
                  >
                    <button
                      onClick={() => setAvatarPickerFor({ kind: "contact", id: c.id })}
                      className="shrink-0 rounded-full"
                      title={t.splitBill.chooseAvatar}
                      aria-label={t.splitBill.chooseAvatar}
                    >
                      <DiceAvatar name={c.name} style={c.avatar_style} seed={c.avatar_seed} size="md" />
                    </button>
                    <button
                      className={cn(
                        "text-sm font-medium text-left flex-1 min-w-0 truncate py-1",
                        added ? "text-[#64748B] dark:text-[#94A3B8]" : "text-[#0F172A] dark:text-[#FAFAFA]",
                      )}
                      onClick={toggle}
                    >
                      {c.name}
                    </button>
                    {added ? (
                      <button
                        type="button"
                        onClick={toggle}
                        className="shrink-0 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors"
                        title={language === "id" ? "Sudah jadi peserta — ketuk untuk membatalkan" : "Already a participant — tap to unselect"}
                        aria-label={language === "id" ? "Batalkan" : "Unselect"}
                      >
                        <Check className="w-3.5 h-3.5 stroke-3" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={toggle}
                        className={cn(
                          "shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                          picked
                            ? "bg-[#0F172A] dark:bg-[#FAFAFA] border-transparent text-white dark:text-[#0F172A]"
                            : "border-[#CBD5E1] dark:border-[#334155] hover:border-[#94A3B8]",
                        )}
                        title={picked ? (language === "id" ? "Batalkan pilihan" : "Unselect") : (language === "id" ? "Pilih" : "Select")}
                        aria-label={picked ? (language === "id" ? "Batalkan pilihan" : "Unselect") : (language === "id" ? "Pilih" : "Select")}
                      >
                        {picked && <Check className="w-3.5 h-3.5 stroke-3" />}
                      </button>
                    )}
                    <button onClick={() => removeContact(c.id)} className="shrink-0 p-1.5 text-[#94A3B8] hover:text-rose-500" aria-label={t.splitBill.delete}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                for (const id of selectedContactIds) {
                  const c = contacts.find((x) => x.id === id);
                  if (!c) continue;
                  const already = participants.some(
                    (p) =>
                      (p.contact_id && p.contact_id === c.id) ||
                      p.name.trim().toLowerCase() === c.name.trim().toLowerCase(),
                  );
                  if (already) continue;
                  addParticipant(c.name, c.id, {
                    style: c.avatar_style ?? null,
                    seed: c.avatar_seed ?? null,
                  });
                }
                setSelectedContactIds([]);
                setShowContacts(false);
              }}
              disabled={selectedContactIds.length === 0}
              className="h-11 flex-1"
            >
              {language === "id" ? "Pilih" : "Select"}
              {selectedContactIds.length > 0 && ` (${selectedContactIds.length})`}
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Record My Portion */}
      <BottomSheet isOpen={showRecord} onClose={() => setShowRecord(false)} title={t.splitBill.recordMyPortion}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-[#64748B]">{t.splitBill.selectAccount}</label>
            <SearchableSelect value={recordState.accountId} onValueChange={(v) => setRecordState((s) => ({ ...s, accountId: v }))} options={accounts.map((a) => ({ value: a.id, label: a.name, icon: a.icon || "Wallet", badge: `(${a.currency})`, disabled: (a.currency || "").toUpperCase() !== currency.toUpperCase() }))} placeholder={t.splitBill.selectAccount} searchPlaceholder={t.splitBill.searchAccount} emptyText={t.splitBill.noMatchingAccount} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-[#64748B]">{t.splitBill.selectCategory}</label>
            <SearchableSelect value={recordState.categoryId} onValueChange={(v) => setRecordState((s) => ({ ...s, categoryId: v }))} options={categories.map((c) => ({ value: c.id, label: c.name, icon: c.icon || "Tag" }))} placeholder={t.splitBill.selectCategory} searchPlaceholder={t.splitBill.searchCategory} emptyText={t.splitBill.noCategory} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-[#64748B]">{(t.transactions as { date?: string } | undefined)?.date || (language === "id" ? "Tanggal" : "Date")}</label>
            <DatePicker value={recordState.date} onChange={(v) => setRecordState((s) => ({ ...s, date: v }))} />
          </div>
          <div className="p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] mb-1">{(t.splitBill as { note?: string; notes?: string }).note || t.splitBill.notes || (language === "id" ? "Catatan" : "Note")}</p>
            <p className="text-sm font-medium text-[#0F172A] dark:text-[#FAFAFA]">{`${language === "id" ? "Patungan" : "Split Bill"} - ${title || (language === "id" ? "Patungan" : "Split Bill")}`}</p>
          </div>
          {(myPersonCalc && (myPersonCalc.item_lines.length > 0 || Math.abs(Number(myPersonCalc.charges_breakdown?.discount) || 0) > 0.0001)) && (
            <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                  {t.quickAdd?.itemizedBreakdownTitle || "Rincian Item"}
                </span>
              </div>
              <div className="flex flex-col">
                {myPersonCalc.item_lines.filter((l) => {
                  const it = items.find((i) => i.key === l.item_id);
                  return (l.name || it?.name || "").trim() && Number(it ? toNum(it.unit_price, 0) : 0) > 0;
                }).map((l, idx) => {
                  const it = items.find((i) => i.key === l.item_id);
                  const unitPrice = it ? toNum(it.unit_price, 0) : 0;
                  const itemDiscount = Number(l.discount_amount) || 0;
                  return (
                    <div key={`${l.item_id}-${idx}`} className="flex flex-col gap-1 py-2 border-b border-[#E5E7EB] dark:border-[#27272A] last:border-b-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex-1 min-w-0 text-sm font-medium text-[#0F172A] dark:text-[#FAFAFA] truncate">{l.name || it?.name || `Item ${idx + 1}`}</span>
                        <span className="text-sm font-mono font-semibold text-[#0F172A] dark:text-[#FAFAFA] shrink-0">
                          {formatCurrency(Number(l.amount) || 0, currency)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                        <span>{String(l.share_quantity)} × {formatCurrency(unitPrice, currency)}</span>
                        {itemDiscount > 0.0001 && (
                          <span className="text-rose-600 dark:text-rose-400">
                            {language === "id" ? "Diskon item" : "Item discount"}: -{formatCurrency(itemDiscount, currency)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {Math.abs(Number(myPersonCalc.charges_breakdown?.discount) || 0) > 0.0001 && (
                  <div className="flex items-center justify-between gap-2 py-2 border-b border-[#E5E7EB] dark:border-[#27272A] last:border-b-0">
                    <span className="flex-1 min-w-0 text-sm font-medium text-[#0F172A] dark:text-[#FAFAFA] truncate">
                      {language === "id" ? "Diskon" : "Discount"}
                    </span>
                    <span className="text-sm font-mono font-semibold text-rose-600 dark:text-rose-400 shrink-0">
                      -{formatCurrency(Math.abs(Number(myPersonCalc.charges_breakdown?.discount) || 0), currency)}
                    </span>
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#64748B] dark:text-[#94A3B8]">{t.quickAdd?.itemizedTotal || "Total"}</span>
                <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA]">
                  {formatCurrency(myTotal, currency)}
                </span>
              </div>
            </div>
          )}
          <Button onClick={doRecord} disabled={isRecording} className="w-full h-11">
            {isRecording ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Receipt className="w-4 h-4 mr-2" />}
            {t.splitBill.recordMyPortion}
          </Button>
        </div>
      </BottomSheet>

      <AvatarPicker
        isOpen={!!avatarPickerFor}
        onClose={() => setAvatarPickerFor(null)}
        value={
          avatarPickerFor?.kind === "participant"
            ? (() => {
                const p = participants.find((x) => x.key === avatarPickerFor.key);
                return { style: p?.avatar_style ?? null, seed: p?.avatar_seed ?? null };
              })()
            : avatarPickerFor?.kind === "contact"
              ? (() => {
                  const c = contacts.find((x) => x.id === avatarPickerFor.id);
                  return { style: c?.avatar_style ?? null, seed: c?.avatar_seed ?? null };
                })()
              : null
        }
        onSelect={(ref) => void applyAvatar(ref)}
      />

      {renderScanSheet()}
    </div>
  );
}

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDim = 1600;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        const s = maxDim / Math.max(w, h);
        w = Math.round(w * s);
        h = Math.round(h * s);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("no canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("compress failed"))), "image/jpeg", 0.72);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("read failed"));
    };
  });
}

function buildMyPortionDescription(title: string, _items?: LocalItem[], _assignments?: LocalAssignment[], _myKey?: string, language: "id" | "en" = "id"): string {
  const prefix = language === "id" ? "Patungan" : "Split Bill";
  return `${prefix} - ${title || (language === "id" ? "Patungan" : "Split Bill")}`.slice(0, 2000);
}

function buildInitialMyPortionDescription(bill: SplitBillFull, _myId?: string, language: "id" | "en" = "id"): string {
  const prefix = language === "id" ? "Patungan" : "Split Bill";
  return `${prefix} - ${bill.title || (language === "id" ? "Patungan" : "Split Bill")}`.slice(0, 2000);
}

/**
 * Signature dari seluruh data yang disimpan ke DB.
 * Dipakai untuk mendeteksi perubahan (autosave) tanpa membandingkan object.
 */
function payloadSignature(p: {
  id?: string;
  title: string;
  bill_date: string;
  currency: string;
  subtotal_amount: number;
  grand_total_amount: number;
  participants: Array<{
    id?: string;
    name: string;
    is_me?: boolean;
    avatar_style?: string | null;
    avatar_seed?: string | null;
  }>;
  items: Array<{
    id?: string;
    name: string;
    quantity: number;
    unit_price: number;
    line_subtotal: number;
    item_discount?: number;
    item_discount_mode?: "percent" | "fixed";
  }>;
  charges: Array<{
    id?: string;
    name: string;
    kind: string;
    amount_mode: string;
    amount_value: number;
  }>;
  assignments: Array<{ item_key: string; participant_key: string; share_quantity: number }>;
}): string {
  return JSON.stringify({
    t: p.title,
    d: p.bill_date,
    c: p.currency,
    s: p.subtotal_amount,
    g: p.grand_total_amount,
    p: p.participants.map((x) => [
      x.id,
      x.name,
      !!x.is_me,
      x.avatar_style ?? "",
      x.avatar_seed ?? "",
    ]),
    i: p.items.map((x) => [
      x.id,
      x.name,
      x.quantity,
      x.unit_price,
      x.line_subtotal,
      x.item_discount ?? 0,
      x.item_discount_mode ?? "fixed",
    ]),
    ch: p.charges.map((x) => [
      x.id,
      x.name,
      x.kind,
      x.amount_mode,
      x.amount_value,
    ]),
    a: p.assignments.map((x) => [
      x.item_key,
      x.participant_key,
      x.share_quantity,
    ]),
  });
}
