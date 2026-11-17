"use client";

import React, { useState } from "react";
import { Fingerprint, Lock, LogOut, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/actions/auth";
import { disableAppLock } from "@/lib/storage/app-lock";
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
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

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

  const handleDisableLocal = () => {
    disableAppLock();
    onUnlocked();
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

        {!showDisableConfirm ? (
          <button
            type="button"
            onClick={() => setShowDisableConfirm(true)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer"
          >
            {t.settings.appLockCantUnlock}
          </button>
        ) : (
          <div className="w-full rounded-xl border border-border bg-surface-subtle p-3 flex flex-col gap-2">
            <p className="text-xs text-foreground-secondary text-left">
              {t.settings.appLockDisableLocalConfirmDesc}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setShowDisableConfirm(false)}
              >
                {t.settings.exportCancel}
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={handleDisableLocal}
              >
                <ShieldOff className="w-3.5 h-3.5" />
                {t.settings.appLockDisableLocalBtn}
              </Button>
            </div>
          </div>
        )}

        <form action={logout} className="w-full">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full gap-1.5 text-muted-foreground"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t.settings.signOutBtn}
          </Button>
        </form>
      </div>
    </div>
  );
}
