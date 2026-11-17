let lockCount = 0;
let previousOverflow: string | null = null;

export function lockBodyScroll() {
  if (typeof document === "undefined") return;

  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  lockCount += 1;
}

export function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) return;

  lockCount -= 1;

  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow ?? "";
    previousOverflow = null;
  }
}

// Test/helper utility: force-reset lock state (useful if a stale lock is detected in dev)
export function resetBodyScrollLock() {
  if (typeof document === "undefined") return;
  lockCount = 0;
  document.body.style.overflow = previousOverflow ?? "";
  previousOverflow = null;
}
