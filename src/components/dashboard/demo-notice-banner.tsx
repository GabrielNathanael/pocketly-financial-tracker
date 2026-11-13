"use client";

import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";

interface DemoNoticeBannerProps {
  userEmail?: string | null;
}

export function DemoNoticeBanner({ userEmail }: DemoNoticeBannerProps) {
  const { t } = useLanguage();
  const [isDismissed, setIsDismissed] = useState(false);

  // Only show if user is logged in as the demo user
  const isDemoUser = userEmail?.toLowerCase() === "demo@pocketly.app";

  if (!isDemoUser || isDismissed) {
    return null;
  }

  return (
    <div className="w-full bg-warning-muted border-b border-warning px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-warning animate-in fade-in slide-in-from-top duration-300">
      <div className="flex items-center gap-2.5 max-w-4xl mx-auto flex-1">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-bold" suppressHydrationWarning>
            {t.dashboard.demoAccountLabel}
          </span>
          <span className="text-warning">
            {t.dashboard.demoAccountDesc}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        className="p-1 rounded-lg hover:bg-surface-muted text-warning transition-colors cursor-pointer shrink-0"
        title="Tutup banner / Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
