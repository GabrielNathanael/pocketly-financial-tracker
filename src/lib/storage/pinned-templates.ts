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

const EMPTY_TEMPLATES: PinnedTemplate[] = [];
let currentUserId: string | null | undefined;
let cachedTemplates: PinnedTemplate[] = EMPTY_TEMPLATES;
let hasFetchedFromDb = false;

export function setPinnedTemplatesScope(userId: string | null) {
  if (userId === currentUserId) return;
  currentUserId = userId;
  cachedTemplates = EMPTY_TEMPLATES;
  hasFetchedFromDb = false;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pocketly_pinned_updated"));
  }
}

export function getPinnedTemplates(): PinnedTemplate[] {
  return currentUserId ? cachedTemplates : EMPTY_TEMPLATES;
}

function notifyPinnedTemplatesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pocketly_pinned_updated"));
  }
}

function syncPinnedTemplatesFromDb() {
  if (hasFetchedFromDb || typeof window === "undefined" || !currentUserId) {
    return;
  }
  hasFetchedFromDb = true;
  const userId = currentUserId;
  getDbPinnedTemplates()
    .then((dbTemplates) => {
      if (currentUserId !== userId) return;
      cachedTemplates = dbTemplates;
      notifyPinnedTemplatesChanged();
    })
    .catch(() => {
      hasFetchedFromDb = false;
    });
}

export async function savePinnedTemplate(
  template: Omit<PinnedTemplate, "id">,
): Promise<PinnedTemplate> {
  if (!currentUserId) {
    throw new Error("Cannot save a pin without an active user");
  }
  const userId = currentUserId;
  const result = await createDbPinnedTemplate({
    name: template.name,
    accountId: template.accountId,
    categoryId: template.categoryId,
    type: template.type,
    amount: template.amount,
    currency: template.currency,
    description: template.description || null,
  });
  if (result.error || !result.data) {
    throw new Error(result.error || "Failed to save pinned template");
  }
  if (currentUserId !== userId) {
    throw new Error("User session changed while saving the pin");
  }

  cachedTemplates = [
    { ...template, id: result.data.id },
    ...cachedTemplates.filter((item) => item.name !== template.name),
  ].slice(0, 10);
  notifyPinnedTemplatesChanged();
  return { ...template, id: result.data.id };
}

export async function removePinnedTemplate(id: string): Promise<void> {
  if (!currentUserId) {
    throw new Error("Cannot remove a pin without an active user");
  }
  const result = await deleteDbPinnedTemplate(id);
  if (result.error) {
    throw new Error(result.error);
  }
  cachedTemplates = cachedTemplates.filter((item) => item.id !== id);
  notifyPinnedTemplatesChanged();
}

function subscribePinnedTemplates(callback: () => void) {
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
