'use client'

import { useSyncExternalStore } from 'react'
import { TransactionType, CurrencyCode } from '@/types/database'

export interface PinnedTemplate {
  id: string
  name: string
  accountId: string
  accountName?: string
  categoryId: string
  categoryName?: string
  categoryIcon?: string
  type: TransactionType
  amount: number
  currency: CurrencyCode
  description?: string | null
}

const STORAGE_KEY = 'pocketly_pinned_templates'
const EMPTY_TEMPLATES: PinnedTemplate[] = []

let cachedRaw: string | null = null
let cachedTemplates: PinnedTemplate[] = EMPTY_TEMPLATES

export function getPinnedTemplates(): PinnedTemplate[] {
  if (typeof window === 'undefined') return EMPTY_TEMPLATES
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      cachedRaw = null
      cachedTemplates = EMPTY_TEMPLATES
      return EMPTY_TEMPLATES
    }
    if (raw === cachedRaw) {
      return cachedTemplates
    }
    cachedRaw = raw
    cachedTemplates = JSON.parse(raw) as PinnedTemplate[]
    return cachedTemplates
  } catch {
    return EMPTY_TEMPLATES
  }
}

export function savePinnedTemplate(template: Omit<PinnedTemplate, 'id'>): PinnedTemplate {
  const list = getPinnedTemplates()
  const newTemplate: PinnedTemplate = {
    ...template,
    id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
  }
  const updated = [newTemplate, ...list.filter((t) => t.name !== template.name)]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 10)))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('pocketly_pinned_updated'))
  }
  return newTemplate
}

export function removePinnedTemplate(id: string) {
  const list = getPinnedTemplates()
  const updated = list.filter((t) => t.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('pocketly_pinned_updated'))
  }
}

function subscribePinnedTemplates(callback: () => void) {
  window.addEventListener('pocketly_pinned_updated', callback)
  return () => window.removeEventListener('pocketly_pinned_updated', callback)
}

export function usePinnedTemplates(): PinnedTemplate[] {
  return useSyncExternalStore(subscribePinnedTemplates, getPinnedTemplates, () => EMPTY_TEMPLATES)
}
