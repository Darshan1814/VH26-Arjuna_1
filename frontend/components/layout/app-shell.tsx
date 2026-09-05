"use client";

import React from "react";
import { useSidebar } from "@/context/sidebar-context";
import { Sidebar } from "@/components/layout/sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { MovableArjunaWidget } from "@/components/branding/movable-arjuna-widget";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="relative flex min-h-screen w-full overflow-x-hidden bg-[var(--color-bg)]">
      {/* Sidebar handles both desktop fixed (260px/72px) and mobile off-canvas drawer */}
      <Sidebar />

      {/* Main content column with dynamic left-padding */}
      <div
        className={`flex flex-col flex-1 min-w-0 w-full transition-[padding] duration-200 ease-in-out ${
          isCollapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"
        } pl-0`}
      >
        {/* Sticky App Header */}
        <AppHeader />

        {/* Dynamic Page Content */}
        <main id="main-content" className="flex-1 w-full min-w-0 flex flex-col">
          {children}
        </main>
      </div>

      {/* Floating Movable Circular Widget (draggable anywhere on page, click to open) */}
      <MovableArjunaWidget />
    </div>
  );
}
