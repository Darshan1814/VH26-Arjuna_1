"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, GitBranch, Sun, Moon, Wrench } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";
import { useLanguage } from "@/context/language-context";
import { LanguageSelector } from "@/components/layout/language-selector";

export function Navbar() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme, theme } = useTheme();
  const { t } = useLanguage();

  const toggleTheme = () => {
    if (theme === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  };

  const navLinks = [
    { href: "/chat", label: t("Chatbot"), icon: MessageSquare },
    { href: "/process-flow", label: t("Process Flow"), icon: GitBranch },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-[var(--color-surface-elevated)] backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo / App Name */}
        <Link href="/" className="flex items-center gap-2 font-semibold text-[var(--color-text)]">
          <Wrench className="h-5 w-5 text-[var(--color-primary)]" />
          <span className="hidden sm:inline">{t("Machine Troubleshooter")}</span>
          <span className="sm:hidden">MT</span>
        </Link>

        {/* Navigation & Controls */}
        <nav className="flex items-center gap-2">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}

          <div className="flex items-center gap-1.5 ml-1 border-l border-[var(--color-border)] pl-2">
            {/* Language Selector Dropdown */}
            <LanguageSelector />

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] transition-colors duration-150"
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
