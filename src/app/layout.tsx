import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { LanguageProvider } from "@/lib/i18n/language-context";
import { UndoProvider } from "@/lib/context/undo-context";
import { UndoSnackbar } from "@/components/ui/undo-snackbar";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { TimezoneCookieSync } from "@/components/layout/timezone-cookie-sync";
import { PinnedTemplatesAuthSync } from "@/lib/storage/pinned-templates-auth-sync";
import { AppLockGate } from "@/components/app-lock/app-lock-gate";
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
      { url: "/favicon/favicon.ico" },
      { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    shortcut: "/favicon/favicon.ico",
    apple: [
      {
        url: "/favicon/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pocketly",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFAFB" },
    { media: "(prefers-color-scheme: dark)", color: "#171318" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const appLockHint = cookieStore.get("pocketly_app_lock")?.value === "1";

  return (
    <html
      lang="id"
      className={`${jakartaSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-canvas text-foreground font-sans antialiased selection:bg-primary selection:text-primary-foreground">
        <ThemeProvider>
          <LanguageProvider>
            <UndoProvider>
              <AppLockGate initialLocked={appLockHint}>
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
              </AppLockGate>
            </UndoProvider>
          </LanguageProvider>
        </ThemeProvider>
        <PinnedTemplatesAuthSync />
        <TimezoneCookieSync />
        <Analytics />
        <PwaRegister />
      </body>
    </html>
  );
}
