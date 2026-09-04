"use client";

import type { Citation } from "@/types";
import { FileText } from "lucide-react";
import { useLanguage } from "@/context/language-context";

interface Props {
  citation: Citation;
  index: number;
}

export function CitationCard({ citation, index }: Props) {
  const { t } = useLanguage();

  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-secondary)]">
      <FileText className="h-3 w-3 text-[var(--color-primary)] flex-shrink-0" />
      <span className="font-medium">[{index}]</span>
      <span className="truncate max-w-[180px]">{citation.manual}</span>
      {citation.page && (
        <span className="text-[var(--color-text-muted)]">{t("p.")}{citation.page}</span>
      )}
    </div>
  );
}
