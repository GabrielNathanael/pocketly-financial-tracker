"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Account, Category, TransactionType } from "@/types/database";
import { formatCurrency } from "@/lib/utils/currency";
import {
  getItemTotal as getSharedItemTotal,
  formatItemsSummary,
} from "@/lib/utils/transaction-items";
import { formatCategoryName } from "@/lib/utils/category-i18n";
import { createTransaction } from "@/actions/transactions";
import { CameraCaptureModal } from "@/components/ui/camera-capture-modal";
import { isMobileDevice } from "@/lib/utils/device";
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
  ChevronDown,
  AlignLeft,
  Hash,
  X,
  AlertCircle,
  Camera,
  Loader2,
  Calculator,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import { scanReceipt } from "@/lib/ocr/receipt-scanner";
import { scanReceiptGemini } from "@/lib/ocr/receipt-gemini-client";
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
  const [ocrStatus, setOcrStatus] = useState<string>("");
  const [showScanMenu, setShowScanMenu] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinnedTemplates, setPinnedTemplates] =
    useState<PinnedTemplate[]>(getPinnedTemplates);

  // Receipt OCR File Handler
  const handleReceiptFile = async (file: File) => {
    if (!file) return;

    setIsScanning(true);
    setOcrProgress(10);
    setOcrStatus(t.quickAdd.scanningReceipt);

    const progressTimer = setInterval(() => {
      setOcrProgress((prev) => Math.min(85, prev + 10));
    }, 600);

    try {
      // Gemini dulu (rincian terstruktur), gagal baru Tesseract
      const gemini = await scanReceiptGemini(file);
      clearInterval(progressTimer);
      const parsed =
        gemini && gemini.amount > 0
          ? gemini
          : await scanReceipt(file, (pct, status) => {
              setOcrProgress(pct);
              setOcrStatus(status);
            });

      if (parsed.amount > 0) {
        setAmountStr(String(Math.round(parsed.amount)));
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

      toast.success(t.quickAdd.scanSuccess);
    } catch (err: any) {
      clearInterval(progressTimer);
      console.error("OCR Error:", err);
      toast.error(t.quickAdd.scanFailed);
    } finally {
      clearInterval(progressTimer);
      setIsScanning(false);
      setOcrProgress(0);
      setOcrStatus("");
    }
  };

  const handleReceiptUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (file) await handleReceiptFile(file);
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
    if (true) {
      const primary = accounts.find((a) => a.is_default) || accounts[0];
      if (primary) setSelectedAccountId(primary.id);

      const defaultCategoryId = resolveDefaultCategory(
        primary?.id || "",
        "expense",
      );
      if (defaultCategoryId) setSelectedCategoryId(defaultCategoryId);
    }
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

  // Numeric amount is strictly driven by the main amountStr input/keypad
  const numericAmount = parseFloat(amountStr) || 0;
  const remainingAmount = numericAmount - itemsTotal;
  const isItemsExceeding =
    showItemsBreakdown &&
    items.length > 0 &&
    itemsTotal > numericAmount &&
    numericAmount > 0;
  const isItemsMatching =
    showItemsBreakdown &&
    items.length > 0 &&
    itemsTotal === numericAmount &&
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
      // Once the user edits qty/price, the OCR-copied printed subtotal
      // is stale — drop it so the total falls back to qty * price.
      // Clearing the subtotal field itself also reverts to qty * price.
      const clearSubtotal =
        field === "quantity" ||
        field === "price" ||
        (field === "subtotal" && value === "");
      updated[index] = {
        ...updated[index],
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
      itemsTotal > numericAmount &&
      numericAmount > 0
    ) {
      setError(
        `${t.quickAdd.itemsExceedWarning} ${formatCurrency(itemsTotal - numericAmount, currentCurrency)}`,
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

    // Build compound description if items or memo exist
    const defaultTypeLabel =
      type === "expense" ? t.quickAdd.expense : t.quickAdd.income;
    let finalDesc =
      description.trim() || activeCategory?.name || defaultTypeLabel;

    if (showItemsBreakdown && items.length > 0) {
      const itemsSummary = formatItemsSummary(items, currentCurrency);
      if (itemsSummary) {
        finalDesc += ` [Items: ${itemsSummary}]`;
      }
    }

    if (showFreeMemo && freeTextMemo.trim()) {
      finalDesc += ` [Memo: ${freeTextMemo.trim()}]`;
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
          <Star className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
          {pinnedTemplates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleApplyTemplate(tpl)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F1F3F5] dark:bg-[#1A1A20] hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#FAFAFA] border border-[#E5E7EB] dark:border-[#27272A] shrink-0 cursor-pointer active:scale-95 transition-all"
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
          "grid grid-cols-2 p-0.5 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-lg border border-[#E5E7EB] dark:border-[#27272A] transition-all",
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
              ? "bg-[#E11D48] text-white shadow-2xs"
              : "text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]",
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
              ? "bg-[#0D9488] text-white shadow-2xs"
              : "text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]",
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
          "relative rounded-xl bg-white dark:bg-[#121215] border shadow-2xs overflow-hidden transition-all group",
          isAmountShaking
            ? "border-[#E11D48] dark:border-[#E11D48] ring-2 ring-[#E11D48]/20 animate-[shake_0.3s_ease-in-out]"
            : isNumpadOpen
              ? "border-[#0F172A] dark:border-[#FAFAFA] ring-2 ring-[#0F172A]/10 dark:ring-[#FAFAFA]/10"
              : "border-[#E5E7EB] dark:border-[#27272A]",
        )}
      >
        <div
          onClick={() => setIsNumpadOpen(!isNumpadOpen)}
          className={cn(
            "w-full flex flex-col text-left cursor-pointer hover:bg-[#F8F9FA] dark:hover:bg-[#16161A] transition-all",
            isNumpadOpen ? "p-4 gap-1.5" : "p-3 gap-1",
          )}
        >
          <div className="flex items-center justify-between pr-8">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.quickAdd.nominal}
            </span>

            <Calculator
              className={cn(
                "w-4 h-4 transition-colors",
                isNumpadOpen
                  ? "text-[#0F172A] dark:text-[#FAFAFA]"
                  : "text-[#94A3B8] group-hover:text-blue-500",
              )}
            />
          </div>

          {isNumpadOpen && (
            <div
              className="overflow-x-auto whitespace-nowrap text-right text-xs font-mono font-semibold tracking-wide text-[#64748B] dark:text-[#94A3B8] no-scrollbar"
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
                "font-bold text-[#0F172A] dark:text-[#F8FAFC]",
                isNumpadOpen ? "text-2xl" : "text-xl",
              )}
            >
              {currentCurrency}
            </span>
            <span
              className={cn(
                "flex-1 min-w-0 font-mono font-bold tracking-tight truncate",
                isNumpadOpen ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl",
                numericAmount > 0
                  ? "text-[#0F172A] dark:text-[#F8FAFC]"
                  : "text-[#94A3B8]",
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
                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-500"
                : "text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]",
            )}
          >
            <Pin className={cn("w-3.5 h-3.5", isPinned && "fill-current")} />
          </button>
        </div>
      </div>
      {/* Scan receipt — beside Calculator, OUTSIDE the overflow-hidden card
          so the dropdown isn't clipped at the card edge (like edit form) */}
      <div className="absolute right-[72px] top-2 z-20">
        <button
          type="button"
          disabled={isScanning}
          onClick={(e) => {
            e.stopPropagation();
            setShowScanMenu((v) => !v);
          }}
          title={t.quickAdd.scanReceiptBtn}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:bg-[#F1F3F5] hover:text-[#0F172A] dark:hover:bg-[#1A1A20] dark:hover:text-[#FAFAFA] disabled:opacity-60"
        >
          {isScanning ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          ) : (
            <Camera className="h-4 w-4 text-indigo-500" />
          )}
        </button>
        {showScanMenu && !isScanning && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setShowScanMenu(false);
              }}
            />
            <div
              className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-lg dark:border-[#27272A] dark:bg-[#121215]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowScanMenu(false);
                  // Mobile: native camera (no permission prompt).
                  // Desktop: webcam modal (capture is ignored there).
                  if (isMobileDevice()) {
                    cameraInputRef.current?.click();
                  } else {
                    setShowCameraModal(true);
                  }
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[#0F172A] hover:bg-[#F8F9FA] dark:text-[#F8FAFC] dark:hover:bg-[#1A1A20]"
              >
                <Camera className="h-3.5 w-3.5" />
                {t.quickAdd.takePhoto}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowScanMenu(false);
                  fileInputRef.current?.click();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[#0F172A] hover:bg-[#F8F9FA] dark:text-[#F8FAFC] dark:hover:bg-[#1A1A20]"
              >
                <AlignLeft className="h-3.5 w-3.5" />
                {t.quickAdd.uploadFromDevice}
              </button>
            </div>
          </>
        )}
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
                className="h-full min-h-16 sm:min-h-[4.75rem] rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-2xl sm:text-3xl hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] active:scale-95 transition-all cursor-pointer select-none flex items-center justify-center"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              tabIndex={isNumpadOpen ? 0 : -1}
              onClick={handleKeypadBackspace}
              className="h-full min-h-16 sm:min-h-[4.75rem] rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] flex items-center justify-center text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] border border-[#E5E7EB] dark:border-[#27272A] active:scale-95 transition-all cursor-pointer select-none"
            >
              <Delete className="w-6 h-6" />
            </button>

            {["4", "5", "6"].map((n) => (
              <button
                key={n}
                type="button"
                tabIndex={isNumpadOpen ? 0 : -1}
                onClick={() => handleKeypadPress(n)}
                className="h-full min-h-16 sm:min-h-[4.75rem] rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-2xl sm:text-3xl hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] active:scale-95 transition-all cursor-pointer select-none flex items-center justify-center"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              tabIndex={isNumpadOpen ? 0 : -1}
              onClick={() => handleKeypadPress("000")}
              className="h-full min-h-16 sm:min-h-[4.75rem] rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-base sm:text-lg hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] active:scale-95 transition-all cursor-pointer select-none flex items-center justify-center"
            >
              .000
            </button>

            {["7", "8", "9"].map((n) => (
              <button
                key={n}
                type="button"
                tabIndex={isNumpadOpen ? 0 : -1}
                onClick={() => handleKeypadPress(n)}
                className="h-full min-h-16 sm:min-h-[4.75rem] rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-2xl sm:text-3xl hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] active:scale-95 transition-all cursor-pointer select-none flex items-center justify-center"
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
              className="h-full min-h-16 sm:min-h-[4.75rem] rounded-xl bg-[#FFF1F2] dark:bg-[#881337]/20 text-[#E11D48] font-mono font-bold text-lg sm:text-xl hover:bg-[#FFE4E6] dark:hover:bg-[#881337]/40 border border-[#FECDD3] dark:border-[#9F1239]/40 active:scale-95 transition-all cursor-pointer select-none flex items-center justify-center"
            >
              C
            </button>

            <button
              type="button"
              tabIndex={isNumpadOpen ? 0 : -1}
              onClick={() => handleKeypadPress("00")}
              className="h-full min-h-16 sm:min-h-[4.75rem] rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-lg sm:text-xl hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] active:scale-95 transition-all cursor-pointer select-none flex items-center justify-center"
            >
              00
            </button>
            <button
              type="button"
              tabIndex={isNumpadOpen ? 0 : -1}
              onClick={() => handleKeypadPress("0")}
              className="h-full min-h-16 sm:min-h-[4.75rem] rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-2xl sm:text-3xl hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] active:scale-95 transition-all cursor-pointer select-none flex items-center justify-center"
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
            className="w-full min-h-14 rounded-xl bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] font-bold text-sm sm:text-base flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-95 shadow-md transition-all cursor-pointer select-none"
          >
            <Check className="w-5 h-5 stroke-[3]" />
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
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
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
              triggerClassName="py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20]"
            />
          </div>

          {/* 5. Category Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
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
                  type === "expense" ? "text-[#E11D48]" : "text-[#0D9488]",
              }))}
              placeholder={t.quickAdd.selectCategory}
              searchPlaceholder={t.quickAdd.searchCategory}
              emptyText={t.quickAdd.noCategoryFound}
              triggerClassName="py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20]"
            />
          </div>

          {/* 6. Base Description Input (Full Width) */}
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.quickAdd.notePlaceholder}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#FAFAFA]"
            />

            {/* Hidden File Input for Receipt Photo */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleReceiptUpload}
            />
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleReceiptUpload}
            />

            {/* OCR Scanning Status Banner */}
            {isScanning && (
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between gap-2 animate-pulse">
                <div className="flex items-center gap-2 min-w-0">
                  <Loader2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
                  <span className="text-xs font-medium text-indigo-900 dark:text-indigo-200 truncate">
                    {ocrStatus || t.quickAdd.scanningReceipt}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                  {ocrProgress}%
                </span>
              </div>
            )}

            {/* Action Toolbar Grid (3 Columns: Items, Memo, Tags) */}
            <div className="grid grid-cols-3 gap-1.5">
              {/* Breakdown Items Button */}
              <button
                type="button"
                onClick={() => setShowItemsBreakdown(!showItemsBreakdown)}
                className={cn(
                  "py-1.5 px-1 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer select-none",
                  showItemsBreakdown
                    ? "bg-[#0F172A] text-white border-[#0F172A] dark:bg-[#FAFAFA] dark:text-[#0F172A] shadow-xs"
                    : "bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] border-[#E5E7EB] dark:border-[#27272A]",
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
                    ? "bg-[#0F172A] text-white border-[#0F172A] dark:bg-[#FAFAFA] dark:text-[#0F172A] shadow-xs"
                    : "bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] border-[#E5E7EB] dark:border-[#27272A]",
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
                    ? "bg-[#0F172A] text-white border-[#0F172A] dark:bg-[#FAFAFA] dark:text-[#0F172A] shadow-xs"
                    : "bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] border-[#E5E7EB] dark:border-[#27272A]",
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
            <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2 animate-in fade-in duration-150">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                {t.transactions.tagLabel}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs font-bold text-[#0F172A] dark:text-[#FAFAFA] shadow-2xs"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                      className="text-[#94A3B8] hover:text-rose-500 cursor-pointer"
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
                  className="flex-1 min-w-[120px] px-2 py-1 bg-transparent text-xs text-[#0F172A] dark:text-[#FAFAFA] placeholder:text-[#94A3B8] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 7. Expandable Sub-items Breakdown Drawer */}
          {showItemsBreakdown && (
            <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] truncate">
                  {t.quickAdd.itemizedBreakdownTitle}
                </span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-[11px] font-bold text-[#0F172A] dark:text-[#FAFAFA] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.quickAdd.addItem}</span>
                </button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-3 text-xs text-[#94A3B8]">
                  {t.quickAdd.emptyItems}
                </div>
              ) : (
                <div className="flex flex-col max-h-36 overflow-y-auto pr-0.5">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col gap-1 py-2 border-b border-[#E5E7EB] dark:border-[#27272A] last:border-b-0"
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
                          className="flex-1 min-w-0 bg-transparent text-sm font-medium text-[#0F172A] dark:text-[#FAFAFA] placeholder:text-[#94A3B8] focus:outline-none"
                        />
                        <div className="w-28 shrink-0">
                          <NumberInput
                            value={
                              item.subtotal ??
                              String(getItemTotal(item))
                            }
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
                          onClick={() =>
                            handleUpdateItem(
                              idx,
                              "quantity",
                              String(
                                Math.max(
                                  0,
                                  (parseFloat(item.quantity) || 1) - 1,
                                ),
                              ),
                            )
                          }
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-[#E5E7EB] dark:border-[#27272A] text-[#64748B] dark:text-[#94A3B8] text-sm"
                        >
                          −
                        </button>

                        <input
                          type="number"
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateItem(idx, "quantity", e.target.value)
                          }
                          className="w-10 bg-transparent text-xs text-center text-[#0F172A] dark:text-[#FAFAFA] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />

                        {/* Plus */}
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateItem(
                              idx,
                              "quantity",
                              String((parseFloat(item.quantity) || 1) + 1),
                            )
                          }
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-[#E5E7EB] dark:border-[#27272A] text-[#64748B] dark:text-[#94A3B8] text-sm"
                        >
                          +
                        </button>

                        {/* Multiply + unit price */}
                        <span className="text-xs text-[#94A3B8]">×</span>
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
                            className="w-full bg-transparent text-xs text-[#64748B] dark:text-[#94A3B8] focus:outline-none"
                          />
                        </div>

                        {/* Trash */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-[#94A3B8] hover:text-[#E11D48] active:scale-90 transition-all cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Smart Allocation Summary Bar */}
              {items.length > 0 && (
                <div className="pt-2 border-t border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[#64748B] dark:text-[#94A3B8]">
                      {t.quickAdd.itemizedTotal}:{" "}
                      <strong className="text-[#0F172A] dark:text-[#FAFAFA]">
                        {formatCurrency(itemsTotal, currentCurrency)}
                      </strong>
                    </span>

                    {isItemsMatching ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>{t.quickAdd.itemsMatched}</span>
                      </span>
                    ) : hasRemainingUnitemized ? (
                      <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                        {t.quickAdd.unitemizedRemaining}: +
                        {formatCurrency(remainingAmount, currentCurrency)}
                      </span>
                    ) : isItemsExceeding ? (
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>
                          +
                          {formatCurrency(
                            itemsTotal - numericAmount,
                            currentCurrency,
                          )}{" "}
                          ({t.quickAdd.exceeds})
                        </span>
                      </span>
                    ) : null}
                  </div>

                  {/* Sync Button when total does not match */}
                  {itemsTotal > 0 && itemsTotal !== numericAmount && (
                    <button
                      type="button"
                      onClick={() => {
                        setAmountStr(String(Math.round(itemsTotal)));
                        setError(null);
                      }}
                      className="w-full py-1.5 px-2 rounded-lg bg-white dark:bg-[#121215] border border-dashed border-[#CBD5E1] dark:border-[#334155] hover:border-[#0F172A] dark:hover:border-[#FAFAFA] text-[11px] font-medium text-[#475569] dark:text-[#CBD5E1] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Check className="w-3 h-3 text-[#0D9488]" />
                      <span>
                        {t.quickAdd.syncTotalWithItems}:{" "}
                        <strong>
                          {formatCurrency(itemsTotal, currentCurrency)}
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
            <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
              <textarea
                rows={2}
                value={freeTextMemo}
                onChange={(e) => setFreeTextMemo(e.target.value)}
                placeholder={t.quickAdd.memoPlaceholder}
                className="w-full p-2 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none"
              />
            </div>
          )}

          {error && (
            <p className="text-xs font-semibold text-[#E11D48] text-center pt-1">
              {error}
            </p>
          )}

          {/* Action Footer Bar */}
          <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A]">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] bg-[#F1F3F5] dark:bg-[#1A1A20] hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] border border-[#E5E7EB] dark:border-[#27272A] active:scale-95 transition-all cursor-pointer"
            >
              {t.common.cancel}
            </button>

            <Button
              type="button"
              onClick={handleSave}
              isLoading={isLoading}
              disabled={numericAmount <= 0}
              className="flex-1 py-2.5 h-auto font-bold text-xs rounded-xl bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] hover:opacity-90 active:scale-95 shadow-sm"
            >
              <Check className="w-3.5 h-3.5 mr-1 stroke-[3]" />
              <span>{t.quickAdd.recordBtn}</span>
            </Button>
          </div>
        </div>
      </div>
      <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={handleReceiptFile}
      />
    </div>
  );
}
