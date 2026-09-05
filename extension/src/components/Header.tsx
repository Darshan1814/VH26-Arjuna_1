import React from "react";
import { Settings } from "lucide-react";
import { ArjunaSarthiLogo } from "./ArjunaSarthiLogo";

interface HeaderProps {
  onOpenSettings: () => void;
  backendConnected: boolean;
  activeModel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  backendConnected,
  activeModel,
}) => {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 py-2.5 backdrop-blur-sm">
      {/* Brand Identity */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Mahabharat 'A' with 4-Layer Floating Orbit */}
        <ArjunaSarthiLogo size="sm" animate={true} />

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-xs tracking-wider text-slate-900 dark:text-white uppercase">
              Arjuna Sarthi
            </span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-tight truncate">
            AI Web Intelligence
          </span>
        </div>
      </div>

      {/* Right Controls: Model indicator & Settings */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
            backendConnected
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
          }`}
          title={
            backendConnected
              ? `Connected to AI Engine (${activeModel || "Neural Model"})`
              : "Backend disconnected - check settings"
          }
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              backendConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          <span className="hidden sm:inline truncate max-w-[80px]">
            {backendConnected ? "AI Ready" : "Offline"}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition"
          title="Extension Configuration & Diagnostics"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
