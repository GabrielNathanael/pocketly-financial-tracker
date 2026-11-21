'use client'

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'pocketly_privacy_screen_v1'
const PRIVACY_SCREEN_EVENT = 'pocketly_privacy_screen_changed'

let cachedState: boolean | null = null

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false
  if (cachedState !== null) return cachedState
  cachedState = localStorage.getItem(STORAGE_KEY) === 'true'
  return cachedState
}

function subscribe(callback: () => void) {
  const handler = () => {
    cachedState = null
    callback()
  }
  window.addEventListener(PRIVACY_SCREEN_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(PRIVACY_SCREEN_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

export function usePrivacyScreenEnabled(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

export function setPrivacyScreenEnabled(value: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, String(value))
  cachedState = value
  window.dispatchEvent(new Event(PRIVACY_SCREEN_EVENT))
}
