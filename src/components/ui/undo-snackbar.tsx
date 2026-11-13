'use client'

import React, { useEffect, useState } from 'react'
import { useUndo } from '@/lib/context/undo-context'
import { useLanguage } from '@/lib/i18n/language-context'
import { Undo2, X, Trash2 } from 'lucide-react'

export function UndoSnackbar() {
  const { pendingAction, undo, dismiss } = useUndo()
  const { t } = useLanguage()
  const [progressKey, setProgressKey] = useState(0)
  const [isClosing, setIsClosing] = useState(false)

  // Reset countdown animation key whenever a new delete action is queued
  useEffect(() => {
    if (!pendingAction) return
    queueMicrotask(() => {
      setIsClosing(false)
      setProgressKey((prev) => prev + 1)
    })
  }, [pendingAction])

  if (!pendingAction) return null

  const handleUndo = () => {
    setIsClosing(true)
    setTimeout(() => {
      undo()
    }, 150)
  }

  const handleDismiss = () => {
    setIsClosing(true)
    setTimeout(() => {
      dismiss()
    }, 150)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-50 bottom-20 md:bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-auto md:min-w-85 md:max-w-md pointer-events-none"
    >
      <div
        className={`pointer-events-auto relative overflow-hidden rounded-2xl border border-border-inverse/40 bg-surface-inverse/95 text-foreground-inverse shadow-2xl backdrop-blur-xl px-4 py-3 flex items-center justify-between gap-3.5 ${
          isClosing ? 'animate-pop-out' : 'animate-pop-in'
        }`}
      >
        {/* Left Icon & Message */}
        <div className="flex items-center gap-2.5 min-w-0 pr-1">
          <div className="w-7 h-7 rounded-lg bg-foreground-inverse/10 text-foreground-inverse/80 border border-foreground-inverse/20 flex items-center justify-center shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-foreground-inverse truncate">
              {pendingAction.title || t.undo.transactionDeleted}
            </span>
            <span className="text-[10px] text-foreground-inverse/70 truncate">
              {t.undo.transactionDeleted}
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleUndo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-surface text-foreground hover:bg-canvas active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{t.undo.undoBtn}</span>
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close"
            className="p-1.5 rounded-lg text-foreground-inverse/70 hover:text-foreground-inverse hover:bg-foreground-inverse/10 active:scale-90 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Linear Countdown Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground-inverse/10 overflow-hidden">
          <div
            key={progressKey}
            className="h-full bg-foreground-inverse/50 origin-left"
            style={{
              animation: 'shrinkWidth 5s linear forwards',
            }}
          />
        </div>
      </div>

      <style jsx>{`
        .animate-pop-in {
          animation: popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .animate-pop-out {
          animation: popOut 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes popIn {
          0% {
            opacity: 0;
            transform: translateY(28px) scale(0.9);
          }
          70% {
            opacity: 1;
            transform: translateY(-3px) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes popOut {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(16px) scale(0.94);
          }
        }

        @keyframes shrinkWidth {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  )
}
