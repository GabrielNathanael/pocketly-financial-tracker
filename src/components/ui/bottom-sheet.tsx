"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  className,
}: BottomSheetProps) {
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(isOpen);
  const [isEntered, setIsEntered] = useState<boolean>(false);
  const [isEntering, setIsEntering] = useState<boolean>(isOpen);

  const startYRef = useRef<number>(0);
  const currentYRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const enterFrameRef = useRef<number | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeSheet = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = setTimeout(onClose, 200);
  }, [isClosing, onClose]);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      document.body.style.overflow = "hidden";
      setDragOffset(0);
      setIsClosing(false);
      setIsEntered(false);
      setIsEntering(true);
      const frame = requestAnimationFrame(() => {
        enterFrameRef.current = requestAnimationFrame(() =>
          setIsEntered(true),
        );
      });
      const enterTimer = setTimeout(() => setIsEntering(false), 300);
      enterFrameRef.current = frame;
      return () => {
        cancelAnimationFrame(frame);
        clearTimeout(enterTimer);
        if (enterFrameRef.current !== null) {
          cancelAnimationFrame(enterFrameRef.current);
          enterFrameRef.current = null;
        }
      };
    } else {
      document.body.style.overflow = "unset";
      setIsEntered(false);
      setIsClosing(true);
      const timeout = setTimeout(() => setIsMounted(false), 200);
      return () => clearTimeout(timeout);
    }
    return () => {
      document.body.style.overflow = "unset";
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [isOpen]);

  const handleDragStart = useCallback((clientY: number) => {
    startYRef.current = clientY;
    currentYRef.current = clientY;
    startTimeRef.current = Date.now();
    isDraggingRef.current = true;
    setIsDragging(true);
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDraggingRef.current) return;
    const deltaY = clientY - startYRef.current;
    if (deltaY > 0) {
      // Resistance factor when pulling down
      setDragOffset(deltaY);
      currentYRef.current = clientY;
    } else {
      setDragOffset(0);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    const deltaY = currentYRef.current - startYRef.current;
    const deltaTime = Date.now() - startTimeRef.current;
    const velocity = deltaY / Math.max(deltaTime, 1);

    // If dragged down > 80px or swiped down quickly (velocity > 0.5)
    if (deltaY > 80 || (velocity > 0.5 && deltaY > 30)) {
      closeSheet();
    } else {
      setDragOffset(0);
    }
  }, [closeSheet]);

  // Touch event handlers for mobile
  const onTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY);
  };

  const onTouchEnd = () => {
    handleDragEnd();
  };

  if (!isMounted) return null;

  // Backdrop opacity fades slightly as user pulls down
  const backdropOpacity = Math.max(0.2, 1 - (dragOffset / 300) * 0.7);

  return createPortal(
    (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center p-0 md:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F172A]/70 dark:bg-black/80 transition-opacity duration-200 ease-out"
        style={{ opacity: isEntered ? backdropOpacity : 0 }}
        onClick={closeSheet}
      />

      {/* Sheet Container */}
      <div
        className={cn(
          "relative w-full max-w-lg bg-white dark:bg-[#121215] border-t md:border border-[#E5E7EB] dark:border-[#27272A] rounded-t-2xl md:rounded-xl shadow-2xl z-10 max-h-[88dvh] md:h-auto flex flex-col overflow-hidden will-change-transform",
          !isDragging && !isEntering && "transition-transform duration-200 ease-out",
          isEntering && !isDragging && "bottom-sheet-enter",
          className,
        )}
        style={{
          transform:
            isClosing
              ? "translateY(100vh)"
              : dragOffset > 0
                ? `translateY(${dragOffset}px)`
                : undefined,
          transition: isClosing
            ? "transform 200ms ease-in"
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
            onClick={closeSheet}
            className="p-1 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] rounded-md hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 flex flex-col min-h-0 px-5 py-4 overflow-y-auto overscroll-contain pb-8 md:pb-5">
          {children}
        </div>
      </div>
    </div>
    ),
    document.body,
  );
}
