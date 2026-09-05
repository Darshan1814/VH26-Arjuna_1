import React from "react";
import { DownloadCloud, Trash2, Loader2, Check } from "lucide-react";
import { FetchStep } from "../types";

interface ControlButtonsProps {
  onFetch: () => void;
  onClear: () => void;
  fetchStep: FetchStep;
  hasExtractedContent: boolean;
  disabled?: boolean;
}

export const ControlButtons: React.FC<ControlButtonsProps> = ({
  onFetch,
  onClear,
  fetchStep,
  hasExtractedContent,
  disabled = false,
}) => {
  const isBusy =
    fetchStep === "fetching" ||
    fetchStep === "extracting" ||
    fetchStep === "cleaning" ||
    fetchStep === "chunking";

  const getFetchLabel = () => {
    switch (fetchStep) {
      case "fetching":
        return "Fetching page...";
      case "extracting":
        return "Extracting content...";
      case "cleaning":
        return "Cleaning content...";
      case "chunking":
        return "Building knowledge context...";
      case "ready":
        return "FETCHED ✓";
      case "failed":
        return "FETCH FAILED";
      default:
        return "FETCH";
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {/* Primary FETCH Button */}
        <button
          type="button"
          onClick={onFetch}
          disabled={isBusy || disabled}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
            fetchStep === "ready"
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-indigo-600 hover:bg-indigo-700 text-white"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Extract and understand the active webpage content"
        >
          {isBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : fetchStep === "ready" ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <DownloadCloud className="h-3.5 w-3.5" />
          )}
          <span>{getFetchLabel()}</span>
        </button>

        {/* Primary CLEAR Button */}
        <button
          type="button"
          onClick={onClear}
          disabled={isBusy || (!hasExtractedContent && fetchStep === "idle")}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 dark:hover:border-rose-800 transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="Clear extracted text, chunks, and conversation for this page"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>CLEAR</span>
        </button>
      </div>

      {/* Real multi-phase step status bar */}
      {isBusy && (
        <div className="rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 p-2 space-y-1 animate-fade-in">
          <div className="flex items-center justify-between text-[10px] text-indigo-700 dark:text-indigo-300 font-medium">
            <span>Pipeline Progress:</span>
            <span className="capitalize font-semibold">{fetchStep}...</span>
          </div>
          <div className="w-full bg-indigo-200 dark:bg-indigo-900 h-1 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
              style={{
                width:
                  fetchStep === "fetching"
                    ? "25%"
                    : fetchStep === "extracting"
                    ? "50%"
                    : fetchStep === "cleaning"
                    ? "75%"
                    : "95%",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
