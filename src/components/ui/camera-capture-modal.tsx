"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Loader2, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "@/lib/i18n/language-context";

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void | Promise<void>;
}

type FacingMode = "environment" | "user";

/**
 * Webcam capture modal for desktop/laptop.
 * `<input type=file capture>` is silently ignored on desktop browsers
 * (they fall back to a file picker), so "Take photo" needs getUserMedia
 * to actually open the webcam on laptop. This modal sits above the
 * BottomSheet (z-[60]) and does NOT touch body overflow — the parent
 * sheet already locks scrolling.
 */
export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
}: CameraCaptureModalProps) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(
    async (facing: FacingMode) => {
      stopStream();
      setError(null);
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setError(t.quickAdd.cameraNotSupported);
        return;
      }
      setIsStarting(true);
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facing }, width: { ideal: 1600 } },
            audio: false,
          });
        } catch {
          // Desktop webcams often ignore facingMode — retry plain video.
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
      } catch (err: unknown) {
        const name = err instanceof DOMException ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? t.quickAdd.cameraPermissionDenied
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? t.quickAdd.cameraNotFound
              : t.quickAdd.cameraOpenFailed,
        );
      } finally {
        setIsStarting(false);
      }
    },
    [t, stopStream],
  );

  useEffect(() => {
    if (isOpen) {
      void startCamera(facingMode);
    } else {
      stopStream();
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) return;
    const file = new File([blob], `receipt-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    stopStream();
    await onCapture(file);
    onClose();
  };

  const handleSwitchCamera = () => {
    const next: FacingMode =
      facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    void startCamera(next);
  };

  const handleClose = () => {
    stopStream();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-[#0F172A]/80 dark:bg-black/90"
        onClick={handleClose}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-2xl dark:border-[#27272A] dark:bg-[#121215]">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-3 dark:border-[#27272A]">
          <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            {t.quickAdd.cameraTitle}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-[#94A3B8] transition-colors hover:bg-[#F1F3F5] hover:text-[#0F172A] dark:hover:bg-[#1A1A20] dark:hover:text-[#F8FAFC]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-col gap-3 p-4">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4 text-center">
                <p className="text-xs font-medium text-white">{error}</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleSwitchCamera}
              disabled={isStarting || !!error}
              title={t.quickAdd.switchCamera}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCapture}
            disabled={isStarting || !!error}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F172A] py-3 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50 dark:bg-[#FAFAFA] dark:text-[#0F172A]",
            )}
          >
            <Camera className="h-4 w-4" />
            {t.quickAdd.capture}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
