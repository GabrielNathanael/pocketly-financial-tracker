"use client";

import React, { useState } from "react";
import { AlertTriangle, X, ShieldAlert, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";

interface DemoNoticeBannerProps {
  userEmail?: string | null;
}

export function DemoNoticeBanner({ userEmail }: DemoNoticeBannerProps) {
  const { language } = useLanguage();
  const [isDismissed, setIsDismissed] = useState(false);

  // Only show if user is logged in as the demo user
  const isDemoUser = userEmail?.toLowerCase() === "demo@pocketly.app";

  if (!isDemoUser || isDismissed) {
    return null;
  }

  return (
    <div className="w-full bg-amber-500/15 dark:bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in slide-in-from-top duration-300">
      <div className="flex items-center gap-2.5 max-w-4xl mx-auto flex-1">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-bold">
            {language === "id" ? "Akun Demo Publik:" : "Public Demo Account:"}
          </span>
          <span className="text-amber-800 dark:text-amber-300">
            {language === "id"
              ? "Akun ini digunakan bersama untuk preview fitur. Mohon jangan memasukkan data pribadi/rahasia."
              : "This account is shared publicly for demo. Please do not submit real or sensitive financial data."}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 transition-colors cursor-pointer shrink-0"
        title="Tutup banner / Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
