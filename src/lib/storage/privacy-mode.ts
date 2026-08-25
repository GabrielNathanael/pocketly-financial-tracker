'use client'

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'pocketly_privacy_mode'
const PRIVACY_EVENT = 'pocketly_privacy_mode_changed'

let cachedState: boolean | null = null

function getPrivacySnapshot(): boolean {
  if (typeof window === 'undefined') return false
  if (cachedState !== null) return cachedState
  const val = localStorage.getItem(STORAGE_KEY)
  cachedState = val === 'true'
  return cachedState
}

function subscribePrivacy(callback: () => void) {
  const handler = () => {
    cachedState = null
    callback()
  }
  window.addEventListener(PRIVACY_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(PRIVACY_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

export function usePrivacyMode(): boolean {
  return useSyncExternalStore(subscribePrivacy, getPrivacySnapshot, () => false)
}

export function togglePrivacyMode(): boolean {
  if (typeof window === 'undefined') return false
  const current = getPrivacySnapshot()
  const next = !current
  localStorage.setItem(STORAGE_KEY, String(next))
  cachedState = next
  window.dispatchEvent(new Event(PRIVACY_EVENT))
  return next
}

export function setPrivacyMode(val: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, String(val))
  cachedState = val
  window.dispatchEvent(new Event(PRIVACY_EVENT))
}

/**
 * Masks formatted currency string into bullet dots while preserving signs and symbols.
 * Example:
 * "Rp 48.500.000" -> "Rp ••••••••"
 * "+Rp 15.000.000" -> "+Rp ••••••"
 * "-$ 420.00" -> "-$ ••••"
 */
export function maskCurrency(formatted: string, isPrivate: boolean): string {
  if (!isPrivate) return formatted

  const isNegative = formatted.startsWith('-')
  const isPositive = formatted.startsWith('+')
  const prefix = isNegative ? '-' : isPositive ? '+' : ''
  const clean = formatted.replace(/^[-+]/, '').trim()

  // Match currency prefix (e.g. "Rp", "$", "S$")
  const match = clean.match(/^([^\d\s]+|\b[A-Z]{2,3}\b)\s*/i)
  const symbol = match ? match[0] : ''

  return `${prefix}${symbol}••••••••`
}
