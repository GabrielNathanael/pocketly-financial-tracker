import { Avatar, Style } from "@dicebear/core";
import micahDef from "@dicebear/styles/micah.json" with { type: "json" };
import bigSmileDef from "@dicebear/styles/big-smile.json" with { type: "json" };

/**
 * Avatar ilustrasi (DiceBear) yang di-generate di browser.
 * - Seed disimpan di database, bukan gambarnya -> avatar kecil & selalu sama.
 * - Nggak ada request ke server pihak ketiga (nama peserta nggak keluar dari device).
 */

export const AVATAR_STYLE_IDS = ["micah", "big-smile"] as const;

export type AvatarStyleId = (typeof AVATAR_STYLE_IDS)[number];

const STYLE_DEFS: Record<AvatarStyleId, unknown> = {
  micah: micahDef,
  "big-smile": bigSmileDef,
};

/** Style yang dipakai kalau peserta belum memilih avatar. */
export const DEFAULT_AVATAR_STYLE: AvatarStyleId = "micah";

/**
 * Seed per style. Tiap style berisi 4 cowok + 4 cewek.
 * Semua seed sudah dicek manual (render + lihat):
 *  - SELALU punya rambut (nggak ada yang botak)
 *  - ekspresinya positif/neutral (nggak ada yang mengekrut / mengerutu / sedih)
 */
export const AVATAR_SEEDS_BY_STYLE: Record<AvatarStyleId, readonly string[]> = {
  // 4 cowok
  micah: [
    "avatar-22",
    "avatar-36",
    "avatar-39",
    "avatar-67",
    // 4 cewek
    "avatar-5",
    "avatar-24",
    "avatar-38",
    "avatar-51",
  ],
  // 4 cowok
  "big-smile": [
    "avatar-8",
    "avatar-11",
    "avatar-41",
    "avatar-46",
    // 4 cewek
    "avatar-12",
    "avatar-13",
    "avatar-52",
    "avatar-56",
  ],
};

export type AvatarRef = { style: string | null; seed: string | null };

export function isAvatarStyleId(value: unknown): value is AvatarStyleId {
  return typeof value === "string" && (AVATAR_STYLE_IDS as readonly string[]).includes(value);
}

/** Opsi avatar untuk picker: 2 style x 8 seed = 16 pilihan. */
export function buildAvatarOptions(): AvatarRef[] {
  const out: AvatarRef[] = [];
  for (const style of AVATAR_STYLE_IDS) {
    for (const seed of AVATAR_SEEDS_BY_STYLE[style]) {
      out.push({ style, seed });
    }
  }
  return out;
}

/** Avatar default (kalau belum ada yang dipilih): style + seed dari nama. */
export function defaultAvatarFor(name: string): AvatarRef {
  const n = (name || "").trim() || "pocketly";
  let h = 0;
  for (let i = 0; i < n.length; i++) {
    h = (h << 5) - h + n.charCodeAt(i);
    h |= 0;
  }
  const abs = Math.abs(h);
  const style = AVATAR_STYLE_IDS[abs % AVATAR_STYLE_IDS.length];
  const seeds = AVATAR_SEEDS_BY_STYLE[style];
  const seed = seeds[Math.floor(abs / AVATAR_STYLE_IDS.length) % seeds.length];
  return { style, seed };
}

const cache = new Map<string, string>();

/** Generate SVG string untuk (style, seed). Metadata dibuang biar ringan. */
export function renderAvatarSvg(styleId?: string | null, seed?: string | null): string {
  const style = isAvatarStyleId(styleId) ? styleId : DEFAULT_AVATAR_STYLE;
  const s = seed || "pocketly";
  const key = `${style}::${s}`;
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const avatar = new Avatar(new Style(STYLE_DEFS[style] as never), { seed: s, size: 120 });
    const svg = avatar
      .toString()
      //_metadata berat & gak perlu
      .replace(/<metadata[\s\S]*?<\/metadata>/, "")
      // pastikan ikut ngikutin ukuran container
      .replace("<svg ", '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet" ');
    cache.set(key, svg);
    return svg;
  } catch {
    return "";
  }
}
