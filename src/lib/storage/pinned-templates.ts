'use client'

import { useSyncExternalStore } from 'react'
import { TransactionType, CurrencyCode } from '@/types/database'
import {
  getDbPinnedTemplates,
  createDbPinnedTemplate,
  deleteDbPinnedTemplate,
} from '@/actions/pinned'

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
let hasFetchedFromDb = false

export function getPinnedTemplates(): PinnedTemplate[] {
  if (typeof window === 'undefined') return EMPTY_TEMPLATES
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      cachedRaw = null
      cachedTemplates = EMPTY_TEMPLATES
    } else if (raw !== cachedRaw) {
      cachedRaw = raw
      cachedTemplates = JSON.parse(raw) as PinnedTemplate[]
    }
  } catch {
    cachedTemplates = EMPTY_TEMPLATES
  }

  // Trigger one-time background sync from DB
  if (!hasFetchedFromDb && typeof window !== 'undefined') {
    hasFetchedFromDb = true
    getDbPinnedTemplates()
      .then((dbTemplates) => {
        if (dbTemplates && dbTemplates.length > 0) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dbTemplates))
          cachedRaw = JSON.stringify(dbTemplates)
          cachedTemplates = dbTemplates
          window.dispatchEvent(new Event('pocketly_pinned_updated'))
        }
      })
      .catch(() => {})
  }

  return cachedTemplates
}

export function savePinnedTemplate(template: Omit<PinnedTemplate, 'id'>): PinnedTemplate {
  const list = getPinnedTemplates()
  const tempId = `template-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
  const newTemplate: PinnedTemplate = {
    ...template,
    id: tempId,
  }
  const updated = [newTemplate, ...list.filter((t) => t.name !== template.name)]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 10)))
  cachedRaw = JSON.stringify(updated.slice(0, 10))
  cachedTemplates = updated.slice(0, 10)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('pocketly_pinned_updated'))
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
      if (res.data) {
        // Update temp ID with real DB ID
        const current = getPinnedTemplates()
        const remapped = current.map((t) => (t.id === tempId ? { ...t, id: res.data.id } : t))
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remapped))
        cachedRaw = JSON.stringify(remapped)
        cachedTemplates = remapped
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('pocketly_pinned_updated'))
        }
      }
    })
    .catch(() => {})

  return newTemplate
}

export function removePinnedTemplate(id: string) {
  const list = getPinnedTemplates()
  const updated = list.filter((t) => t.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  cachedRaw = JSON.stringify(updated)
  cachedTemplates = updated

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('pocketly_pinned_updated'))
  }

  // Delete from DB asynchronously if it's a UUID
  if (id && !id.startsWith('template-')) {
    deleteDbPinnedTemplate(id).catch(() => {})
  }
}

function subscribePinnedTemplates(callback: () => void) {
  window.addEventListener('pocketly_pinned_updated', callback)
  return () => window.removeEventListener('pocketly_pinned_updated', callback)
}

export function usePinnedTemplates(): PinnedTemplate[] {
  return useSyncExternalStore(subscribePinnedTemplates, getPinnedTemplates, () => EMPTY_TEMPLATES)
}
