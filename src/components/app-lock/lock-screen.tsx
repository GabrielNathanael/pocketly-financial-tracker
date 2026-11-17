"use client";

import React, { useState } from "react";
import { Fingerprint, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authenticatePlatformCredential } from "@/lib/app-lock/webauthn";
import { useLanguage } from "@/lib/i18n/language-context";

interface AppLockScreenProps {
  credentialId: string;
  onUnlocked: () => void;
}

export function AppLockScreen({ credentialId, onUnlocked }: AppLockScreenProps) {
  const { t } = useLanguage();
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async () => {
    if (isUnlocking) return;
    setIsUnlocking(true);
    setError(null);

    const res = await authenticatePlatformCredential({ credentialId });
    if (res.ok) {
      onUnlocked();
      return;
    }

    if (res.code === "cancelled") {
      setError(t.settings.appLockCancelled);
    } else if (res.code === "not_supported") {
      setError(t.settings.appLockUnsupported);
    } else {
      setError(t.settings.appLockFailed);
    }
    setIsUnlocking(false);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-canvas/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-surface-subtle border border-border flex items-center justify-center text-foreground">
          <Lock className="w-6 h-6" />
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-bold text-foreground">{t.settings.appLockScreenTitle}</h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t.settings.appLockScreenDesc}
          </p>
        </div>

        {error && (
          <div className="w-full rounded-lg border border-destructive/30 bg-destructive-muted px-3 py-2 text-xs font-medium text-destructive">
            {error}
          </div>
        )}

        <Button
          type="button"
          onClick={handleUnlock}
          isLoading={isUnlocking}
          className="w-full gap-2"
        >
          <Fingerprint className="w-4 h-4" />
          {t.settings.appLockUnlockBtn}
        </Button>
      </div>
    </div>
  );
}
