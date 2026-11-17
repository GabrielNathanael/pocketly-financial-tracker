"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAppLockConfig } from "@/lib/storage/app-lock";
import { AppLockScreen } from "@/components/app-lock/lock-screen";

const RELOCK_COOLDOWN_MS = 20_000;

interface AppLockGateProps {
  children: React.ReactNode;
  initialLocked?: boolean;
}

export function AppLockGate({ children, initialLocked = false }: AppLockGateProps) {
  const config = useAppLockConfig();
  const shouldLock = Boolean(config.enabled && config.credentialId);
  const credentialId = config.credentialId;

  const [unlockedCredentialId, setUnlockedCredentialId] = useState<string | null>(null);
  const lastUnlockedAtRef = useRef<number>(0);

  const isUnlocked = !shouldLock || (credentialId !== null && unlockedCredentialId === credentialId);

  const markUnlocked = useCallback(() => {
    if (!credentialId) return;
    lastUnlockedAtRef.current = Date.now();
    setUnlockedCredentialId(credentialId);
  }, [credentialId]);

  const relockIfNeeded = useCallback(() => {
    if (!shouldLock) return;
    const now = Date.now();
    // If never unlocked in this session, keep locked (initial state)
    if (lastUnlockedAtRef.current === 0) {
      setUnlockedCredentialId(null);
      return;
    }
    if (now - lastUnlockedAtRef.current >= RELOCK_COOLDOWN_MS) {
      setUnlockedCredentialId(null);
    }
  }, [shouldLock]);

  useEffect(() => {
    if (!shouldLock) return;

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        relockIfNeeded();
      }
    };
    const onPageShow = () => {
      relockIfNeeded();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [shouldLock, relockIfNeeded]);

  // Server cookie hint: block content until client resolves (prevents dashboard flash)
  if (initialLocked && !unlockedCredentialId) {
    if (credentialId) {
      return <AppLockScreen credentialId={credentialId} onUnlocked={markUnlocked} />;
    }
    // Cookie says locked but client config not yet available (SSR/hydration) — show cover
    return <div className="fixed inset-0 z-[120] bg-canvas" aria-busy="true" />;
  }

  if (shouldLock && !isUnlocked && credentialId) {
    return <AppLockScreen credentialId={credentialId} onUnlocked={markUnlocked} />;
  }

  return <>{children}</>;
}
