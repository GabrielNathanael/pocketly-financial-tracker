'use client'

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'

export interface PendingDeleteAction {
  id: string
  title: string
  onExecuteDelete: () => Promise<void>
  onUndo?: () => void
}

interface UndoContextType {
  pendingAction: PendingDeleteAction | null
  queueDelete: (action: PendingDeleteAction) => void
  undo: () => void
  dismiss: () => void
  isPendingDelete: (id: string) => boolean
}

const UndoContext = createContext<UndoContextType | undefined>(undefined)

const UNDO_DURATION_MS = 5000

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [pendingAction, setPendingAction] = useState<PendingDeleteAction | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingActionRef = useRef<PendingDeleteAction | null>(null)

  pendingActionRef.current = pendingAction

  // Function to finalize and execute the actual backend delete
  const executePendingDelete = useCallback(async () => {
    const action = pendingActionRef.current
    if (!action) return

    setPendingAction(null)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    try {
      await action.onExecuteDelete()
    } catch (err) {
      console.error('[UndoProvider] Failed to execute pending delete:', err)
    }
  }, [])

  // Queue a new delete action
  const queueDelete = useCallback((action: PendingDeleteAction) => {
    // If there is already a pending delete, flush and execute the previous one immediately
    if (pendingActionRef.current) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      pendingActionRef.current.onExecuteDelete().catch(console.error)
    }

    setPendingAction(action)

    // Schedule final deletion after duration
    timerRef.current = setTimeout(() => {
      executePendingDelete()
    }, UNDO_DURATION_MS)
  }, [executePendingDelete])

  // Undo current pending delete
  const undo = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (pendingActionRef.current?.onUndo) {
      pendingActionRef.current.onUndo()
    }

    setPendingAction(null)
  }, [])

  // Dismiss snackbar and execute delete immediately
  const dismiss = useCallback(() => {
    executePendingDelete()
  }, [executePendingDelete])

  const isPendingDelete = useCallback((id: string) => {
    return pendingAction?.id === id
  }, [pendingAction])

  // Ensure any pending delete is flushed to server if the user navigates away or closes tab
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingActionRef.current) {
        pendingActionRef.current.onExecuteDelete().catch(console.error)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      if (pendingActionRef.current) {
        pendingActionRef.current.onExecuteDelete().catch(console.error)
      }
    }
  }, [])

  return (
    <UndoContext.Provider
      value={{
        pendingAction,
        queueDelete,
        undo,
        dismiss,
        isPendingDelete,
      }}
    >
      {children}
    </UndoContext.Provider>
  )
}

export function useUndo() {
  const context = useContext(UndoContext)
  if (!context) {
    throw new Error('useUndo must be used within an UndoProvider')
  }
  return context
}
