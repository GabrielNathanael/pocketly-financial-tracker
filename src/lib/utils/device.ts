/**
 * True on phones/tablets where `<input type="file" capture>` opens the
 * native camera directly (no permission prompt, no live stream).
 * Desktop/laptop browsers ignore `capture`, so they need getUserMedia.
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(pointer: coarse)").matches) return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}
