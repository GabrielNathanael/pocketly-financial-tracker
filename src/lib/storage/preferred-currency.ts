'use client'

import { useSyncExternalStore } from 'react'
import { CurrencyCode, DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '@/lib/constants/currencies'

const PREFERRED_CURRENCY_KEY = 'pocketly_preferred_display_currency'

export function getPreferredCurrency(): CurrencyCode {
  if (typeof window === 'undefined') return DEFAULT_CURRENCY
  try {
    const saved = localStorage.getItem(PREFERRED_CURRENCY_KEY)
    if (saved && saved in SUPPORTED_CURRENCIES) {
      return saved as CurrencyCode
    }
  } catch {
    // Ignored
  }
  return DEFAULT_CURRENCY
}

export function setPreferredCurrency(code: CurrencyCode): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PREFERRED_CURRENCY_KEY, code)
    window.dispatchEvent(new Event('pocketly_preferred_currency_updated'))
  } catch {
    // Ignored
  }
}

function subscribePreferredCurrency(callback: () => void) {
  window.addEventListener('pocketly_preferred_currency_updated', callback)
  return () => window.removeEventListener('pocketly_preferred_currency_updated', callback)
}

export function usePreferredCurrency(): CurrencyCode {
  return useSyncExternalStore(subscribePreferredCurrency, getPreferredCurrency, () => DEFAULT_CURRENCY)
}
