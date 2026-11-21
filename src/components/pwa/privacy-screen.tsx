'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { usePrivacyScreenEnabled } from '@/lib/storage/privacy-screen'
import { getPrivacyMode, setPrivacyMode } from '@/lib/storage/privacy-mode'

/**
 * Best-effort privacy cover for the OS "recent apps" snapshot.
 *
 * The task-switcher thumbnail is captured by Android/iOS, not by the web page,
 * so a PWA cannot control it directly. What we CAN do is cover the document
 * synchronously on `visibilitychange` / `pagehide`, before the OS snapshot is
 * taken, and momentarily force the existing privacy mode so amounts are masked
 * even if a stale frame slips through. The previous privacy-mode value is
 * restored when the app becomes visible again.
 */
export function PrivacyScreen() {
  const enabled = usePrivacyScreenEnabled()
  const [covered, setCovered] = useState(false)

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => setCovered(false))
      return
    }

    let previousPrivacy: boolean | null = null

    const cover = () => {
      if (previousPrivacy === null) previousPrivacy = getPrivacyMode()
      setPrivacyMode(true)
      setCovered(true)
    }

    const reveal = () => {
      setCovered(false)
      if (previousPrivacy !== null) {
        setPrivacyMode(previousPrivacy)
        previousPrivacy = null
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') cover()
      else reveal()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', cover)
    window.addEventListener('pageshow', reveal)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', cover)
      window.removeEventListener('pageshow', reveal)
      if (previousPrivacy !== null) {
        setPrivacyMode(previousPrivacy)
        previousPrivacy = null
      }
    }
  }, [enabled])

  if (!enabled || !covered) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 bg-canvas text-foreground"
      aria-hidden="true"
    >
      <Image
        src="/logo.png"
        alt="Pocketly"
        width={72}
        height={72}
        className="w-18 h-18 object-contain"
        priority
      />
      <span className="text-lg font-black tracking-tight">Pocketly</span>
      <span className="text-xs font-mono text-foreground-muted">••••••••</span>
    </div>
  )
}
