"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Search, Loader2, X } from "lucide-react";
import { useLanguage, SUPPORTED_LANGUAGES, LanguageOption } from "@/context/language-context";

export function LanguageSelector() {
  const { currentLanguage, setLanguage, isTranslating } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentLangObj = useMemo(
    () =>
      SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) ||
      SUPPORTED_LANGUAGES.find((l) => l.code === "en") ||
      SUPPORTED_LANGUAGES[0],
    [currentLanguage]
  );

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Auto-focus search input upon opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Single unified list filtered by search query
  const filteredLanguages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SUPPORTED_LANGUAGES;
    return SUPPORTED_LANGUAGES.filter(
      (lang) =>
        lang.name.toLowerCase().includes(q) ||
        lang.nativeName.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Clean Single Dropdown Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text)] shadow-xs hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-elevated)] transition-colors focus:outline-none"
        title="Select Language (70 Available)"
        aria-expanded={isOpen}
      >
        {isTranslating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-primary)]" />
        ) : (
          <img
            src={`https://flagcdn.com/w40/${currentLangObj.countryCode.toLowerCase()}.png`}
            srcSet={`https://flagcdn.com/w80/${currentLangObj.countryCode.toLowerCase()}.png 2x`}
            alt={currentLangObj.name}
            className="h-3.5 w-5 rounded-xs object-cover border border-black/10 dark:border-white/10"
          />
        )}
        <span className="font-medium">{currentLangObj.nativeName}</span>
        <ChevronDown
          className={`h-3 w-3 text-[var(--color-text-muted)] transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Single Clean Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-64 origin-top-right rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] shadow-xl backdrop-blur-md z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Search Box */}
          <div className="p-2 border-b border-[var(--color-border)]">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--color-text-muted)]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 70 languages..."
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-8 pr-7 text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Single Unified List of all 70 languages */}
          <div className="max-h-72 overflow-y-auto p-1 space-y-0.5 scrollbar-thin">
            {filteredLanguages.length === 0 ? (
              <div className="py-6 text-center text-xs text-[var(--color-text-muted)]">
                No matching language found
              </div>
            ) : (
              filteredLanguages.map((lang) => {
                const isSelected = lang.code === currentLanguage;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setLanguage(lang.code);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${
                      isSelected
                        ? "bg-[var(--color-primary)] text-white font-medium shadow-xs"
                        : "text-[var(--color-text)] hover:bg-[var(--color-surface)]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={`https://flagcdn.com/w40/${lang.countryCode.toLowerCase()}.png`}
                        srcSet={`https://flagcdn.com/w80/${lang.countryCode.toLowerCase()}.png 2x`}
                        alt={lang.name}
                        className="h-3.5 w-5 rounded-xs object-cover border border-black/10 dark:border-white/10 flex-shrink-0"
                        loading="lazy"
                      />
                      <span className="truncate font-medium">{lang.nativeName}</span>
                      <span
                        className={`text-[11px] truncate ${
                          isSelected
                            ? "text-white/80"
                            : "text-[var(--color-text-muted)]"
                        }`}
                      >
                        ({lang.name})
                      </span>
                    </div>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 flex-shrink-0 ml-1.5 text-white" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
