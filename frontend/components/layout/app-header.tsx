"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Wrench,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  ShieldCheck,
} from "lucide-react";
import { useSidebar } from "@/context/sidebar-context";
import { useTheme } from "@/components/theme/theme-provider";
import { useLanguage } from "@/context/language-context";
import { LanguageSelector } from "@/components/layout/language-selector";

export function AppHeader() {
  const pathname = usePathname();
  const { isCollapsed, toggleCollapse, toggleMobile } = useSidebar();
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useLanguage();

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  // Get human-readable title from pathname
  const getPageTitle = (path: string) => {
    switch (path) {
      case "/chat":
        return t("Chatbot Diagnostic");
      case "/arjuna-sarthi":
        return t("Arjuna Sarthi Web Intelligence");
      case "/what-if":
        return t("What-If Failure Simulator");
      case "/image-analysis":
        return t("Image Analysis & OCR");
      case "/voice-assistant":
        return t("Voice Assistant");
      case "/error-research":
        return t("Error Research & OEM Papers");
      case "/document-intelligence":
        return t("Document & Video Intelligence");
      case "/process-flow":
        return t("Diagnostic Process Flow");
      default:
        if (path.startsWith("/reports/")) {
          return t("Diagnostic Report Preview");
        }
        return "MachFixAI";
    }
  };

  const pageTitle = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 px-3 sm:px-5 backdrop-blur-md transition-colors">
      {/* Left side: Hamburger (mobile) or Sidebar collapse toggle (desktop) + Page title */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={toggleMobile}
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text)] hover:border-[var(--color-primary)] transition cursor-pointer flex-shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Desktop collapse toggle */}
        <button
          type="button"
          onClick={toggleCollapse}
          className="hidden lg:flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)] transition cursor-pointer flex-shrink-0"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4 text-[var(--color-primary)]" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>

        {/* Title and breadcrumb */}
        <div className="flex items-center gap-2 truncate">
          <Link
            href="/"
            className="flex items-center gap-1.5 font-bold text-[var(--color-text)] lg:hidden flex-shrink-0"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 p-0.5 shadow-xs flex-shrink-0 overflow-hidden">
              <img
                src="/logo.png"
                alt="MachFixAI Logo"
                className="h-full w-full object-contain rounded-md"
              />
            </div>
          </Link>
          <div className="flex flex-col justify-center min-w-0">
            <h1 className="text-sm font-bold text-[var(--color-text)] truncate leading-tight">
              {pageTitle}
            </h1>
            <span className="hidden sm:inline text-[10px] text-[var(--color-text-muted)] font-medium truncate">
              {t("MachFixAI Industrial Diagnostic Platform")}
            </span>
          </div>
        </div>
      </div>

      {/* Right side: Status indicator + Language Selector + Theme Toggle */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* System Online Badge (desktop) */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>{t("Diagnostic System Online")}</span>
        </div>

        {/* Language selector */}
        <div className="flex-shrink-0">
          <LanguageSelector />
        </div>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)] transition cursor-pointer flex-shrink-0"
          title={t("Toggle dark/light theme")}
          aria-label={t("Toggle theme")}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4 text-amber-500" />
          ) : (
            <Moon className="h-4 w-4 text-neutral-600" />
          )}
        </button>
      </div>
    </header>
  );
}
