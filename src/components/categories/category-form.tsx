"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Category, TransactionType } from "@/types/database";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/actions/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { useLanguage } from "@/lib/i18n/language-context";
import { toast } from "sonner";
import { Trash2, AlertCircle, ShieldCheck, Search, X } from "lucide-react";
import {
  formatCategoryName,
  getCanonicalCategoryName,
} from "@/lib/utils/category-i18n";
import { cn } from "@/lib/utils/cn";

interface CategoryFormProps {
  initialData?: Category | null;
  onSuccess?: () => void;
  onClose?: () => void;
}

// Curated set of icons that make sense for expense/income transaction
// categories, each paired with bilingual (EN/ID) search keywords and a
// bilingual category-group label. Every icon name here must exist as a
// named export in `lucide-react` since `DynamicIcon` resolves icons via
// direct property lookup on the module. Keywords + category let search go
// beyond the literal icon name — e.g. searching "makan" or "food" surfaces
// 'Utensils', and searching "kesehatan" or "health" surfaces the whole
// Health & Wellness group.
interface IconEntry {
  name: string;
  keywords: string[];
  category: { en: string; id: string };
}

const FOOD = { en: "Food & Dining", id: "Makanan & Minuman" };
const SHOPPING = { en: "Shopping & Retail", id: "Belanja" };
const TRANSPORT = { en: "Transport", id: "Transportasi" };
const HOUSING = { en: "Housing & Utilities", id: "Rumah & Tagihan" };
const HEALTH = { en: "Health & Wellness", id: "Kesehatan" };
const EDUCATION = { en: "Education", id: "Pendidikan" };
const ENTERTAINMENT = { en: "Entertainment & Leisure", id: "Hiburan" };
const TRAVEL = { en: "Travel", id: "Liburan & Perjalanan" };
const FAMILY = { en: "Family & Pets", id: "Keluarga & Hewan Peliharaan" };
const FINANCE = { en: "Finance & Income", id: "Keuangan & Pendapatan" };
const DIGITAL = { en: "Digital & Subscriptions", id: "Digital & Langganan" };
const MISC = { en: "Miscellaneous", id: "Lainnya" };

const AVAILABLE_ICONS: IconEntry[] = [
  // Food & dining
  {
    name: "Utensils",
    category: FOOD,
    keywords: [
      "food",
      "eat",
      "dining",
      "restaurant",
      "makan",
      "makanan",
      "restoran",
    ],
  },
  {
    name: "UtensilsCrossed",
    category: FOOD,
    keywords: ["food", "dining", "restaurant", "makan", "restoran"],
  },
  {
    name: "Coffee",
    category: FOOD,
    keywords: ["coffee", "cafe", "drink", "kopi", "ngopi", "minum"],
  },
  {
    name: "Pizza",
    category: FOOD,
    keywords: ["pizza", "food", "fast food", "makanan cepat saji"],
  },
  {
    name: "Beef",
    category: FOOD,
    keywords: ["meat", "food", "daging", "makan"],
  },
  { name: "Soup", category: FOOD, keywords: ["soup", "food", "sup", "makan"] },
  {
    name: "IceCreamCone",
    category: FOOD,
    keywords: ["ice cream", "dessert", "es krim", "jajan"],
  },
  {
    name: "CakeSlice",
    category: FOOD,
    keywords: ["cake", "birthday", "dessert", "kue", "ulang tahun"],
  },
  {
    name: "Beer",
    category: FOOD,
    keywords: ["beer", "alcohol", "drink", "bir", "minuman"],
  },
  {
    name: "Wine",
    category: FOOD,
    keywords: ["wine", "alcohol", "drink", "anggur", "minuman"],
  },
  {
    name: "ShoppingBasket",
    category: FOOD,
    keywords: ["groceries", "market", "belanja", "pasar", "sembako"],
  },

  // Shopping & retail
  {
    name: "ShoppingBag",
    category: SHOPPING,
    keywords: ["shopping", "retail", "belanja", "toko"],
  },
  {
    name: "ShoppingCart",
    category: SHOPPING,
    keywords: ["shopping", "cart", "groceries", "belanja", "keranjang"],
  },
  {
    name: "Shirt",
    category: SHOPPING,
    keywords: ["clothes", "clothing", "fashion", "baju", "pakaian"],
  },
  {
    name: "Gem",
    category: SHOPPING,
    keywords: ["jewelry", "luxury", "perhiasan", "mewah"],
  },
  {
    name: "Watch",
    category: SHOPPING,
    keywords: ["watch", "accessory", "jam tangan", "aksesori"],
  },
  {
    name: "Gift",
    category: SHOPPING,
    keywords: ["gift", "present", "donation", "hadiah", "kado"],
  },
  {
    name: "Package",
    category: SHOPPING,
    keywords: ["package", "delivery", "online shopping", "paket", "kiriman"],
  },
  {
    name: "Store",
    category: SHOPPING,
    keywords: ["store", "shop", "retail", "toko"],
  },
  {
    name: "Tag",
    category: MISC,
    keywords: ["tag", "label", "category", "kategori", "label"],
  },
  {
    name: "Tags",
    category: MISC,
    keywords: [
      "tags",
      "label",
      "category",
      "kategori",
      "label",
      "lainnya",
      "other",
    ],
  },

  // Transport
  {
    name: "Car",
    category: TRANSPORT,
    keywords: ["car", "vehicle", "drive", "mobil", "kendaraan"],
  },
  {
    name: "CarFront",
    category: TRANSPORT,
    keywords: ["car", "vehicle", "mobil", "kendaraan"],
  },
  {
    name: "Bus",
    category: TRANSPORT,
    keywords: ["bus", "public transport", "bis", "angkutan umum"],
  },
  {
    name: "Train",
    category: TRANSPORT,
    keywords: ["train", "commuter", "kereta"],
  },
  { name: "TrainFront", category: TRANSPORT, keywords: ["train", "kereta"] },
  {
    name: "Bike",
    category: TRANSPORT,
    keywords: ["bike", "bicycle", "motorcycle", "sepeda", "motor"],
  },
  {
    name: "Fuel",
    category: TRANSPORT,
    keywords: ["fuel", "gas", "petrol", "bensin", "bbm"],
  },
  {
    name: "ParkingCircle",
    category: TRANSPORT,
    keywords: ["parking", "parkir"],
  },
  {
    name: "Plane",
    category: TRANSPORT,
    keywords: ["flight", "travel", "airplane", "pesawat", "tiket pesawat"],
  },
  {
    name: "Ship",
    category: TRANSPORT,
    keywords: ["ship", "ferry", "boat", "kapal", "feri"],
  },
  {
    name: "Taxi",
    category: TRANSPORT,
    keywords: ["taxi", "ride hailing", "taksi", "ojek", "ojol"],
  },

  // Housing & utilities
  {
    name: "Home",
    category: HOUSING,
    keywords: ["home", "house", "rent", "rumah", "sewa", "kontrakan"],
  },
  {
    name: "Building2",
    category: HOUSING,
    keywords: [
      "apartment",
      "building",
      "office",
      "gedung",
      "apartemen",
      "kantor",
    ],
  },
  {
    name: "Zap",
    category: HOUSING,
    keywords: ["electricity", "power", "bill", "listrik", "tagihan"],
  },
  {
    name: "Flame",
    category: HOUSING,
    keywords: ["gas", "lpg", "utility", "gas elpiji"],
  },
  {
    name: "Droplet",
    category: HOUSING,
    keywords: ["water", "bill", "air", "tagihan air", "pdam"],
  },
  {
    name: "Wifi",
    category: HOUSING,
    keywords: ["internet", "wifi", "bill", "tagihan internet"],
  },
  {
    name: "Phone",
    category: HOUSING,
    keywords: ["phone", "call", "telepon", "pulsa"],
  },
  {
    name: "Smartphone",
    category: HOUSING,
    keywords: ["phone", "mobile", "gadget", "handphone", "hp", "gawai"],
  },
  {
    name: "Tv",
    category: HOUSING,
    keywords: ["tv", "television", "cable", "televisi"],
  },
  {
    name: "Lightbulb",
    category: HOUSING,
    keywords: ["electricity", "light", "idea", "lampu", "listrik"],
  },
  {
    name: "Wrench",
    category: HOUSING,
    keywords: [
      "repair",
      "maintenance",
      "service",
      "perbaikan",
      "servis",
      "bengkel",
    ],
  },
  {
    name: "Hammer",
    category: HOUSING,
    keywords: ["repair", "construction", "renovation", "perbaikan", "renovasi"],
  },
  {
    name: "Sofa",
    category: HOUSING,
    keywords: ["furniture", "home", "perabotan", "furnitur"],
  },

  // Health & wellness
  {
    name: "HeartPulse",
    category: HEALTH,
    keywords: ["health", "medical", "kesehatan", "medis"],
  },
  {
    name: "Stethoscope",
    category: HEALTH,
    keywords: ["doctor", "medical", "checkup", "dokter", "periksa"],
  },
  {
    name: "Pill",
    category: HEALTH,
    keywords: ["medicine", "pharmacy", "drugs", "obat", "apotek"],
  },
  {
    name: "Dumbbell",
    category: HEALTH,
    keywords: ["gym", "fitness", "workout", "olahraga", "kebugaran"],
  },
  {
    name: "Activity",
    category: HEALTH,
    keywords: ["health", "fitness", "sport", "kesehatan", "aktivitas"],
  },
  {
    name: "Cross",
    category: HEALTH,
    keywords: ["medical", "hospital", "first aid", "rumah sakit", "medis"],
  },
  {
    name: "Syringe",
    category: HEALTH,
    keywords: ["vaccine", "injection", "medical", "vaksin", "suntik"],
  },
  {
    name: "Glasses",
    category: HEALTH,
    keywords: ["glasses", "eyewear", "optical", "kacamata"],
  },

  // Education
  {
    name: "GraduationCap",
    category: EDUCATION,
    keywords: [
      "education",
      "school",
      "tuition",
      "pendidikan",
      "sekolah",
      "kuliah",
      "spp",
    ],
  },
  {
    name: "BookOpen",
    category: EDUCATION,
    keywords: ["book", "reading", "study", "buku", "belajar"],
  },
  {
    name: "Pencil",
    category: EDUCATION,
    keywords: ["stationery", "writing", "school supplies", "alat tulis"],
  },
  {
    name: "School",
    category: EDUCATION,
    keywords: ["school", "education", "sekolah", "pendidikan"],
  },
  {
    name: "Backpack",
    category: EDUCATION,
    keywords: ["school", "bag", "supplies", "tas sekolah", "perlengkapan"],
  },

  // Entertainment & leisure
  {
    name: "Film",
    category: ENTERTAINMENT,
    keywords: ["movie", "cinema", "entertainment", "film", "bioskop", "nonton"],
  },
  {
    name: "Music",
    category: ENTERTAINMENT,
    keywords: ["music", "streaming", "concert", "musik", "konser"],
  },
  {
    name: "Gamepad2",
    category: ENTERTAINMENT,
    keywords: ["game", "gaming", "entertainment", "permainan", "game online"],
  },
  {
    name: "Clapperboard",
    category: ENTERTAINMENT,
    keywords: ["movie", "streaming", "entertainment", "film", "hiburan"],
  },
  {
    name: "Ticket",
    category: ENTERTAINMENT,
    keywords: ["ticket", "event", "concert", "tiket", "acara"],
  },
  {
    name: "Palette",
    category: ENTERTAINMENT,
    keywords: ["art", "hobby", "creative", "seni", "hobi"],
  },
  {
    name: "Camera",
    category: ENTERTAINMENT,
    keywords: ["photography", "camera", "hobby", "fotografi", "kamera"],
  },
  {
    name: "Mic",
    category: ENTERTAINMENT,
    keywords: ["karaoke", "music", "hobby", "karaoke"],
  },
  {
    name: "PartyPopper",
    category: ENTERTAINMENT,
    keywords: ["party", "celebration", "event", "pesta", "perayaan"],
  },

  // Travel
  {
    name: "Luggage",
    category: TRAVEL,
    keywords: ["travel", "luggage", "trip", "liburan", "koper", "perjalanan"],
  },
  {
    name: "MapPin",
    category: TRAVEL,
    keywords: ["travel", "location", "trip", "lokasi", "perjalanan"],
  },
  {
    name: "Compass",
    category: TRAVEL,
    keywords: [
      "travel",
      "adventure",
      "exploration",
      "petualangan",
      "jalan-jalan",
    ],
  },
  {
    name: "Tent",
    category: TRAVEL,
    keywords: ["camping", "outdoor", "travel", "kemah", "berkemah"],
  },
  {
    name: "Umbrella",
    category: TRAVEL,
    keywords: [
      "insurance",
      "protection",
      "rain",
      "asuransi",
      "proteksi",
      "payung",
    ],
  },

  // Family & pets
  {
    name: "Baby",
    category: FAMILY,
    keywords: ["baby", "child", "family", "bayi", "anak", "keluarga"],
  },
  {
    name: "PawPrint",
    category: FAMILY,
    keywords: ["pet", "animal", "hewan peliharaan", "binatang"],
  },
  {
    name: "Users",
    category: FAMILY,
    keywords: ["family", "friends", "social", "keluarga", "teman", "sosial"],
  },
  {
    name: "UserRound",
    category: FAMILY,
    keywords: ["person", "personal", "individual", "pribadi", "personal"],
  },
  {
    name: "Heart",
    category: FAMILY,
    keywords: ["love", "charity", "donation", "kasih", "donasi", "amal"],
  },

  // Finance & income
  {
    name: "Wallet",
    category: FINANCE,
    keywords: ["wallet", "cash", "money", "dompet", "uang", "tunai"],
  },
  {
    name: "Banknote",
    category: FINANCE,
    keywords: ["cash", "money", "salary", "uang", "gaji", "tunai"],
  },
  {
    name: "Coins",
    category: FINANCE,
    keywords: ["coins", "money", "change", "koin", "uang receh"],
  },
  {
    name: "CreditCard",
    category: FINANCE,
    keywords: [
      "credit card",
      "debit card",
      "payment",
      "kartu kredit",
      "kartu debit",
      "pembayaran",
    ],
  },
  {
    name: "DollarSign",
    category: FINANCE,
    keywords: ["money", "income", "salary", "uang", "gaji", "pendapatan"],
  },
  {
    name: "TrendingUp",
    category: FINANCE,
    keywords: [
      "income",
      "profit",
      "growth",
      "investment",
      "pendapatan",
      "untung",
      "investasi",
    ],
  },
  {
    name: "TrendingDown",
    category: FINANCE,
    keywords: ["loss", "decline", "expense", "rugi", "penurunan"],
  },
  {
    name: "PiggyBank",
    category: FINANCE,
    keywords: ["savings", "saving", "tabungan", "menabung"],
  },
  {
    name: "Landmark",
    category: FINANCE,
    keywords: ["bank", "government", "tax", "bank", "pajak", "pemerintah"],
  },
  {
    name: "Receipt",
    category: FINANCE,
    keywords: ["receipt", "invoice", "bill", "struk", "nota", "tagihan"],
  },
  {
    name: "HandCoins",
    category: FINANCE,
    keywords: ["loan", "debt", "lend", "borrow", "pinjaman", "utang", "hutang"],
  },
  {
    name: "Briefcase",
    category: FINANCE,
    keywords: [
      "work",
      "job",
      "business",
      "salary",
      "kerja",
      "pekerjaan",
      "bisnis",
      "gaji",
    ],
  },
  {
    name: "BarChart3",
    category: FINANCE,
    keywords: ["investment", "stocks", "chart", "investasi", "saham"],
  },
  {
    name: "LineChart",
    category: FINANCE,
    keywords: [
      "investment",
      "stocks",
      "trading",
      "investasi",
      "saham",
      "trading",
    ],
  },
  {
    name: "Percent",
    category: FINANCE,
    keywords: ["interest", "discount", "tax", "bunga", "diskon", "pajak"],
  },

  // Digital & subscriptions
  {
    name: "Laptop",
    category: DIGITAL,
    keywords: [
      "computer",
      "work",
      "electronics",
      "komputer",
      "laptop",
      "elektronik",
    ],
  },
  {
    name: "Monitor",
    category: DIGITAL,
    keywords: ["computer", "electronics", "komputer", "elektronik"],
  },
  {
    name: "Cloud",
    category: DIGITAL,
    keywords: ["cloud storage", "subscription", "penyimpanan", "langganan"],
  },
  {
    name: "Download",
    category: DIGITAL,
    keywords: [
      "app",
      "software",
      "digital purchase",
      "aplikasi",
      "pembelian digital",
    ],
  },
  {
    name: "Send",
    category: DIGITAL,
    keywords: ["transfer", "send money", "kirim", "transfer uang"],
  },
  {
    name: "Newspaper",
    category: DIGITAL,
    keywords: [
      "news",
      "subscription",
      "magazine",
      "berita",
      "langganan",
      "majalah",
    ],
  },

  // Misc / general
  {
    name: "Shield",
    category: MISC,
    keywords: [
      "insurance",
      "protection",
      "security",
      "asuransi",
      "proteksi",
      "keamanan",
    ],
  },
  {
    name: "Scale",
    category: MISC,
    keywords: [
      "balance",
      "adjustment",
      "reconciliation",
      "saldo",
      "penyesuaian",
      "rekonsiliasi",
    ],
  },
  {
    name: "Sparkles",
    category: MISC,
    keywords: ["misc", "other", "special", "lainnya", "khusus"],
  },
  {
    name: "Star",
    category: MISC,
    keywords: ["favorite", "special", "premium", "favorit", "spesial"],
  },
  {
    name: "Flag",
    category: MISC,
    keywords: ["goal", "milestone", "target", "tujuan", "pencapaian"],
  },
  {
    name: "HelpCircle",
    category: MISC,
    keywords: ["unknown", "other", "misc", "tidak diketahui", "lainnya"],
  },
];

export function CategoryForm({
  initialData,
  onSuccess,
  onClose,
}: CategoryFormProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const isEditing = !!initialData;

  const [name, setName] = useState(initialData?.name || "");
  const [type, setType] = useState<TransactionType>(
    initialData?.type || "expense",
  );
  const [icon, setIcon] = useState<string>(initialData?.icon || "Tags");
  const [iconSearch, setIconSearch] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canonicalName = getCanonicalCategoryName(initialData?.name || "");
  const isSystemProtected =
    canonicalName === "Discrepancy" ||
    canonicalName === "Loan & Debt" ||
    canonicalName === "Transfer Fee" ||
    canonicalName === "Savings";

  // Filter icons by search query. Matches against the icon's literal name,
  // its bilingual (EN/ID) keyword list, AND its bilingual category-group
  // name — so e.g. "makan" surfaces Utensils (keyword match), while
  // "kesehatan" or "health" surfaces the entire Health & Wellness group
  // (category match), even though none of those icons literally say "health".
  const filteredIcons = useMemo(() => {
    const q = iconSearch.trim().toLowerCase();
    if (!q) return AVAILABLE_ICONS;
    return AVAILABLE_ICONS.filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) ||
        entry.keywords.some((kw) => kw.toLowerCase().includes(q)) ||
        entry.category.en.toLowerCase().includes(q) ||
        entry.category.id.toLowerCase().includes(q),
    );
  }, [iconSearch]);

  // Group filtered results by category so the picker can render section
  // headers (both while browsing and while a search narrows the results).
  const groupedIcons = useMemo(() => {
    const groups = new Map<string, { label: string; icons: IconEntry[] }>();
    for (const entry of filteredIcons) {
      const label = language === "en" ? entry.category.en : entry.category.id;
      const existing = groups.get(label);
      if (existing) {
        existing.icons.push(entry);
      } else {
        groups.set(label, { label, icons: [entry] });
      }
    }
    return Array.from(groups.values());
  }, [filteredIcons, language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t.categories.nameLabel + " is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (isEditing && initialData) {
        const res = await updateCategory(initialData.id, {
          name: isSystemProtected ? canonicalName : name,
          type,
          icon,
        });
        if (res.error) {
          setError(res.error);
          return;
        }
        toast.success(
          language === "en"
            ? "Category updated successfully"
            : "Kategori berhasil diperbarui",
        );
      } else {
        const res = await createCategory({
          name,
          type,
          icon,
        });
        if (res.error) {
          setError(res.error);
          return;
        }
        toast.success(
          language === "en"
            ? "Category created successfully"
            : "Kategori berhasil dibuat",
        );
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/categories");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData) return;
    setIsDeleting(true);
    setShowDeleteConfirm(false);
    setError(null);

    try {
      const res = await deleteCategory(initialData.id);
      if (res.error) {
        setError(res.error);
      } else {
        toast.success(
          language === "en"
            ? "Category deleted successfully"
            : "Kategori berhasil dihapus",
        );
        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/categories");
        }
      }
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* Type Toggle */}
      {!isEditing && (
        <div className="grid grid-cols-2 p-1 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-lg border border-[#E5E7EB] dark:border-[#27272A]">
          <button
            type="button"
            onClick={() => setType("expense")}
            className={cn(
              "py-2 rounded-md font-bold text-xs transition-colors cursor-pointer text-center",
              type === "expense"
                ? "bg-[#E11D48] text-white"
                : "text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]",
            )}
          >
            {t.quickAdd.expense}
          </button>
          <button
            type="button"
            onClick={() => setType("income")}
            className={cn(
              "py-2 rounded-md font-bold text-xs transition-colors cursor-pointer text-center",
              type === "income"
                ? "bg-[#0D9488] text-white"
                : "text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]",
            )}
          >
            {t.quickAdd.income}
          </button>
        </div>
      )}

      {isSystemProtected ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.categories.nameLabel}
            </label>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
              <ShieldCheck className="w-3 h-3" />
              {language === "en" ? "System Protected" : "Kategori Sistem"}
            </span>
          </div>
          <input
            type="text"
            value={formatCategoryName(name, language)}
            disabled
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#64748B] dark:text-[#94A3B8] font-bold opacity-80 cursor-not-allowed"
          />
        </div>
      ) : (
        <Input
          label={t.categories.nameLabel}
          type="text"
          placeholder={t.categories.namePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      )}

      {/* Icon Picker with Search */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {t.categories.iconLabel}
        </label>

        <Input
          type="text"
          placeholder={language === "en" ? "Search icons..." : "Cari ikon..."}
          value={iconSearch}
          onChange={(e) => setIconSearch(e.target.value)}
          leftIcon={<Search className="w-3.5 h-3.5" />}
          rightIcon={
            iconSearch ? (
              <button
                type="button"
                onClick={() => setIconSearch("")}
                className="pointer-events-auto cursor-pointer hover:text-[#0F172A] dark:hover:text-[#FAFAFA]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : undefined
          }
          className="text-xs"
        />

        {groupedIcons.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#94A3B8]">
            {language === "en"
              ? "No icons match your search."
              : "Tidak ada ikon yang cocok."}
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-h-52 overflow-y-auto p-0.5">
            {groupedIcons.map((group) => (
              <div key={group.label} className="flex flex-col gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8] px-0.5">
                  {group.label}
                </span>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                  {group.icons.map((entry) => (
                    <button
                      key={entry.name}
                      type="button"
                      onClick={() => setIcon(entry.name)}
                      title={entry.name}
                      className={cn(
                        "p-2 rounded-lg border flex items-center justify-center transition-colors cursor-pointer",
                        icon === entry.name
                          ? "border-[#0F172A] bg-[#0F172A] text-white dark:border-[#FAFAFA] dark:bg-[#FAFAFA] dark:text-[#0F172A]"
                          : "border-[#E5E7EB] dark:border-[#27272A] bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F3F5] dark:hover:bg-[#26262E]",
                      )}
                    >
                      <DynamicIcon name={entry.name} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2">
        {isEditing && !isSystemProtected && (
          <Button
            type="button"
            variant="danger"
            onClick={() => setShowDeleteConfirm(true)}
            className="px-3"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
        <Button type="submit" isLoading={isLoading} className="flex-1">
          {isEditing ? t.categories.saveBtn : t.categories.createBtn}
        </Button>
      </div>

      {isEditing && !isSystemProtected && (
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          isLoading={isDeleting}
          title={t.categories.deleteConfirmTitle}
          message={t.categories.deleteConfirmMsg}
        />
      )}
    </form>
  );
}
