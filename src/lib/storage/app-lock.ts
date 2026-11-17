"use client";

import { useSyncExternalStore } from "react";

export type AppLockConfigV1 = {
  version: 1;
  enabled: boolean;
  credentialId: string | null;
  createdAt?: string;
};

const STORAGE_KEY = "pocketly_app_lock_v1";
const APP_LOCK_EVENT = "pocketly_app_lock_changed";

export const APP_LOCK_DEFAULT: AppLockConfigV1 = {
  version: 1,
  enabled: false,
  credentialId: null,
};

let cachedConfig: AppLockConfigV1 | null = null;

function parseConfig(raw: string | null): AppLockConfigV1 {
  if (!raw) return APP_LOCK_DEFAULT;
  try {
    const parsed = JSON.parse(raw) as Partial<AppLockConfigV1> | null;
    if (!parsed || parsed.version !== 1) return APP_LOCK_DEFAULT;
    return {
      version: 1,
      enabled: Boolean(parsed.enabled && parsed.credentialId),
      credentialId:
        typeof parsed.credentialId === "string" && parsed.credentialId.length > 0
          ? parsed.credentialId
          : null,
      createdAt:
        typeof parsed.createdAt === "string" ? parsed.createdAt : undefined,
    };
  } catch {
    return APP_LOCK_DEFAULT;
  }
}

function getSnapshot(): AppLockConfigV1 {
  if (typeof window === "undefined") return APP_LOCK_DEFAULT;
  if (cachedConfig) return cachedConfig;
  cachedConfig = parseConfig(localStorage.getItem(STORAGE_KEY));
  return cachedConfig;
}

function subscribe(callback: () => void) {
  const handler = () => {
    cachedConfig = null;
    callback();
  };
  window.addEventListener(APP_LOCK_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(APP_LOCK_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function useAppLockConfig(): AppLockConfigV1 {
  return useSyncExternalStore(subscribe, getSnapshot, () => APP_LOCK_DEFAULT);
}

export function getAppLockConfig(): AppLockConfigV1 {
  return getSnapshot();
}

export function setAppLockConfig(next: AppLockConfigV1): void {
  if (typeof window === "undefined") return;
  const normalized: AppLockConfigV1 = {
    version: 1,
    enabled: Boolean(next.enabled && next.credentialId),
    credentialId: next.credentialId || null,
    createdAt: next.createdAt,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  cachedConfig = normalized;
  window.dispatchEvent(new Event(APP_LOCK_EVENT));
}

export function enableAppLock(credentialId: string): void {
  setAppLockConfig({
    version: 1,
    enabled: true,
    credentialId,
    createdAt: new Date().toISOString(),
  });
}

export function disableAppLock(): void {
  setAppLockConfig(APP_LOCK_DEFAULT);
}
