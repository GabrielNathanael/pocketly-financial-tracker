'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  className,
}: BottomSheetProps) {
  const [dragOffset, setDragOffset] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [isClosing, setIsClosing] = useState<boolean>(false)

  const startYRef = useRef<number>(0)
  const currentYRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const isDraggingRef = useRef<boolean>(false)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setDragOffset(0)
      setIsClosing(false)
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleDragStart = useCallback((clientY: number) => {
    startYRef.current = clientY
    currentYRef.current = clientY
    startTimeRef.current = Date.now()
    isDraggingRef.current = true
    setIsDragging(true)
  }, [])

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDraggingRef.current) return
    const deltaY = clientY - startYRef.current
    if (deltaY > 0) {
      // Resistance factor when pulling down
      setDragOffset(deltaY)
      currentYRef.current = clientY
    } else {
      setDragOffset(0)
    }
  }, [])

  const handleDragEnd = useCallback(() => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    setIsDragging(false)

    const deltaY = currentYRef.current - startYRef.current
    const deltaTime = Date.now() - startTimeRef.current
    const velocity = deltaY / Math.max(deltaTime, 1)

    // If dragged down > 80px or swiped down quickly (velocity > 0.5)
    if (deltaY > 80 || (velocity > 0.5 && deltaY > 30)) {
      setIsClosing(true)
      setTimeout(() => {
        onClose()
        setDragOffset(0)
        setIsClosing(false)
      }, 200)
    } else {
      setDragOffset(0)
    }
  }, [onClose])

  // Touch event handlers for mobile
  const onTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY)
  }

  const onTouchEnd = () => {
    handleDragEnd()
  }

  if (!isOpen) return null

  // Backdrop opacity fades slightly as user pulls down
  const backdropOpacity = Math.max(0.2, 1 - (dragOffset / 300) * 0.7)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center p-0 md:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F172A]/70 dark:bg-black/80 transition-opacity duration-200"
        style={{ opacity: backdropOpacity }}
        onClick={onClose}
      />

      {/* Sheet Container */}
      <div
        className={cn(
          'relative w-full max-w-lg bg-white dark:bg-[#121215] border-t md:border border-[#E5E7EB] dark:border-[#27272A] rounded-t-2xl md:rounded-xl shadow-2xl z-10 h-[88vh] md:h-auto max-h-[94vh] flex flex-col overflow-hidden will-change-transform',
          !isDragging && 'transition-transform duration-200 ease-out',
          className
        )}
        style={{
          transform: isClosing
            ? 'translateY(100%)'
            : dragOffset > 0
            ? `translateY(${dragOffset}px)`
            : undefined,
        }}
      >
        {/* Mobile handle indicator with generous touch target */}
        <div
          className="flex flex-col items-center pt-3 pb-2 md:hidden cursor-grab active:cursor-grabbing touch-none select-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-12 h-1.5 bg-[#CBD5E1] dark:bg-[#334155] rounded-full active:scale-95 transition-transform" />
        </div>

        {/* Header - Also draggable on touch */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-[#E5E7EB] dark:border-[#27272A] select-none touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <h3 className="font-bold text-sm sm:text-base text-[#0F172A] dark:text-[#F8FAFC]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] rounded-md hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="px-5 py-4 overflow-y-auto pb-8 md:pb-5">{children}</div>
      </div>
    </div>
  )
}
