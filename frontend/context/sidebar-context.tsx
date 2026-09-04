"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SidebarContextType {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggleCollapse: () => void;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Desktop collapse state (default expanded on large screens, collapsed on medium)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  // Mobile drawer state (< 1024px)
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  // Read saved preference from localStorage on mount and handle responsive defaults
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mt_sidebar_collapsed");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      } else {
        // Auto-collapse on tablet screens (1024px - 1279px)
        if (window.innerWidth >= 1024 && window.innerWidth < 1280) {
          setIsCollapsed(true);
        }
      }

      // Auto-close mobile drawer on window resize to desktop
      const handleResize = () => {
        if (window.innerWidth >= 1024) {
          setIsMobileOpen(false);
        }
      };

      // Close mobile drawer on Escape key
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsMobileOpen(false);
        }
      };

      window.addEventListener("resize", handleResize);
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("mt_sidebar_collapsed", String(next));
      }
      return next;
    });
  };

  const openMobile = () => setIsMobileOpen(true);
  const closeMobile = () => setIsMobileOpen(false);
  const toggleMobile = () => setIsMobileOpen((prev) => !prev);

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        isMobileOpen,
        toggleCollapse,
        openMobile,
        closeMobile,
        toggleMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
