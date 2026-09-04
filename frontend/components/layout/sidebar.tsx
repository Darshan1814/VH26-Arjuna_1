"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  GitBranch,
  Wrench,
  HelpCircle,
  Camera,
  X,
  Mic,
  BookOpen,
  Film,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { useSidebar } from "@/context/sidebar-context";
import { ArjunaSarthiLogo } from "@/components/branding/arjuna-sarthi-logo";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { isCollapsed, isMobileOpen, closeMobile, toggleCollapse } = useSidebar();

  const navLinks = [
    {
      href: "/chat",
      label: t("Chatbot"),
      icon: MessageSquare,
      isExternal: false,
      desc: "Interactive troubleshooting",
    },
    {
      href: "/arjuna-sarthi",
      label: t("Arjuna Sarthi"),
      icon: null,
      isCustomLogo: true,
      badge: "NEW EXT",
      isExternal: false,
      desc: "AI Web Intelligence Extension",
    },
    {
      href: "/what-if",
      label: t("What-If Simulator"),
      icon: HelpCircle,
      isExternal: false,
      desc: "Failure mode simulation",
    },
    {
      href: "/image-analysis",
      label: t("Image Analysis"),
      icon: Camera,
      isExternal: false,
      desc: "OCR & visual error solving",
    },
    {
      href: "/voice-assistant",
      label: t("Voice Assistant"),
      icon: Mic,
      isExternal: false,
      desc: "Multilingual voice AI (मराठी, हिंदी, English)",
    },
    {
      href: "/error-research",
      label: t("Error Research"),
      icon: BookOpen,
      isExternal: false,
      desc: "IEEE papers & OEM service bulletins",
    },
    {
      href: "/document-intelligence",
      label: t("Doc & Video Intelligence"),
      icon: Film,
      isExternal: false,
      desc: "Doc roadmap & YouTube video cards",
    },
    {
      href: "/process-flow",
      label: t("Process Flow"),
      icon: GitBranch,
      isExternal: false,
      desc: "Observable 8-stage pipeline",
    },
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={closeMobile}
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        aria-label="Sidebar Navigation"
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-[width,transform] duration-200 ease-in-out ${
          // Mobile state: off-canvas drawer (< 1024px)
          isMobileOpen
            ? "translate-x-0 w-[280px] shadow-2xl"
            : "-translate-x-full lg:translate-x-0"
        } ${
          // Desktop state (>= 1024px): 260px expanded vs 72px collapsed
          isCollapsed ? "lg:w-[72px]" : "lg:w-[260px]"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-3.5 sm:px-4 flex-shrink-0">
          <Link
            href="/"
            onClick={closeMobile}
            className="flex items-center gap-2.5 font-bold text-[var(--color-text)] group overflow-hidden"
            title="Machine Troubleshooter"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white shadow-xs group-hover:scale-105 transition-transform flex-shrink-0">
              <Wrench className="h-4 w-4" />
            </div>

            {/* Title visible only when expanded or on mobile drawer */}
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex flex-col min-w-0 transition-opacity duration-150">
                <span className="text-xs font-bold tracking-tight text-[var(--color-text)] truncate">
                  Troubleshooter
                </span>
                <span className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider truncate">
                  Industrial AI
                </span>
              </div>
            )}
          </Link>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={closeMobile}
            className="lg:hidden p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)] transition"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Desktop mini toggle button inside header when expanded */}
          {!isCollapsed && (
            <button
              type="button"
              onClick={toggleCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)] transition cursor-pointer"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation Links List */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
          {(!isCollapsed || isMobileOpen) && (
            <div className="px-2 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Features & Tools
            </div>
          )}

          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            const isDesktopIconOnly = isCollapsed && !isMobileOpen;

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMobile}
                title={isDesktopIconOnly ? `${link.label} — ${link.desc}` : undefined}
                className={`relative flex items-center rounded-xl transition duration-150 group ${
                  isDesktopIconOnly
                    ? "justify-center p-2.5"
                    : "gap-3 px-3 py-2.5 text-xs font-medium"
                } ${
                  isActive
                    ? "bg-[var(--color-primary)] text-white shadow-xs font-semibold"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text)]"
                }`}
              >
                {/* Icon Container */}
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 transition-colors ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] group-hover:bg-[var(--color-border)] group-hover:text-[var(--color-text)]"
                  }`}
                >
                  {link.isCustomLogo ? (
                    <ArjunaSarthiLogo size="sm" animate={true} />
                  ) : (
                    link.icon && <link.icon className="h-4 w-4" />
                  )}
                </div>

                {/* Text Label & Description */}
                {(!isCollapsed || isMobileOpen) && (
                  <div className="flex flex-col min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className={`truncate font-semibold ${isActive ? "text-white" : "text-[var(--color-text)]"}`}>
                        {link.label}
                      </span>
                      {link.badge && (
                        <span className="px-1 py-0.2 rounded text-[8px] font-extrabold bg-amber-400/20 text-amber-500 border border-amber-400/40 tracking-wider">
                          {link.badge}
                        </span>
                      )}
                    </div>
                    <span
                      className={`truncate text-[10px] ${
                        isActive ? "text-white/80" : "text-[var(--color-text-muted)]"
                      }`}
                    >
                      {link.desc}
                    </span>
                  </div>
                )}

                {/* Tooltip on hover when desktop is collapsed */}
                {isDesktopIconOnly && (
                  <div className="absolute left-full ml-2.5 hidden group-hover:flex flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 py-1.5 shadow-md z-50 whitespace-nowrap pointer-events-none">
                    <span className="text-xs font-bold text-[var(--color-text)]">{link.label}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">{link.desc}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer Info & Desktop Expand/Collapse Trigger */}
        <div className="border-t border-[var(--color-border)] p-2.5 flex-shrink-0 bg-[var(--color-surface-elevated)]/40">
          {isCollapsed && !isMobileOpen ? (
            /* Icon-only mode bottom toggle */
            <button
              type="button"
              onClick={toggleCollapse}
              className="w-full flex h-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-elevated)] transition cursor-pointer"
              title="Expand sidebar (260px)"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4 text-[var(--color-primary)]" />
            </button>
          ) : (
            /* Expanded mode status pill */
            <div className="flex items-center justify-between gap-2 px-1 py-1 text-[10px] text-[var(--color-text-secondary)]">
              <div className="flex items-center gap-1.5 truncate">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <span className="font-semibold text-[var(--color-text)] truncate">System Ready</span>
              </div>
              <button
                type="button"
                onClick={toggleCollapse}
                className="hidden lg:flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition cursor-pointer"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
