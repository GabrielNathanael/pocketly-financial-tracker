'use client'

import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  maxWidth = 'md',
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Crisp Solid Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F172A]/70 dark:bg-black/80 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div
        className={cn(
          'relative w-full bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] rounded-xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh]',
          maxWidths[maxWidth],
          className
        )}
      >
        {(title || description) && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] dark:border-[#27272A]">
            <div>
              {title && (
                <h3 className="font-bold text-base text-[#0F172A] dark:text-[#F8FAFC]">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] p-1 rounded-md hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
