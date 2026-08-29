"use client";

import { useSyncExternalStore } from "react";
import { TransactionType, CurrencyCode } from "@/types/database";
import {
  getDbPinnedTemplates,
  createDbPinnedTemplate,
  deleteDbPinnedTemplate,
} from "@/actions/pinned";

export interface PinnedTemplate {
  id: string;
  name: string;
  accountId: string;
  accountName?: string;
  categoryId: string;
  categoryName?: string;
  categoryIcon?: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  description?: string | null;
}

const STORAGE_KEY_PREFIX = "pocketly_pinned_templates";
const EMPTY_TEMPLATES: PinnedTemplate[] = [];

// Scope: which user this cache currently belongs to.
// `undefined` = not yet determined (auth still resolving).
// `null` = determined that no one is logged in.
// string = the logged-in user's id.
let currentUserId: string | null | undefined = undefined;

let cachedRaw: string | null = null;
let cachedTemplates: PinnedTemplate[] = EMPTY_TEMPLATES;
let hasFetchedFromDb = false;

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}_${userId}`;
}

/**
 * Called exclusively by <PinnedTemplatesAuthSync /> whenever Supabase
 * reports the active session's user id has changed (login, logout,
 * switching accounts, etc). Resets all in-memory + persisted state so
 * data from a previous user never leaks into the next one on a
 * shared device.
 */
export function setPinnedTemplatesScope(userId: string | null) {
  if (userId === currentUserId) return;

  currentUserId = userId;
  cachedRaw = null;
  cachedTemplates = EMPTY_TEMPLATES;
  hasFetchedFromDb = false;

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pocketly_pinned_updated"));
  }
}

export function getPinnedTemplates(): PinnedTemplate[] {
  // IMPORTANT: this function is used as the `getSnapshot` for
  // useSyncExternalStore. It must stay a PURE, SYNCHRONOUS read with
  // no side effects (no network calls, no dispatchEvent, no writes
  // other than refreshing the in-memory cache from localStorage).
  // The DB sync happens in `syncPinnedTemplatesFromDb`, invoked from
  // subscribe() instead — see below.
  if (typeof window === "undefined") return EMPTY_TEMPLATES;

  // Scope not yet known (auth still resolving) or explicitly signed
  // out: never touch localStorage, just return empty.
  if (!currentUserId) return EMPTY_TEMPLATES;

  try {
    const raw = localStorage.getItem(storageKey(currentUserId));
    if (!raw) {
      cachedRaw = null;
      cachedTemplates = EMPTY_TEMPLATES;
    } else if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedTemplates = JSON.parse(raw) as PinnedTemplate[];
    }
  } catch {
    cachedTemplates = EMPTY_TEMPLATES;
  }

  return cachedTemplates;
}

// One-time background sync from DB for the current scope. Must be
// called from an effect (subscribe runs in a passive effect), never
// from getSnapshot/render.
function syncPinnedTemplatesFromDb() {
  if (hasFetchedFromDb || typeof window === "undefined" || !currentUserId)
    return;
  hasFetchedFromDb = true;
  const userId = currentUserId;

  getDbPinnedTemplates()
    .then((dbTemplates) => {
      // Bail out if the scope changed while this request was in flight
      // (e.g. user logged out/switched accounts mid-fetch).
      if (currentUserId !== userId) return;
      if (dbTemplates && dbTemplates.length > 0) {
        localStorage.setItem(storageKey(userId), JSON.stringify(dbTemplates));
        cachedRaw = JSON.stringify(dbTemplates);
        cachedTemplates = dbTemplates;
        window.dispatchEvent(new Event("pocketly_pinned_updated"));
      }
    })
    .catch(() => {});
}

export function savePinnedTemplate(
  template: Omit<PinnedTemplate, "id">,
): PinnedTemplate {
  if (!currentUserId) {
    throw new Error("savePinnedTemplate called with no active user scope");
  }
  const userId = currentUserId;

  const list = getPinnedTemplates();
  const tempId = `template-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const newTemplate: PinnedTemplate = {
    ...template,
    id: tempId,
  };
  const updated = [
    newTemplate,
    ...list.filter((t) => t.name !== template.name),
  ];
  localStorage.setItem(
    storageKey(userId),
    JSON.stringify(updated.slice(0, 10)),
  );
  cachedRaw = JSON.stringify(updated.slice(0, 10));
  cachedTemplates = updated.slice(0, 10);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pocketly_pinned_updated"));
  }

  // Persist to DB asynchronously
  createDbPinnedTemplate({
    name: template.name,
    accountId: template.accountId,
    categoryId: template.categoryId,
    type: template.type,
    amount: template.amount,
    currency: template.currency,
    description: template.description || null,
  })
    .then((res) => {
      // Bail out if the scope changed while this request was in flight.
      if (currentUserId !== userId) return;
      if (res.data) {
        const current = getPinnedTemplates();
        const remapped = current.map((t) =>
          t.id === tempId ? { ...t, id: res.data.id } : t,
        );
        localStorage.setItem(storageKey(userId), JSON.stringify(remapped));
        cachedRaw = JSON.stringify(remapped);
        cachedTemplates = remapped;
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("pocketly_pinned_updated"));
        }
      }
    })
    .catch(() => {});

  return newTemplate;
}

export function removePinnedTemplate(id: string) {
  if (!currentUserId) return;
  const userId = currentUserId;

  const list = getPinnedTemplates();
  const updated = list.filter((t) => t.id !== id);
  localStorage.setItem(storageKey(userId), JSON.stringify(updated));
  cachedRaw = JSON.stringify(updated);
  cachedTemplates = updated;

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pocketly_pinned_updated"));
  }

  // Delete from DB asynchronously if it's a UUID
  if (id && !id.startsWith("template-")) {
    deleteDbPinnedTemplate(id).catch(() => {});
  }
}

function subscribePinnedTemplates(callback: () => void) {
  // subscribe() runs inside a passive effect (after render/commit),
  // so it's a safe place to kick off the one-time DB sync.
  syncPinnedTemplatesFromDb();
  window.addEventListener("pocketly_pinned_updated", callback);
  return () => window.removeEventListener("pocketly_pinned_updated", callback);
}

export function usePinnedTemplates(): PinnedTemplate[] {
  return useSyncExternalStore(
    subscribePinnedTemplates,
    getPinnedTemplates,
    () => EMPTY_TEMPLATES,
  );
}
