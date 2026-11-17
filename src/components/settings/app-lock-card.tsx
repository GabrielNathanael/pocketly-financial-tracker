"use client";

import React, { useEffect, useState } from "react";
import { Fingerprint, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils/cn";
import { disableAppLock, enableAppLock, useAppLockConfig } from "@/lib/storage/app-lock";
import {
  getWebAuthnSupport,
  registerPlatformCredential,
  type WebAuthnSupport,
} from "@/lib/app-lock/webauthn";

interface AppLockCardProps {
  userEmail: string;
}

export function AppLockCard({ userEmail }: AppLockCardProps) {
  const { t } = useLanguage();
  const config = useAppLockConfig();
  const [support, setSupport] = useState<WebAuthnSupport | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    let mounted = true;
    getWebAuthnSupport().then((res) => {
      if (mounted) setSupport(res);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const isEnabled = config.enabled && Boolean(config.credentialId);
  const isSupported = support?.supported ?? false;

  const handleEnable = async () => {
    setIsWorking(true);
    try {
      const res = await registerPlatformCredential({
        userName: userEmail || "pocketly-user",
        displayName: userEmail ? `Pocketly (${userEmail})` : "Pocketly",
      });

      if (!res.ok) {
        if (res.code === "cancelled") {
          toast.error(t.settings.appLockCancelled);
        } else if (res.code === "not_supported") {
          toast.error(t.settings.appLockUnsupported);
        } else {
          toast.error(t.settings.appLockEnableFailed);
        }
        return;
      }

      enableAppLock(res.value.credentialId);
      toast.success(t.settings.appLockEnableSuccess);
    } finally {
      setIsWorking(false);
    }
  };

  const handleDisable = () => {
    disableAppLock();
    toast.success(t.settings.appLockDisableSuccess);
  };

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-surface-subtle border border-border text-foreground flex items-center justify-center shrink-0">
          {isEnabled ? <ShieldCheck className="w-4 h-4" /> : <Fingerprint className="w-4 h-4" />}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              {t.settings.appLockTitle}
            </h3>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border",
                isEnabled
                  ? "bg-success-muted text-success border-success/30"
                  : "bg-surface-subtle text-muted-foreground border-border",
              )}
            >
              {isEnabled ? t.settings.appLockEnabled : t.settings.appLockDisabled}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t.settings.appLockDesc}
          </p>
          {support && !isSupported && (
            <p className="text-[11px] text-warning mt-1.5 flex items-center gap-1.5">
              <Lock className="w-3 h-3 shrink-0" />
              <span>{t.settings.appLockUnsupported}</span>
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 w-full sm:w-auto">
        {isEnabled ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDisable}
            disabled={isWorking}
            className="w-full sm:w-auto"
          >
            {t.settings.appLockDisableBtn}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={handleEnable}
            isLoading={isWorking}
            disabled={support !== null && !isSupported}
            className="w-full sm:w-auto"
          >
            {t.settings.appLockEnableBtn}
          </Button>
        )}
      </div>
    </div>
  );
}
