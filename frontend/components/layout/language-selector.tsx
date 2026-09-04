"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Globe,
  ChevronDown,
  Check,
  Search,
  Loader2,
  X,
  Languages,
} from "lucide-react";
import { useLanguage, SUPPORTED_LANGUAGES, LanguageOption } from "@/context/language-context";

export function LanguageSelector() {
  const { currentLanguage, setLanguage, isTranslating } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "Indian" | "Global">("all");
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
      setActiveTab("all");
    }
  }, [isOpen]);

  // Filter languages based on search query & active tab
  const filteredLanguages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return SUPPORTED_LANGUAGES.filter((lang) => {
      const matchesTab =
        activeTab === "all" || lang.region === activeTab;
      if (!matchesTab) return false;
      if (!q) return true;
      return (
        lang.name.toLowerCase().includes(q) ||
        lang.nativeName.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, activeTab]);

  const indianList = useMemo(
    () => filteredLanguages.filter((l) => l.region === "Indian"),
    [filteredLanguages]
  );
  const globalList = useMemo(
    () => filteredLanguages.filter((l) => l.region === "Global"),
    [filteredLanguages]
  );

  const renderFlag = (countryCode: string, name: string, className = "h-3.5 w-5") => {
    return (
      <img
        src={`https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`}
        srcSet={`https://flagcdn.com/w80/${countryCode.toLowerCase()}.png 2x`}
        alt={`${name} flag logo`}
        className={`rounded-xs object-cover shadow-xs border border-black/10 dark:border-white/10 flex-shrink-0 ${className}`}
        loading="lazy"
      />
    );
  };

  const renderLanguageItem = (lang: LanguageOption) => {
    const isSelected = lang.code === currentLanguage;
    return (
      <button
        key={lang.code}
        type="button"
        onClick={() => {
          setLanguage(lang.code);
          setIsOpen(false);
        }}
        className={`group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-all duration-150 ${
          isSelected
            ? "bg-[var(--color-primary)] text-white shadow-sm font-medium"
            : "text-[var(--color-text)] hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)]"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {renderFlag(lang.countryCode, lang.name, "h-3.5 w-5")}
          <div className="flex flex-col min-w-0">
            <span className="truncate font-medium leading-tight">
              {lang.nativeName}
            </span>
            <span
              className={`truncate text-[11px] ${
                isSelected ? "text-white/80" : "text-[var(--color-text-muted)]"
              }`}
            >
              {lang.name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase ${
              isSelected
                ? "bg-white/20 text-white"
                : "bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
            }`}
          >
            {lang.code}
          </span>
          {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
        </div>
      </button>
    );
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Properly Designed Main Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] shadow-sm hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-elevated)] hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
        title="Choose Language (70 Languages)"
        aria-expanded={isOpen}
      >
        {/* Globe / Spinner icon */}
        <div className="flex items-center justify-center rounded-lg bg-[var(--color-primary)]/10 p-1 text-[var(--color-primary)] group-hover:bg-[var(--color-primary)] group-hover:text-white transition-colors duration-200">
          {isTranslating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Globe className="h-3.5 w-3.5" />
          )}
        </div>

        {/* Real Country Flag Logo in front of language */}
        {renderFlag(currentLangObj.countryCode, currentLangObj.name, "h-3.5 w-5")}

        <span className="hidden sm:inline font-semibold">
          {currentLangObj.nativeName}
        </span>
        <span className="sm:hidden font-mono uppercase text-[11px]">
          {currentLangObj.code}
        </span>

        {/* Region badge */}
        <span className="hidden md:inline-flex rounded-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] px-1.5 py-0.2 text-[9px] text-[var(--color-text-muted)]">
          {currentLangObj.region === "Indian" ? "IN" : "Global"}
        </span>

        <ChevronDown
          className={`h-3 w-3 text-[var(--color-text-muted)] transition-transform duration-200 group-hover:text-[var(--color-text)] ${
            isOpen ? "rotate-180 text-[var(--color-primary)]" : ""
          }`}
        />
      </button>

      {/* Expanded Modal/Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 origin-top-right rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-2.5 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-2 pb-2 pt-1 border-b border-[var(--color-border)] mb-2">
            <div className="flex items-center gap-1.5">
              <Languages className="h-4 w-4 text-[var(--color-primary)]" />
              <span className="text-xs font-semibold text-[var(--color-text)]">
                Choose Language
              </span>
            </div>
            <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-primary)]">
              70 Languages (15 Indian + 55 Global)
            </span>
          </div>

          {/* Search Box */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by language, script or code..."
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-8 pr-7 text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 mb-2 bg-[var(--color-surface)] p-1 rounded-xl border border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`flex-1 rounded-lg py-1 text-center text-[11px] font-medium transition-all ${
                activeTab === "all"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              All (70)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("Indian")}
              className={`flex-1 rounded-lg py-1 text-center text-[11px] font-medium transition-all ${
                activeTab === "Indian"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              🇮🇳 Indian (15)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("Global")}
              className={`flex-1 rounded-lg py-1 text-center text-[11px] font-medium transition-all ${
                activeTab === "Global"
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              🌐 Global (55)
            </button>
          </div>

          {/* Languages Scrollable Container */}
          <div className="max-h-72 overflow-y-auto pr-1 space-y-3 scrollbar-thin">
            {filteredLanguages.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">
                No matching language found for &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              <>
                {/* Indian Languages Section */}
                {(activeTab === "all" || activeTab === "Indian") &&
                  indianList.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between px-2 py-1 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface)]/60 rounded-md">
                        <span>Indian Languages</span>
                        <span>{indianList.length}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {indianList.map(renderLanguageItem)}
                      </div>
                    </div>
                  )}

                {/* Global Languages Section */}
                {(activeTab === "all" || activeTab === "Global") &&
                  globalList.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between px-2 py-1 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface)]/60 rounded-md">
                        <span>Global Languages</span>
                        <span>{globalList.length}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {globalList.map(renderLanguageItem)}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>

          {/* Translating Indicator (Footer) */}
          {isTranslating && (
            <div className="mt-2 pt-2 border-t border-[var(--color-border)] flex items-center justify-center text-[11px] text-[var(--color-primary)] animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              <span>Translating page...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
