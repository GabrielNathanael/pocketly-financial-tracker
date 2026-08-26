import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { LanguageProvider } from "@/lib/i18n/language-context";
import { UndoProvider } from "@/lib/context/undo-context";
import { UndoSnackbar } from "@/components/ui/undo-snackbar";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Pocketly - Personal Financial Ledger",
  description: "Precision personal finance and liquidity management platform.",
  icons: {
    icon: [
      { url: "/logo.png", sizes: "any" },
      { url: "/logo.png", type: "image/png" },
    ],
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pocketly",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${jakartaSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-[#F8F9FA] dark:bg-[#09090B] text-[#0F172A] dark:text-[#F8FAFC] font-sans antialiased selection:bg-[#0F172A] selection:text-white dark:selection:bg-white dark:selection:text-[#0F172A]">
        <ThemeProvider>
          <LanguageProvider>
            <UndoProvider>
              {children}
              <UndoSnackbar />
              <Toaster
                position="top-center"
                richColors
                closeButton
                toastOptions={{
                  className: "!font-sans !text-xs !rounded-xl !shadow-xl",
                }}
              />
            </UndoProvider>
          </LanguageProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
