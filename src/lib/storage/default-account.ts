'use client'

import { useSyncExternalStore } from 'react'

const DEFAULT_ACCOUNT_KEY = 'pocketly_default_account_id'

export function getDefaultAccountId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(DEFAULT_ACCOUNT_KEY)
  } catch {
    return null
  }
}

export function setDefaultAccountId(accountId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (accountId) {
      localStorage.setItem(DEFAULT_ACCOUNT_KEY, accountId)
    } else {
      localStorage.removeItem(DEFAULT_ACCOUNT_KEY)
    }
    window.dispatchEvent(new Event('pocketly_default_account_updated'))
  } catch {
    // ignore
  }
}

function subscribeDefaultAccount(callback: () => void) {
  window.addEventListener('pocketly_default_account_updated', callback)
  return () => window.removeEventListener('pocketly_default_account_updated', callback)
}

export function useDefaultAccountId(): string | null {
  return useSyncExternalStore(subscribeDefaultAccount, getDefaultAccountId, () => null)
}
