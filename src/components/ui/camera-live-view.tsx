"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Images, Loader2, RefreshCw, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "@/lib/i18n/language-context";

type FacingMode = "environment" | "user";

interface CameraLiveViewProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the captured photo. */
  onCapture: (file: File) => void | Promise<void>;
  /** Open the device gallery / file picker. */
  onPickImage: () => void;
  /** Error message shown over the view (e.g. camera unavailable). */
  error?: string | null;
  /** Called when the camera fails to start (or starts successfully). */
  onError?: (message: string | null) => void;
  /** Retry opening the camera. */
  onRetry?: () => void;
  /** Extra content rendered on top of the view (thumbnails, primary actions...). */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Full-screen live camera view (iOS camera style):
 * floating circular controls over the live preview — close (top-left),
 * switch camera (top-right), gallery (bottom-left), shutter (bottom-center),
 * flash (bottom-right). No heavy chrome, so the camera feed stays dominant.
 */
export function CameraLiveView({
  isOpen,
  onClose,
  onCapture,
  onPickImage,
  error,
  onError,
  onRetry,
  children,
  className,
}: CameraLiveViewProps) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [isStarting, setIsStarting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  const shownError = error ?? internalError;

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(
    async (facing: FacingMode) => {
      stopStream();
      setTorchOn(false);
      setTorchAvailable(false);
      setInternalError(null);
      onError?.(null);
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        const msg = t.quickAdd.cameraNotSupported;
        setInternalError(msg);
        onError?.(msg);
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
          // Desktop webcams usually ignore facingMode — retry with plain video.
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
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as
          | (MediaTrackCapabilities & { torch?: boolean })
          | undefined;
        if (caps && typeof caps.torch === "boolean") {
          setTorchAvailable(caps.torch);
        }
      } catch (err: unknown) {
        const name = err instanceof DOMException ? err.name : "";
        const msg =
          name === "NotAllowedError"
            ? t.quickAdd.cameraPermissionDenied
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? t.quickAdd.cameraNotFound
              : t.quickAdd.cameraOpenFailed;
        setInternalError(msg);
        onError?.(msg);
      } finally {
        setIsStarting(false);
      }
    },
    [t, stopStream, onError],
  );

  useEffect(() => {
    if (isOpen) {
      // Deferred to a microtask so the camera start (and the state updates
      // it triggers) does not run synchronously inside the effect body.
      void Promise.resolve().then(() => startCamera(facingMode));
    } else {
      stopStream();
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || isCapturing) return;
    setIsCapturing(true);
    try {
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
      await onCapture(file);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const handleToggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      // Torch not controllable — ignore silently.
    }
  };

  const circleBtn =
    "w-12 h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/40 text-white flex items-center justify-center active:bg-black/50 transition-colors disabled:opacity-40";

  return createPortal(
    <div className={cn("fixed inset-0 z-[80] bg-black", className)}>
      {/* Live preview fills the whole screen */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {isStarting && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-white" />
        </div>
      )}

      {shownError && (
        <div className="absolute inset-x-0 top-1/2 mx-auto w-[min(92%,26rem)] -translate-y-1/2 rounded-2xl bg-black/55 p-5 text-center backdrop-blur-md">
          <p className="text-sm font-medium text-white">{shownError}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 h-10 px-4 rounded-full border border-white/60 text-sm font-semibold text-white active:bg-white/15"
            >
              {t.quickAdd.cameraTitle}
            </button>
          )}
        </div>
      )}

      {/* Top-left: close */}
      <button
        type="button"
        onClick={onClose}
        aria-label={t.common.close}
        className={cn(circleBtn, "absolute left-4 top-[max(1rem,env(safe-area-inset-top))]")}
      >
        <X className="h-5 w-5" />
      </button>

      {/* Top-right: switch camera */}
      <button
        type="button"
        onClick={handleSwitchCamera}
        aria-label={t.quickAdd.switchCamera}
        title={t.quickAdd.switchCamera}
        className={cn(circleBtn, "absolute right-4 top-[max(1rem,env(safe-area-inset-top))]")}
      >
        <RefreshCw className="h-5 w-5" />
      </button>

      {/* Extra overlay content */}
      {children}

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
        <button
          type="button"
          onClick={onPickImage}
          aria-label={t.quickAdd.uploadFromDevice}
          title={t.quickAdd.uploadFromDevice}
          className={cn(circleBtn, "w-14 h-14")}
        >
          <Images className="h-6 w-6" />
        </button>

        <button
          type="button"
          onClick={handleCapture}
          disabled={isStarting || isCapturing || !!shownError}
          aria-label={t.quickAdd.capture}
          title={t.quickAdd.capture}
          className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[5px] border-white bg-transparent active:scale-95 transition-transform disabled:opacity-40"
        >
          <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-white">
            {isCapturing && (
              <Loader2 className="h-6 w-6 animate-spin text-[#0F172A]" />
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={handleToggleTorch}
          disabled={!torchAvailable}
          aria-label="Flash"
          className={cn(
            circleBtn,
            "w-14 h-14",
            torchOn && "bg-white text-black border-white",
            !torchAvailable && "opacity-0 pointer-events-none",
          )}
        >
          <Zap className="h-6 w-6" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
