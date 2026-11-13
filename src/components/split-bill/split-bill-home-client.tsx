"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ChevronRight, History, PenLine } from "lucide-react";
 
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";
import { useLanguage } from "@/lib/i18n/language-context";
 
import type { SplitBill } from "@/types/split-bill";

/** Tanggal singkat untuk "terakhir dibuka". */
function formatRecentDate(iso: string, language: "id" | "en"): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * Halaman awal Split Bill: langsung pilih cara mulai (Scan / Manual),
 * riwayat dipindah ke halaman terpisah (/split-bill/history).
 */
export function SplitBillHomeClient({ bills }: { bills: SplitBill[] }) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [isStartingManual, setIsStartingManual] = useState(false);
  const total = bills.length;

  const startManual = () => {
    if (isStartingManual) return;
    setIsStartingManual(true);
    router.push("/split-bill?mode=manual");
  };

  // "Terakhir dibuka" = yang paling baru diubah/dibuka
  const recent = [...bills]
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 3);

  const cardBase =
    "group flex flex-col rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-foreground-muted hover:bg-canvas dark:hover:bg-surface-subtle";
  // Scan Struk = kartu utama (hitam), Manual Input = kartu sekunder (putih)
  const cardPrimary =
    "group flex flex-col rounded-2xl border border-border-strong bg-primary p-5 transition-opacity hover:opacity-95";

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5">
      {/* Header + riwayat */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {t.splitBill.title}
          </h1>
          <p className="text-sm text-foreground-secondary mt-1">
            {t.splitBill.subtitle}
          </p>
        </div>
        <Link
          href="/split-bill/history"
          title={t.splitBill.history}
          aria-label={t.splitBill.history}
          className="relative w-11 h-11 shrink-0 rounded-full border border-border bg-surface flex items-center justify-center hover:bg-canvas dark:hover:bg-surface-subtle transition-colors"
        >
          <History className="w-5 h-5 text-foreground" />
          {total > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {total}
            </span>
          )}
        </Link>
      </div>

      {/* Pilihan cara mulai */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Link href="/split-bill?mode=scan" className={cardPrimary}>
          <span className="w-11 h-11 rounded-xl bg-white/15 text-primary-foreground flex items-center justify-center">
            <Camera className="w-5 h-5" />
          </span>
          <span className="block text-base font-bold mt-4 text-primary-foreground">
            {t.splitBill.startScan}
          </span>
          <span className="block text-xs text-primary-foreground/70 mt-1 leading-relaxed">
            {t.splitBill.startScanDesc}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-foreground/70 mt-4 transition-opacity group-hover:opacity-100">
            {language === "id" ? "Mulai" : "Start"}
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        <button type="button" onClick={startManual} disabled={isStartingManual} className={cn(cardBase, "text-left w-full", isStartingManual && "opacity-70 cursor-not-allowed")}>
          <span className="w-11 h-11 rounded-xl bg-surface-subtle text-foreground flex items-center justify-center">
            <PenLine className="w-5 h-5" />
          </span>
          <span className="block text-base font-bold mt-4 text-foreground">
            {t.splitBill.startManual}
          </span>
          <span className="block text-xs text-foreground-secondary mt-1 leading-relaxed">
            {t.splitBill.startManualDesc}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-foreground-muted mt-4 group-hover:text-foreground transition-colors">
            {language === "id" ? "Mulai" : "Start"}
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>
      </div>

      {/* Terakhir dibuka */}
      {recent.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
              {language === "id" ? "Terakhir dibuka" : "Recently opened"}
            </p>
            <Link
              href="/split-bill/history"
              className="text-[11px] font-bold text-foreground-secondary hover:text-foreground transition-colors"
            >
              {language === "id" ? "Lihat semua" : "See all"}
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {recent.map((b) => (
              <Link
                key={b.id}
                href={`/split-bill/${b.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5 hover:bg-canvas dark:hover:bg-surface-subtle transition-colors"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground truncate">
                    {b.title || t.splitBill.title}
                  </span>
                  <span className="block text-[11px] text-foreground-muted mt-0.5 truncate">
                    {formatRecentDate(b.updated_at, language)} ·{" "}
                    {formatCurrency(Number(b.grand_total_amount) || 0, b.currency)}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {b.split_mode === "equal" && (
                    <span className="text-[10px] font-bold rounded-full border border-border px-2 py-0.5 text-foreground-secondary">
                      {t.splitBill.equalSplit}
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                      b.status === "balanced"
                        ? "bg-success-muted text-success"
                        : "bg-surface-subtle text-foreground-muted dark:text-foreground-secondary",
                    )}
                  >
                    {b.status === "balanced" ? t.splitBill.balanced : t.splitBill.draft}
                  </span>
                  <ChevronRight className="w-4 h-4 text-border-strong/30" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
