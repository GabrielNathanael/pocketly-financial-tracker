"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { login } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  ArrowLeft,
  Lock,
  Mail,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"email" | "password" | null>(
    null,
  );

  const handleCopy = (text: string, field: "email" | "password") => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await login({ email, password });
      if (res?.error) {
        setError(res.error);
        setIsLoading(false);
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      const msg = (err as Error).message;
      if (msg && !msg.includes("NEXT_REDIRECT")) {
        setError(msg);
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-8 bg-canvas text-foreground">
      {/* Top Bar */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>
            {language === "id" ? "Kembali ke Beranda" : "Back to Home"}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          <button
            type="button"
            onClick={() => setLanguage(language === "id" ? "en" : "id")}
            className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {language === "id" ? "ID" : "EN"}
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6 flex flex-col gap-4">
        {/* Demo Account Credentials Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-warning-muted border border-warning/30 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-warning shrink-0" />
            <h2 className="text-xs font-bold text-warning">
              {language === "id"
                ? "Akun Demo Publik"
                : "Public Demo Account Access"}
            </h2>
          </div>
          <p className="text-[11px] text-warning/90 leading-relaxed">
            {language === "id"
              ? "Ingin mencoba langsung seluruh fitur Pocketly? Gunakan kredensial akun demo berikut untuk masuk:"
              : "Want to explore all Pocketly features? Use the public demo credentials below to sign in:"}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            {/* Email pill */}
            <div className="p-2.5 rounded-xl bg-surface/80 border border-warning/20 flex items-center justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-sans font-bold uppercase tracking-wider text-muted-foreground">
                  Email
                </span>
                <span className="font-bold text-foreground truncate select-all">
                  demo@pocketly.app
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy("demo@pocketly.app", "email")}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground transition-colors cursor-pointer shrink-0"
                title="Copy Email"
              >
                {copiedField === "email" ? (
                  <Check className="w-3.5 h-3.5 text-success" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Password pill */}
            <div className="p-2.5 rounded-xl bg-surface/80 border border-warning/20 flex items-center justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-sans font-bold uppercase tracking-wider text-muted-foreground">
                  Password
                </span>
                <span className="font-bold text-foreground select-all">
                  pocketlydemo123
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy("pocketlydemo123", "password")}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground transition-colors cursor-pointer shrink-0"
                title="Copy Password"
              >
                {copiedField === "password" ? (
                  <Check className="w-3.5 h-3.5 text-success" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Main Sign In Form Card */}
        <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-border shadow-xl flex flex-col gap-6 relative overflow-hidden">
          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center gap-2.5">
            <div className="relative">
              <Image
                src="/logo.png"
                alt="Pocketly Logo"
                width={56}
                height={56}
                className="w-14 h-14 object-contain drop-shadow-md"
                priority
              />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                {language === "id"
                  ? "Masuk ke Pocketly"
                  : "Sign in to Pocketly"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {language === "id"
                  ? "Masukkan kredensial akun untuk mengakses dashboard."
                  : "Enter your credentials to access the dashboard."}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {language === "id" ? "Alamat Email" : "Email Address"}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-foreground-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="demo@pocketly.app"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-canvas dark:bg-surface-subtle border border-border text-xs text-foreground focus:outline-none focus:border-border-strong transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {language === "id" ? "Kata Sandi" : "Password"}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-foreground-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-canvas dark:bg-surface-subtle border border-border text-xs text-foreground focus:outline-none focus:border-border-strong transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-destructive-muted border border-destructive/30 text-destructive text-xs font-semibold text-center">
                {error}
              </div>
            )}

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full py-2.5 h-auto font-bold text-xs rounded-xl mt-1"
            >
              {language === "id" ? "Masuk Sekarang" : "Sign In"}
            </Button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-md mx-auto flex items-center justify-center text-[11px] text-foreground-muted">
        Pocketly &copy; {new Date().getFullYear()} — Multi-Currency Financial
        Ledger
      </div>
    </div>
  );
}
