"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ReceiptScanOverlay } from "@/components/ui/receipt-scan-overlay";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Account, Category, TransactionType } from "@/types/database";
import { formatCurrency } from "@/lib/utils/currency";
import { SUPPORTED_CURRENCIES } from "@/lib/constants/currencies";
import {
  getItemMyTotal,
  getItemTotal as getSharedItemTotal,
  formatItemsSummary,
} from "@/lib/utils/transaction-items";
import { formatCategoryName } from "@/lib/utils/category-i18n";
import { createTransaction } from "@/actions/transactions";
import { CameraLiveView } from "@/components/ui/camera-live-view";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  getPinnedTemplates,
  savePinnedTemplate,
  PinnedTemplate,
} from "@/lib/storage/pinned-templates";

import {
  Check,
  Delete,
  ArrowDownRight,
  ArrowUpRight,
  Pin,
  Star,
  Plus,
  Trash2,
  ListPlus,
  AlignLeft,
  Hash,
  X,
  AlertCircle,
  Camera,
  Loader2,
  Calculator,
  ScanLine,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import { scanReceiptGemini } from "@/lib/ocr/receipt-gemini-client";
import { friendlyScanError } from "@/lib/ocr/scan-error";
import { localDateToISO, getLocalDateString } from "@/lib/utils/date";
interface QuickAddSheetProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  onSuccess?: () => void;
  /**
   * Map "{accountId}_{type}" -> categoryId yang paling sering dipakai
   * di kombinasi akun+tipe tersebut. Di-fetch sekali di parent/page,
   * dipakai untuk auto-suggest default kategori di form ini.
   */
  mostUsedCategoryByAccount?: Record<string, string>;
}

interface ItemRow {
  name: string;
  quantity: string;
  price: string;
  /**
   * Printed line total from OCR (already rounded by POS).
   * If present, it wins over quantity * price so weighed items
   * (e.g. 0.414 x 24.900 = 10.308,6 on paper 10.309) match the receipt.
   * Cleared whenever user edits quantity / price.
   */
  subtotal?: string;
  /** Number of people sharing this line item (patungan). */
  shareCount?: string;
  /** User's own portion (manual/rounded override). */
  mySubtotal?: string;
}

interface QuickAddSheetContentProps {
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSuccess?: () => void;
  mostUsedCategoryByAccount?: Record<string, string>;
}

export function QuickAddSheet({
  isOpen,
  onClose,
  accounts,
  categories,
  onSuccess,
  mostUsedCategoryByAccount,
}: QuickAddSheetProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t.quickAdd.title}>
      <QuickAddSheetContent
        accounts={accounts}
        categories={categories}
        onClose={onClose}
        onSuccess={onSuccess}
        mostUsedCategoryByAccount={mostUsedCategoryByAccount}
      />
    </BottomSheet>
  );
}

function QuickAddSheetContent({
  onClose,
  accounts,
  categories,
  onSuccess,
  mostUsedCategoryByAccount = {},
}: QuickAddSheetContentProps) {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [type, setType] = useState<TransactionType>("expense");
  const [amountStr, setAmountStr] = useState<string>("0");
  const [isNumpadOpen, setIsNumpadOpen] = useState(false);
  const [isAmountShaking, setIsAmountShaking] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [txDate, setTxDate] = useState<string>(getLocalDateString());
  const [isPinned, setIsPinned] = useState<boolean>(false);

  // Sub-items breakdown
  const [items, setItems] = useState<ItemRow[]>([]);
  const [showItemsBreakdown, setShowItemsBreakdown] = useState<boolean>(false);

  // Free text memo
  const [freeTextMemo, setFreeTextMemo] = useState<string>("");
  const [showFreeMemo, setShowFreeMemo] = useState<boolean>(false);

  // Tags (#tags)
  const [tags, setTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState<boolean>(false);
  const [tagInput, setTagInput] = useState<string>("");

  // OCR Scan State
  const [isScanning, setIsScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [scanPhase, setScanPhase] = useState<
    "preview" | "scanning" | "success" | "error" | null
  >(null);
  const [scanErrorMsg, setScanErrorMsg] = useState<string>("");
  const [isScanFullOpen, setIsScanFullOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);
  const [highlightScan, setHighlightScan] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const scanPreviewUrlRef = React.useRef<string | null>(null);
  const lastScanFileRef = React.useRef<File | null>(null);
  const scanHideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearScanPreview = React.useCallback(() => {
    if (scanHideTimerRef.current) {
      clearTimeout(scanHideTimerRef.current);
      scanHideTimerRef.current = null;
    }
    if (scanPreviewUrlRef.current) {
      URL.revokeObjectURL(scanPreviewUrlRef.current);
      scanPreviewUrlRef.current = null;
    }
    setScanPreviewUrl(null);
    setScanPhase(null);
    setScanErrorMsg("");
  }, []);

  React.useEffect(() => {
    return () => {
      if (scanHideTimerRef.current) clearTimeout(scanHideTimerRef.current);
      if (scanPreviewUrlRef.current) {
        URL.revokeObjectURL(scanPreviewUrlRef.current);
      }
    };
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinnedTemplates] = useState<PinnedTemplate[]>(getPinnedTemplates);

  // Receipt OCR File Handler
  // Step 1: keep the photo & show a preview first, so the user can retake
  // before we spend a scan request.
  const prepareScanPreview = (file: File) => {
    if (!file) return;

    lastScanFileRef.current = file;
    if (scanHideTimerRef.current) {
      clearTimeout(scanHideTimerRef.current);
      scanHideTimerRef.current = null;
    }
    if (scanPreviewUrlRef.current) {
      URL.revokeObjectURL(scanPreviewUrlRef.current);
      scanPreviewUrlRef.current = null;
    }
    const previewUrl = URL.createObjectURL(file);
    scanPreviewUrlRef.current = previewUrl;
    setScanPreviewUrl(previewUrl);
    setScanErrorMsg("");
    setOcrProgress(0);
    setScanPhase("preview");
  };

  // Step 2: scan the confirmed photo.
  const runReceiptScan = async () => {
    const file = lastScanFileRef.current;
    if (!file) return;

    setScanPhase("scanning");
    setIsScanning(true);
    setOcrProgress(6);

    // Progress naik cepat di awal (biar terasa responsif), lalu mendekati 90%
    // secara asymptotic sambil menunggu AI sungguhan. Hasil baru masuk => 100%.
    const progressTimer = setInterval(() => {
      setOcrProgress((prev) => Math.min(90, prev + (90 - prev) * 0.14));
    }, 260);

    try {
      const parsed = await scanReceiptGemini(file, currentCurrency);
      clearInterval(progressTimer);
      setOcrProgress(100);

      const filledSomething =
        parsed.amount > 0 ||
        !!parsed.description ||
        !!parsed.date ||
        (parsed.items && parsed.items.length > 0);

      if (parsed.amount > 0) {
        setAmountStr(String(parsed.amount));
      }
      if (parsed.description) {
        setDescription(parsed.description);
      }
      if (parsed.date) {
        setTxDate(parsed.date);
      }
      if (parsed.items && parsed.items.length > 0) {
        setItems(parsed.items);
        setShowItemsBreakdown(true);
      }

      if (filledSomething) {
        setHighlightScan(true);
        setTimeout(() => setHighlightScan(false), 2200);
      }

      setScanPhase("success");
      toast.success(t.quickAdd.scanSuccess);
      // Auto-close scan view and return to form (no separate success screen)
      setIsScanFullOpen(false);
      clearScanPreview();
    } catch (err: unknown) {
      clearInterval(progressTimer);
      console.error(
        "[quick-add] OCR Error:",
        String((err as Error)?.message || "").slice(0, 300),
      );
      // Pesan teknis (Gemini/Postgres) diterjemahkan jadi kalimat ramah user.
      setScanPhase("error");
      setScanErrorMsg(friendlyScanError(err, language));
      setOcrProgress(0);
    } finally {
      clearInterval(progressTimer);
      setIsScanning(false);
    }
  };

  const handleReceiptUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (file) prepareScanPreview(file);
  };

  // Resolve default category for a given account + type: prefer the
  // most-used category for that combo (if it still exists in `categories`),
  // otherwise fall back to the first category matching the type.
  const resolveDefaultCategory = React.useCallback(
    (accountId: string, txType: TransactionType): string | undefined => {
      const matchingCats = categories.filter((c) => c.type === txType);
      const suggestedId = mostUsedCategoryByAccount[`${accountId}_${txType}`];
      const suggestedStillValid =
        suggestedId && matchingCats.some((c) => c.id === suggestedId);

      if (suggestedStillValid) return suggestedId;
      return matchingCats[0]?.id;
    },
    [categories, mostUsedCategoryByAccount],
  );

  // Initialize defaults
  React.useEffect(() => {
    const primary = accounts.find((a) => a.is_default) || accounts[0];
    if (!primary) return;

    const defaultCategoryId = resolveDefaultCategory(primary.id, "expense");
    // Deferred so the state updates don't cascade synchronously inside the
    // effect body.
    queueMicrotask(() => {
      setSelectedAccountId(primary.id);
      if (defaultCategoryId) setSelectedCategoryId(defaultCategoryId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, categories]);

  const activeAccount =
    accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  const activeCategory =
    categories.find((c) => c.id === selectedCategoryId) || categories[0];
  const currentCurrency = activeAccount?.currency || "IDR";

  const filteredCategories = categories.filter((c) => c.type === type);

  // Line total for one row: prefer the printed subtotal copied from the
  // receipt (already rounded by POS), otherwise fall back to qty * price
  // rounded to the currency's decimals.
  const getItemTotal = (item: ItemRow): number =>
    getSharedItemTotal(item, currentCurrency);

  // Sub-items calculation
  const itemsTotal = items.reduce((sum, item) => sum + getItemTotal(item), 0);
  // Personal portion total (handles patungan/share + manual override/rounding)
  const myPortionTotal = items.reduce(
    (sum, item) => sum + getItemMyTotal(item, currentCurrency),
    0,
  );

  // Numeric amount is strictly driven by the main amountStr input/keypad
  const numericAmount = parseFloat(amountStr) || 0;
  const remainingAmount = numericAmount - myPortionTotal;
  const isItemsExceeding =
    showItemsBreakdown &&
    items.length > 0 &&
    myPortionTotal > numericAmount &&
    numericAmount > 0;
  const isItemsMatching =
    showItemsBreakdown &&
    items.length > 0 &&
    myPortionTotal === numericAmount &&
    numericAmount > 0;
  const hasRemainingUnitemized =
    showItemsBreakdown &&
    items.length > 0 &&
    remainingAmount > 0 &&
    numericAmount > 0;

  // Lightweight haptic tap for keypad presses (Android Chrome/Firefox only;
  // iOS Safari silently ignores navigator.vibrate, so this is purely additive
  // on top of the existing active:scale-95 visual feedback)
  const triggerHaptic = (durationMs: number = 15) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(durationMs);
      } catch {
        // Ignore - vibration is a non-critical enhancement
      }
    }
  };

  // Brief shake/flash on the amount card when the input is at its cap,
  // so hitting the limit gives visible feedback instead of doing nothing
  const triggerAmountLimitFeedback = () => {
    setIsAmountShaking(true);
    triggerHaptic(20);
    setTimeout(() => setIsAmountShaking(false), 300);
  };

  // Quick Calculator Keypad (Always enabled so user can type main amount freely)
  const handleKeypadPress = (val: string) => {
    setError(null);
    const usesMinorUnits =
      currentCurrency === "USD" || currentCurrency === "SGD";
    if (usesMinorUnits && /^\d+$/.test(val)) {
      const digits =
        `${amountStr.replace(/\D/g, "")}${val}`.replace(/^0+/, "") || "0";
      const nextAmount =
        digits.length <= 2
          ? `0.${digits.padStart(2, "0")}`
          : `${digits.slice(0, -2)}.${digits.slice(-2)}`;
      triggerHaptic();
      setAmountStr(nextAmount);
      return;
    }

    if (amountStr === "0") {
      if (val === "000") return;
      triggerHaptic();
      setAmountStr(val);
    } else {
      if (amountStr.length >= 12) {
        triggerAmountLimitFeedback();
        return;
      }
      triggerHaptic();
      setAmountStr((prev) => prev + val);
    }
  };

  const handleKeypadBackspace = () => {
    setError(null);
    triggerHaptic();
    if (currentCurrency === "USD" || currentCurrency === "SGD") {
      const digits = amountStr.replace(/\D/g, "").slice(0, -1) || "0";
      setAmountStr(
        digits.length <= 2
          ? `0.${digits.padStart(2, "0")}`
          : `${digits.slice(0, -2)}.${digits.slice(-2)}`,
      );
      return;
    }
    if (amountStr.length <= 1) {
      setAmountStr("0");
    } else {
      setAmountStr((prev) => prev.slice(0, -1));
    }
  };

  // Type change
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    const defaultCategoryId = resolveDefaultCategory(
      selectedAccountId,
      newType,
    );
    if (defaultCategoryId) {
      setSelectedCategoryId(defaultCategoryId);
    }
  };

  // Sub-items CRUD
  const handleAddItem = () => {
    setItems((prev) => [...prev, { name: "", quantity: "1", price: "" }]);
  };

  const handleUpdateItem = (
    index: number,
    field: keyof ItemRow,
    value: string,
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      const current = { ...updated[index] };

      if (field === "shareCount") {
        const shares = parseFloat(value);
        const full = getItemTotal(current);
        if (!isNaN(shares) && shares >= 2 && full > 0) {
          const code = currentCurrency.toUpperCase() as keyof typeof SUPPORTED_CURRENCIES;
          const decimals = SUPPORTED_CURRENCIES[code]?.decimals ?? 0;
          const factor = 10 ** decimals;
          current.mySubtotal = String(Math.ceil((full / shares) * factor) / factor);
        } else if (value.trim() === "" || shares < 2) {
          current.mySubtotal = undefined;
        }
      }
      if (field === "mySubtotal" && value.trim() === "") {
        current.mySubtotal = undefined;
      }

      // Once the user edits qty/price, the OCR-copied printed subtotal
      // is stale — drop it so the total falls back to qty * price.
      // Clearing the subtotal field itself also reverts to qty * price.
      const clearSubtotal =
        field === "quantity" ||
        field === "price" ||
        (field === "subtotal" && value === "");
      updated[index] = {
        ...current,
        [field]: value,
        ...(clearSubtotal ? { subtotal: undefined } : {}),
      };
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApplyTemplate = (tpl: PinnedTemplate) => {
    setType(tpl.type);
    setSelectedAccountId(tpl.accountId);
    setSelectedCategoryId(tpl.categoryId);
    setAmountStr(String(tpl.amount));
    setDescription(tpl.description || tpl.name);
    setTxDate(getLocalDateString());
    setIsPinned(true);
  };

  // Save Transaction
  const handleSave = async () => {
    if (numericAmount <= 0) {
      setError(t.quickAdd.nominal + " > 0");
      return;
    }

    if (!selectedAccountId) {
      setError(t.quickAdd.selectAccount);
      return;
    }

    if (!selectedCategoryId) {
      setError(t.quickAdd.selectCategory);
      return;
    }

    if (
      showItemsBreakdown &&
      items.length > 0 &&
      myPortionTotal > numericAmount &&
      numericAmount > 0
    ) {
      setError(
        `${t.quickAdd.itemsExceedWarning} ${formatCurrency(myPortionTotal - numericAmount, currentCurrency)}`,
      );
      return;
    }

    // Strict Non-Negative Balance Guard for Expense
    if (type === "expense" && activeAccount) {
      const currentBal = Number(activeAccount.current_balance) || 0;
      if (currentBal - numericAmount < 0) {
        const err = t.transactions.insufficientBalanceDesc
          .replace("{account}", activeAccount.name)
          .replace(
            "{available}",
            formatCurrency(currentBal, activeAccount.currency),
          )
          .replace(
            "{needed}",
            formatCurrency(numericAmount, activeAccount.currency),
          );
        setError(err);
        toast.error(t.transactions.insufficientBalance, {
          description: err,
        });
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    // Build compound description if items or memo exist (capped to validation limit)
    const defaultTypeLabel =
      type === "expense" ? t.quickAdd.expense : t.quickAdd.income;
    const baseDesc = (
      description.trim() ||
      activeCategory?.name ||
      defaultTypeLabel
    ).slice(0, 120);
    const memoPart =
      showFreeMemo && freeTextMemo.trim()
        ? ` [Memo: ${freeTextMemo.trim().slice(0, 200)}]`
        : "";

    const validItems = items.filter(
      (i) => i.name.trim() && parseFloat(i.price) > 0,
    );
    let itemsPart = "";
    if (showItemsBreakdown && items.length > 0) {
      const maxDescLen = 2000;
      const overhead = baseDesc.length + memoPart.length + " [Items: ]".length;
      const available = Math.max(0, maxDescLen - overhead);

      if (validItems.length > 0 && available > 0) {
        const parts: string[] = [];
        let used = 0;
        let included = 0;
        for (const item of validItems) {
          const part = formatItemsSummary([item], currentCurrency);
          if (!part) continue;
          const sep = parts.length ? 2 : 0; // ", "
          if (used + sep + part.length <= available) {
            parts.push(part);
            used += sep + part.length;
            included++;
          } else {
            break;
          }
        }
        if (included > 0) {
          let summary = parts.join(", ");
          const remaining = validItems.length - included;
          if (remaining > 0) {
            const suffix = `, … (+${remaining})`;
            if (summary.length + suffix.length <= available) {
              summary += suffix;
            } else {
              const keep = Math.max(0, available - suffix.length - 1);
              summary = summary.slice(0, keep).trimEnd() + suffix;
            }
          }
          itemsPart = ` [Items: ${summary}]`;
        }
      }
    }

    let finalDesc = `${baseDesc}${itemsPart}${memoPart}`;
    if (finalDesc.length > 2000) {
      finalDesc = finalDesc.slice(0, 2000);
    }

    try {
      const finalTags = [...tags];
      if (tagInput.trim()) {
        const clean = tagInput.replace(/^#/, "").toLowerCase().trim();
        if (clean && !finalTags.includes(clean)) {
          finalTags.push(clean);
        }
      }

      const res = await createTransaction({
        accountId: selectedAccountId,
        categoryId: selectedCategoryId,
        type,
        amount: numericAmount,
        currency: currentCurrency,
        description: finalDesc,
        tags: finalTags.length > 0 ? finalTags : undefined,
        // Rincian item disimpan juga di kolom JSONB `transactions.items`
        items:
          showItemsBreakdown && validItems.length > 0
            ? validItems.map((it) => ({
                name: it.name,
                quantity: it.quantity || "1",
                price: it.price || "",
                ...(it.subtotal ? { subtotal: it.subtotal } : {}),
                ...(it.shareCount ? { shareCount: it.shareCount } : {}),
                ...(it.mySubtotal ? { mySubtotal: it.mySubtotal } : {}),
              }))
            : undefined,
        transactionDate: localDateToISO(txDate),
      });

      if (res.error) {
        setError(res.error);
        toast.error(t.transactions.createFailed, {
          description: res.error,
        });
      } else {
        toast.success(t.quickAdd.recordSuccess);
        // Save as pinned template if toggle is active
        if (isPinned) {
          const name =
            description.trim() || activeCategory?.name || "Quick Template";
          await savePinnedTemplate({
            name,
            accountId: selectedAccountId,
            accountName: activeAccount?.name,
            categoryId: selectedCategoryId,
            categoryName: activeCategory?.name,
            categoryIcon: activeCategory?.icon,
            type,
            amount: numericAmount,
            currency: currentCurrency,
            description: description.trim() || null,
          });
        }

        onSuccess?.();
        router.refresh();
        onClose();
      }
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error("Terjadi Kesalahan", { description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-2">
      <style jsx global>{`
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          20%,
          60% {
            transform: translateX(-4px);
          }
          40%,
          80% {
            transform: translateX(4px);
          }
        }
      `}</style>
      {/* Pinned Templates Shortcuts (hidden while numpad is open to free up vertical space) */}
      {pinnedTemplates.length > 0 && !isNumpadOpen && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar scroll-smooth">
          <Star className="w-3.5 h-3.5 text-warning shrink-0" />
          {pinnedTemplates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleApplyTemplate(tpl)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-secondary text-foreground border border-border shrink-0 cursor-pointer active:scale-95 transition-all"
            >
              <span className="whitespace-nowrap font-medium">{tpl.name}</span>
              <span className="font-mono font-bold text-[11px] tnum opacity-90">
                {formatCurrency(tpl.amount, tpl.currency)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 1. Header: Segmented Type Switcher (compacts while numpad is open) */}
      <div
        className={cn(
          "grid grid-cols-2 p-0.5 bg-muted rounded-lg border border-border transition-all",
          isNumpadOpen && "scale-[0.97] opacity-90",
        )}
      >
        <button
          type="button"
          onClick={() => handleTypeChange("expense")}
          className={cn(
            "flex items-center justify-center gap-1.5 text-xs font-bold rounded-md transition-all cursor-pointer",
            isNumpadOpen ? "py-1" : "py-1.5",
            type === "expense"
              ? "bg-destructive text-destructive-foreground shadow-2xs"
              : "text-foreground-secondary hover:text-foreground",
          )}
        >
          <ArrowDownRight className="w-3.5 h-3.5" />
          <span>{t.quickAdd.expense}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange("income")}
          className={cn(
            "flex items-center justify-center gap-1.5 text-xs font-bold rounded-md transition-all cursor-pointer",
            isNumpadOpen ? "py-1" : "py-1.5",
            type === "income"
              ? "bg-success text-success-foreground shadow-2xs"
              : "text-foreground-secondary hover:text-foreground",
          )}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>{t.quickAdd.income}</span>
        </button>
      </div>

      {/* 2. Interactive Amount Card (Click to Open Numpad) */}
      <div className="relative">
        <div
          className={cn(
            "relative rounded-xl bg-surface border shadow-2xs overflow-hidden transition-all group",
            isAmountShaking
              ? "border-destructive ring-2 ring-destructive/20 animate-[shake_0.3s_ease-in-out]"
              : highlightScan
                ? "border-info/70 ring-2 ring-info/30"
                : isNumpadOpen
                  ? "border-border-strong ring-2 ring-ring/10"
                  : "border-border",
          )}
        >
          <div
            onClick={() => setIsNumpadOpen(!isNumpadOpen)}
            className={cn(
              "w-full flex flex-col text-left cursor-pointer hover:bg-surface-subtle transition-all",
              isNumpadOpen ? "p-4 gap-1.5" : "p-3 gap-1",
            )}
          >
            <div className="flex items-center justify-between pr-8">
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary">
                {t.quickAdd.nominal}
              </span>

              <Calculator
                className={cn(
                  "w-4 h-4 transition-colors",
                  isNumpadOpen
                    ? "text-foreground"
                    : "text-foreground-muted group-hover:text-info",
                )}
              />
            </div>

            {isNumpadOpen && (
              <div
                className="overflow-x-auto whitespace-nowrap text-right text-xs font-mono font-semibold tracking-wide text-foreground-secondary no-scrollbar"
                aria-label={`Input nominal: ${amountStr}`}
              >
                {amountStr}
              </div>
            )}

            <div
              className={cn(
                "flex items-baseline gap-2",
                isNumpadOpen ? "pt-1" : "pt-0.5",
              )}
            >
              <span
                className={cn(
                  "font-bold text-foreground",
                  isNumpadOpen ? "text-2xl" : "text-xl",
                )}
              >
                {currentCurrency}
              </span>
              <span
                className={cn(
                  "flex-1 min-w-0 font-mono font-bold tracking-tight truncate",
                  isNumpadOpen
                    ? "text-4xl sm:text-5xl"
                    : "text-2xl sm:text-3xl",
                  numericAmount > 0
                    ? "text-foreground"
                    : "text-foreground-muted",
                )}
              >
                {formatCurrency(numericAmount, currentCurrency)}
              </span>
            </div>
          </div>

          {/* Pin Toggle Button */}
          <div className="absolute right-2 top-2 z-10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsPinned(!isPinned);
              }}
              title={isPinned ? t.common.pinActive : t.common.pinInactive}
              className={cn(
                "p-1.5 rounded-lg transition-colors cursor-pointer",
                isPinned
                  ? "bg-warning-muted text-warning"
                  : "text-foreground-muted hover:text-foreground",
              )}
            >
              <Pin className={cn("w-3.5 h-3.5", isPinned && "fill-current")} />
            </button>
          </div>
        </div>
        {/* Scan receipt — beside Calculator, OUTSIDE the overflow-hidden card
          so the button isn't clipped at the card edge (like edit form).
          Opens the full-screen camera view directly. */}
        <div className="absolute right-18 top-2 z-20">
          <button
            type="button"
            disabled={isScanning}
            onClick={(e) => {
              e.stopPropagation();
              setCameraError(null);
              clearScanPreview();
              setIsScanFullOpen(true);
            }}
            title={t.quickAdd.scanReceiptBtn}
            aria-label={t.quickAdd.scanReceiptBtn}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
          >
            {isScanning ? (
              <Loader2 className="h-4 w-4 animate-spin text-info" />
            ) : (
              <Camera className="h-4 w-4 text-info" />
            )}
          </button>
        </div>
      </div>

      {/*
        Numpad view and Form view are stacked in the SAME grid cell (both
        col-start-1 row-start-1) instead of being conditionally mounted.
        A CSS grid row sizes itself to the tallest cell content, so with
        both views permanently present the row height is always the max
        of the two - toggling isNumpadOpen only swaps which one is
        visible/interactive, it never changes the sheet's total height.
      */}
      <div className="grid pt-1">
        {/* Numpad View: big, thumb-friendly keypad (visible when isNumpadOpen) */}
        <div
          className={cn(
            "col-start-1 row-start-1 flex flex-col gap-2 transition-opacity duration-150",
            isNumpadOpen ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
          aria-hidden={!isNumpadOpen}
        >
          <div className="grid grid-cols-4 gap-2">
            {["1", "2", "3"].map((n) => (
              <button
                key={n}
                type="button"
                tabIndex={isNumpadOpen ? 0 : -1}
                onClick={() => handleKeypadPress(n)}
                className="h-full min-h-16 sm:min-h-19 rounded-xl bg-muted font-mono font-bold text-2xl sm:text-3xl hover:bg-secondary text-foreground border border-border active:scale-95 transition-all cursor-pointer select-none flex items-center justify-center"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              tabIndex={isNumpadOpen ? 0 : -1}
              onClick={handleKeypadBackspace}
              className="h-full min-h-16 sm:min-h-19 rounded-xl bg-muted flex items-center justify-center text-foreground-secondary hover:text-foreground hover:bg-secondary border border-border active:scale-95 transition-all cursor-pointer select-none"
            >
              <Delete className="w-6 h-6" />
            </button>

            {["4", "5", "6"].map((n) => (
              <button
                key={n}
                type="button"
                tabIndex={isNumpadOpen ? 0 : -1}
                onClick={() => handleKeypadPress(n)}
                className="h-full min-h-16 sm:min-h-19 rounded-xl bg-muted font-mono font-bold text-2xl sm:text-3xl hover:bg-secondary text-foreground border border-border active:scale-95 transition-all cursor-pointer select-none flex items-center justify-center"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              tabIndex={isNumpadOpen ? 0 : -1}
              onClick={() => handleKeypadPress("000")}
              className="h-full min-h-16 sm:min-h-19 rounded-xl bg-muted font-mono font-bold text-base sm:text-lg hover:bg-secondary text-foreground border border-border active:scale-95 transition-all cursor-pointer select-none flex items-center justify-center"
            >
              .000
            </button>

            {["7", "8", "9"].map((n) => (
              <button
                key={n}
                type="button"
                tabIndex={isNumpadOpen ? 0 : -1}
                onClick={() => handleKeypadPress(n)}
                className="h-full min-h-16 sm:min-h-19 rounded-xl bg-muted font-mono font-bold text-2xl sm:text-3xl hover:bg-secondary text-foreground border border-border active:scale-95 transition-all cursor-pointer select-none flex items-center justify-center"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              tabIndex={isNumpadOpen ? 0 : -1}
              onClick={() => {
                triggerHaptic();
                setAmountStr("0");
              }}
              className="h-full min-h-16 sm:min-h-19 rounded-xl bg-destructive-muted text-destructive font-mono font-bold text-lg sm:text-xl hover:opacity-90 border border-destructive/30 active:scale-95 transition-all cursor-pointer select-none flex items-center justify-center"
            >
              C
            </button>

            <button
              type="button"
              tabIndex={isNumpadOpen ? 0 : -1}
              onClick={() => handleKeypadPress("00")}
              className="h-full min-h-16 sm:min-h-19 rounded-xl bg-muted font-mono font-bold text-lg sm:text-xl hover:bg-secondary text-foreground border border-border active:scale-95 transition-all cursor-pointer select-none flex items-center justify-center"
            >
              00
            </button>
            <button
              type="button"
              tabIndex={isNumpadOpen ? 0 : -1}
              onClick={() => handleKeypadPress("0")}
              className="h-full min-h-16 sm:min-h-19 rounded-xl bg-muted font-mono font-bold text-2xl sm:text-3xl hover:bg-secondary text-foreground border border-border active:scale-95 transition-all cursor-pointer select-none flex items-center justify-center"
            >
              0
            </button>
          </div>

          {/* Confirm button: its own full-width row (not squeezed into the grid) */}
          <button
            type="button"
            tabIndex={isNumpadOpen ? 0 : -1}
            onClick={() => {
              triggerHaptic();
              setIsNumpadOpen(false);
            }}
            className="w-full min-h-14 rounded-xl bg-primary text-primary-foreground font-bold text-sm sm:text-base flex items-center justify-center gap-1.5 hover:bg-primary-hover active:scale-95 shadow-md transition-all cursor-pointer select-none"
          >
            <Check className="w-5 h-5 stroke-3" />
            <span>{t.quickAdd.done}</span>
          </button>
        </div>

        {/* Form View (visible when numpad is closed) */}
        <div
          className={cn(
            "col-start-1 row-start-1 flex flex-col gap-3 transition-opacity duration-150",
            isNumpadOpen ? "hidden" : "opacity-100",
          )}
          aria-hidden={isNumpadOpen}
        >
          {/* 3. Date Picker (Placed above Account & Category) */}
          <DatePicker value={txDate} onChange={setTxDate} />

          {/* 4. Account Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary">
              {t.quickAdd.account}
            </label>
            <SearchableSelect
              value={selectedAccountId}
              onValueChange={(val) => {
                setSelectedAccountId(val);
                const defaultCategoryId = resolveDefaultCategory(val, type);
                if (defaultCategoryId) {
                  setSelectedCategoryId(defaultCategoryId);
                }
              }}
              options={accounts.map((a) => ({
                value: a.id,
                label: a.name,
                icon: a.icon || "Wallet",
                badge: `(${a.currency})`,
              }))}
              placeholder={t.quickAdd.selectAccount}
              searchPlaceholder={t.quickAdd.searchAccount}
              emptyText={t.quickAdd.noAccountFound}
              triggerClassName="py-2.5 rounded-xl bg-surface-subtle"
            />
          </div>

          {/* 5. Category Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary">
              {t.quickAdd.category}
            </label>
            <SearchableSelect
              value={selectedCategoryId}
              onValueChange={setSelectedCategoryId}
              options={filteredCategories.map((c) => ({
                value: c.id,
                label: formatCategoryName(c.name, language),
                icon: c.icon || "Tag",
                iconColor:
                  type === "expense" ? "text-destructive" : "text-success",
              }))}
              placeholder={t.quickAdd.selectCategory}
              searchPlaceholder={t.quickAdd.searchCategory}
              emptyText={t.quickAdd.noCategoryFound}
              triggerClassName="py-2.5 rounded-xl bg-surface-subtle"
            />
          </div>

          {/* 6. Base Description Input (Full Width) */}
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.quickAdd.notePlaceholder}
              className={cn(
                "w-full px-3 py-2 rounded-xl bg-surface border text-xs font-medium text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-border-strong transition-all",
                highlightScan
                  ? "border-info/70 ring-2 ring-info/30"
                  : "border-border",
              )}
            />

            {/* Hidden File Input for Receipt Photo */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleReceiptUpload}
            />

            {/* Action Toolbar Grid (3 Columns: Items, Memo, Tags) */}
            <div className="grid grid-cols-3 gap-1.5">
              {/* Breakdown Items Button */}
              <button
                type="button"
                onClick={() => setShowItemsBreakdown(!showItemsBreakdown)}
                className={cn(
                  "py-1.5 px-1 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer select-none",
                  showItemsBreakdown
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-surface-subtle text-foreground-secondary hover:text-foreground border-border",
                )}
              >
                <ListPlus className="w-3 h-3 shrink-0" />
                <span className="truncate">{t.quickAdd.items}</span>
                {items.length > 0 && (
                  <span className="px-1 py-0.2 rounded-full bg-white/20 text-[9px] font-bold">
                    {items.length}
                  </span>
                )}
              </button>

              {/* Free Text Memo Button */}
              <button
                type="button"
                onClick={() => setShowFreeMemo(!showFreeMemo)}
                className={cn(
                  "py-1.5 px-1 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer select-none",
                  showFreeMemo
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-surface-subtle text-foreground-secondary hover:text-foreground border-border",
                )}
              >
                <AlignLeft className="w-3 h-3 shrink-0" />
                <span className="truncate">{t.quickAdd.memo}</span>
              </button>

              {/* Tags (#tags) Button */}
              <button
                type="button"
                onClick={() => setShowTags(!showTags)}
                className={cn(
                  "py-1.5 px-1 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer select-none",
                  showTags
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-surface-subtle text-foreground-secondary hover:text-foreground border-border",
                )}
              >
                <Hash className="w-3 h-3 shrink-0" />
                <span className="truncate">Tags</span>
                {tags.length > 0 && (
                  <span className="px-1 py-0.2 rounded-full bg-white/20 text-[9px] font-bold">
                    {tags.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* 6.5 Expandable Tags (#tags) Drawer */}
          {showTags && (
            <div className="p-3 rounded-xl bg-surface-subtle border border-border flex flex-col gap-2 animate-in fade-in duration-150">
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary">
                {t.transactions.tagLabel}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 min-h-7">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface border border-border text-xs font-bold text-foreground shadow-2xs"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                      className="text-foreground-muted hover:text-destructive cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      const clean = tagInput
                        .replace(/^#/, "")
                        .toLowerCase()
                        .trim();
                      if (clean && !tags.includes(clean)) {
                        setTags([...tags, clean]);
                        setTagInput("");
                      }
                    }
                  }}
                  placeholder={
                    tags.length === 0
                      ? t.transactions.tagPlaceholder
                      : t.common.moreTagsPlaceholder
                  }
                  className="flex-1 min-w-30 px-2 py-1 bg-transparent text-xs text-foreground placeholder:text-foreground-muted focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 7. Expandable Sub-items Breakdown Drawer */}
          {showItemsBreakdown && (
            <div className="p-3 rounded-xl bg-surface-subtle border border-border flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary truncate">
                  {t.quickAdd.itemizedBreakdownTitle}
                </span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface border border-border text-[11px] font-bold text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.quickAdd.addItem}</span>
                </button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-3 text-xs text-foreground-muted">
                  {t.quickAdd.emptyItems}
                </div>
              ) : (
                <div className="flex flex-col max-h-36 overflow-y-auto pr-0.5">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col gap-1 py-2 border-b border-border last:border-b-0"
                    >
                      {/* Row 1: Name + Total */}
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          placeholder={`Item ${idx + 1}`}
                          value={item.name}
                          onChange={(e) =>
                            handleUpdateItem(idx, "name", e.target.value)
                          }
                          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-foreground placeholder:text-foreground-muted focus:outline-none"
                        />
                        <div className="w-28 shrink-0">
                          <NumberInput
                            value={item.subtotal ?? String(getItemTotal(item))}
                            onValueChange={(value) =>
                              handleUpdateItem(idx, "subtotal", value)
                            }
                            allowDecimal={false}
                            maxDigits={12}
                            placeholder="0"
                            currency={currentCurrency}
                            compact
                            showCurrency={false}
                            bare
                            className="w-full"
                          />
                        </div>
                      </div>

                      {/* Row 2: Qty controls + price + trash */}
                      <div className="flex items-center gap-2">
                        {/* Minus */}
                        <button
                          type="button"
                          onClick={() => {
                            const base = parseFloat(item.quantity);
                            const cur = Number.isFinite(base) && base > 0 ? base : 1;
                            const next = cur > 1 ? cur - 1 : cur;
                            handleUpdateItem(idx, "quantity", String(Number(next.toFixed(6))));
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-foreground-secondary text-sm"
                        >
                          −
                        </button>

                        <input
                          type="number"
                          inputMode="decimal"
                          min={0.001}
                          step="any"
                          value={item.quantity}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "") {
                              handleUpdateItem(idx, "quantity", "");
                              return;
                            }
                            const n = parseFloat(v);
                            if (Number.isFinite(n) && n <= 0) return;
                            handleUpdateItem(idx, "quantity", v);
                          }}
                          onBlur={(e) => {
                            const n = parseFloat(e.target.value);
                            if (!Number.isFinite(n) || n <= 0) {
                              handleUpdateItem(idx, "quantity", "1");
                            }
                          }}
                          className="w-10 bg-transparent text-xs text-center text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />

                        {/* Plus */}
                        <button
                          type="button"
                          onClick={() => {
                            const base = parseFloat(item.quantity);
                            const cur = Number.isFinite(base) && base > 0 ? base : 1;
                            handleUpdateItem(idx, "quantity", String(Number((cur + 1).toFixed(6))));
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-foreground-secondary text-sm"
                        >
                          +
                        </button>

                        {/* Multiply + unit price */}
                        <span className="text-xs text-foreground-muted">×</span>
                        <div className="flex-1 min-w-0">
                          <NumberInput
                            value={item.price}
                            onValueChange={(value) =>
                              handleUpdateItem(idx, "price", value)
                            }
                            allowDecimal={false}
                            maxDigits={12}
                            placeholder="0"
                            currency={currentCurrency}
                            compact
                            showCurrency={false}
                            className="w-full bg-transparent text-xs text-foreground-secondary focus:outline-none"
                          />
                        </div>

                        {/* Trash */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-foreground-muted hover:text-destructive active:scale-90 transition-all cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Row 3: Split/patungan controls (optional) */}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[10px] text-foreground-secondary shrink-0">
                          {language === "id" ? "Dibagi ke" : "Split with"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = parseInt(item.shareCount ?? "1", 10) || 1;
                            handleUpdateItem(idx, "shareCount", String(Math.max(1, cur - 1)));
                          }}
                          className="flex h-5 w-5 items-center justify-center rounded border border-border text-foreground-secondary text-xs"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-xs font-medium text-foreground">
                          {Math.max(1, parseInt(item.shareCount ?? "1", 10) || 1)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = parseInt(item.shareCount ?? "1", 10) || 1;
                            handleUpdateItem(idx, "shareCount", String(cur + 1));
                          }}
                          className="flex h-5 w-5 items-center justify-center rounded border border-border text-foreground-secondary text-xs"
                        >
                          +
                        </button>
                        <span className="text-[10px] text-foreground-secondary shrink-0">
                          {language === "id" ? "orang" : "people"}
                        </span>

                        <div className="flex-1 min-w-0 flex items-center justify-end gap-1.5">
                          <span className="text-[10px] text-foreground-secondary shrink-0">
                            {t.quickAdd.myPortionTotalLabel}:
                          </span>
                          <div className="w-24">
                            <NumberInput
                              value={
                                item.mySubtotal ??
                                String(getItemMyTotal(item, currentCurrency))
                              }
                              onValueChange={(value) =>
                                handleUpdateItem(idx, "mySubtotal", value)
                              }
                              allowDecimal={false}
                              maxDigits={12}
                              placeholder="0"
                              currency={currentCurrency}
                              compact
                              showCurrency={false}
                              bare
                              className="w-full text-right"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Smart Allocation Summary Bar */}
              {items.length > 0 && (
                <div className="pt-2 border-t border-border flex flex-col gap-2">
                  <div className="flex flex-col gap-1 text-[11px] font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-secondary">
                        {t.quickAdd.receiptTotalLabel}:{" "}
                        <strong className="text-foreground">
                          {formatCurrency(itemsTotal, currentCurrency)}
                        </strong>
                      </span>
                      <span className="text-foreground-secondary">
                        {t.quickAdd.myPortionTotalLabel}:{" "}
                        <strong className="text-success">
                          {formatCurrency(myPortionTotal, currentCurrency)}
                        </strong>
                      </span>
                    </div>

                    {isItemsMatching ? (
                      <span className="text-[10px] font-bold text-success flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>{t.quickAdd.itemsMatched}</span>
                      </span>
                    ) : hasRemainingUnitemized ? (
                      <span className="text-[10px] font-bold text-info">
                        {t.quickAdd.unitemizedRemaining}: +
                        {formatCurrency(remainingAmount, currentCurrency)}
                      </span>
                    ) : isItemsExceeding ? (
                      <span className="text-[10px] font-bold text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>
                          +
                          {formatCurrency(
                            myPortionTotal - numericAmount,
                            currentCurrency,
                          )}{" "}
                          ({t.quickAdd.exceeds})
                        </span>
                      </span>
                    ) : null}
                  </div>

                  {/* Sync Button when total does not match */}
                  {myPortionTotal > 0 && myPortionTotal !== numericAmount && (
                    <button
                      type="button"
                      onClick={() => {
                        setAmountStr(String(Math.round(myPortionTotal)));
                        setError(null);
                      }}
                      className="w-full py-1.5 px-2 rounded-lg bg-surface border border-dashed border-border-strong hover:border-foreground text-[11px] font-medium text-foreground-secondary flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Check className="w-3 h-3 text-success" />
                      <span>
                        {t.quickAdd.syncTotalWithItems}:{" "}
                        <strong>
                          {formatCurrency(myPortionTotal, currentCurrency)}
                        </strong>
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 8. Expandable Free Text Memo Drawer */}
          {showFreeMemo && (
            <div className="p-3 rounded-xl bg-surface-subtle border border-border">
              <textarea
                rows={2}
                value={freeTextMemo}
                onChange={(e) => setFreeTextMemo(e.target.value)}
                placeholder={t.quickAdd.memoPlaceholder}
                className="w-full p-2 rounded-lg bg-surface border border-border text-xs text-foreground placeholder:text-foreground-muted focus:outline-none"
              />
            </div>
          )}

          {error && (
            <p className="text-xs font-semibold text-destructive text-center pt-1">
              {error}
            </p>
          )}

          {/* Action Footer Bar */}
          <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-xs font-bold text-foreground-secondary hover:text-foreground bg-muted hover:bg-secondary border border-border active:scale-95 transition-all cursor-pointer"
            >
              {t.common.cancel}
            </button>

            <Button
              type="button"
              onClick={handleSave}
              isLoading={isLoading}
              disabled={numericAmount <= 0}
              className="flex-1 py-2.5 h-auto font-bold text-xs rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover active:scale-95 shadow-sm"
            >
              <Check className="w-3.5 h-3.5 mr-1 stroke-3" />
              <span>{t.quickAdd.recordBtn}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Full-screen receipt scan (camera + scanning/error).
          Portaled to <body> so it escapes the BottomSheet container
          (the sheet has transform/will-change-transform, which would
          otherwise make `fixed inset-0` resolve against the sheet box
          and render the scan as a small modal card). */}
      {isScanFullOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {scanPhase === null ? (
              <CameraLiveView
                isOpen={isScanFullOpen}
                onClose={() => {
                  setIsScanFullOpen(false);
                  clearScanPreview();
                }}
                onCapture={prepareScanPreview}
                onPickImage={() => fileInputRef.current?.click()}
                error={cameraError}
                onError={setCameraError}
                onRetry={() => setCameraError(null)}
              />
            ) : scanPhase === "preview" ? (
              /* Preview dulu: user bisa ganti foto sebelum struk dipindai */
              <>
                <ReceiptScanOverlay
                  imageUrl={scanPreviewUrl}
                  showStatus={false}
                  onClose={() => {
                    setIsScanFullOpen(false);
                    clearScanPreview();
                  }}
                  closeLabel={t.common.close}
                />
                <div className="absolute inset-x-0 bottom-0 z-90 px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] bg-linear-to-t from-black/85 via-black/50 to-transparent">
                  <p className="text-sm font-semibold text-white text-center">
                    {t.quickAdd.scanPreviewTitle}
                  </p>
                  <p className="text-[11px] text-white/70 text-center mt-0.5 mb-3">
                    {t.quickAdd.scanPreviewHint}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        clearScanPreview();
                        setCameraError(null);
                      }}
                      className="h-12 flex-1 rounded-xl border border-white/50 text-white text-xs font-semibold bg-black/25 active:scale-[0.98] transition-transform"
                    >
                      {t.quickAdd.retakePhoto}
                    </button>
                    <button
                      type="button"
                      onClick={() => void runReceiptScan()}
                      className="h-12 flex-2 rounded-xl bg-white text-black text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                    >
                      <ScanLine className="w-4 h-4" />
                      {t.quickAdd.useThisPhoto}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <ReceiptScanOverlay
                imageUrl={scanPreviewUrl}
                scanning={scanPhase === "scanning"}
                progress={scanPhase === "scanning" ? ocrProgress : undefined}
                status={
                  scanPhase === "error"
                    ? language === "id"
                      ? "Gagal membaca struk"
                      : "Failed to read receipt"
                    : ocrProgress < 30
                      ? t.quickAdd.scanPreparing
                      : ocrProgress < 72
                        ? t.quickAdd.scanReading
                        : t.quickAdd.scanBuilding
                }
                error={scanPhase === "error" ? scanErrorMsg : null}
                onClose={() => {
                  setIsScanFullOpen(false);
                  clearScanPreview();
                }}
                onRetry={
                  scanPhase === "error"
                    ? () => {
                        // Back to the preview so the photo can be re-checked/confirmed
                        setScanPhase("preview");
                        setScanErrorMsg("");
                      }
                    : undefined
                }
                retryLabel={language === "id" ? "Coba lagi" : "Retry scan"}
                closeLabel={language === "id" ? "Tutup" : "Close"}
              />
            )}
          </>,
          document.body,
        )}
    </div>
  );
}
