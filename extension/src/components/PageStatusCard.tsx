import React from "react";
import { FileText, Globe, AlertCircle, ExternalLink, CheckCircle2 } from "lucide-react";
import { ExtractedPage, FetchStep } from "../types";

interface PageStatusCardProps {
  currentUrl: string;
  currentTitle: string;
  extractedPage: ExtractedPage | null;
  fetchStep: FetchStep;
}

export const PageStatusCard: React.FC<PageStatusCardProps> = ({
  currentUrl,
  currentTitle,
  extractedPage,
  fetchStep,
}) => {
  const isFetched = fetchStep === "ready" && extractedPage !== null;
  const isProcessing =
    fetchStep === "fetching" ||
    fetchStep === "extracting" ||
    fetchStep === "cleaning" ||
    fetchStep === "chunking";

  // Format domain cleanly
  let domain = "";
  try {
    if (currentUrl && currentUrl.startsWith("http")) {
      domain = new URL(currentUrl).hostname;
    } else {
      domain = currentUrl ? "Browser Page" : "No active page";
    }
  } catch {
    domain = "Browser Page";
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 shadow-xs space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 flex-shrink-0">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3
              className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate"
              title={currentTitle || "Active Webpage"}
            >
              {currentTitle || "Detecting active tab..."}
            </h3>
            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
              <Globe className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{domain}</span>
            </div>
          </div>
        </div>

        {currentUrl && currentUrl.startsWith("http") && (
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 flex-shrink-0"
            title="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Dynamic Status Pill */}
      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Status:</span>
        <div className="flex items-center gap-1.5">
          {isFetched ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>
                Page fetched • {extractedPage.metadata.sectionCount} sections •{" "}
                {extractedPage.metadata.wordCount.toLocaleString()} words
              </span>
            </span>
          ) : isProcessing ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-semibold text-[10px] animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span>Extracting page...</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span>Ready to fetch</span>
            </span>
          )}
        </div>
      </div>

      {/* Document Viewer Warning (if native PDF embed) */}
      {extractedPage?.metadata.documentViewerWarning && (
        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-[10px] text-amber-800 dark:text-amber-300">
          <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <span>{extractedPage.metadata.documentViewerWarning}</span>
        </div>
      )}
    </div>
  );
};
