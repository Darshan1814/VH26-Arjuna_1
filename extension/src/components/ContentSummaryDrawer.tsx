import React, { useState } from "react";
import { ChevronDown, ChevronRight, Layers, FileCode } from "lucide-react";
import { ExtractedPage } from "../types";

interface ContentSummaryDrawerProps {
  extractedPage: ExtractedPage;
}

export const ContentSummaryDrawer: React.FC<ContentSummaryDrawerProps> = ({
  extractedPage,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const { metadata, sections } = extractedPage;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2.5 text-left text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer"
      >
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Fetched Content Structure</span>
          <span className="text-[10px] text-slate-500 font-normal">
            ({sections.length} sections)
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="p-3 pt-0 border-t border-slate-100 dark:border-slate-800/60 space-y-2 text-xs">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-1.5 py-2 text-center text-[10px]">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-1.5 border border-slate-200/50 dark:border-slate-700/50">
              <span className="block text-slate-400">Words</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {metadata.wordCount.toLocaleString()}
              </span>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-1.5 border border-slate-200/50 dark:border-slate-700/50">
              <span className="block text-slate-400">Sections</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {metadata.sectionCount}
              </span>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-1.5 border border-slate-200/50 dark:border-slate-700/50">
              <span className="block text-slate-400">Headings</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {metadata.headingCount}
              </span>
            </div>
          </div>

          {/* Section Headings List */}
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Detected Sections:
            </span>
            {sections.slice(0, 12).map((sec, i) => (
              <div
                key={sec.id || i}
                className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-600 dark:text-slate-300"
              >
                <span className="truncate font-medium flex items-center gap-1">
                  <span className="text-slate-400 text-[9px] font-mono">H{sec.level}</span>
                  <span className="truncate">{sec.heading}</span>
                </span>
                <span className="text-[9px] text-slate-400 font-mono ml-2 flex-shrink-0">
                  {sec.wordCount}w
                </span>
              </div>
            ))}
            {sections.length > 12 && (
              <div className="text-[10px] text-slate-400 italic text-center pt-1">
                + {sections.length - 12} more sections indexed
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
