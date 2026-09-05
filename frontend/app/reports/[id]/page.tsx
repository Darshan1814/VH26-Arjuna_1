"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Download, ArrowLeft, Printer, ExternalLink, FileText, Loader2 } from "lucide-react";
import { getReportMeta } from "@/lib/api";
import { useLanguage } from "@/context/language-context";

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params?.id as string;
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>(null);

  useEffect(() => {
    if (!reportId) return;

    getReportMeta(reportId)
      .then((data) => {
        setMeta(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load report");
        setLoading(false);
      });
  }, [reportId]);

  return (
    <div className="w-full flex-1 py-6 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[1600px] mx-auto space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-lg border p-2 hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition cursor-pointer"
            title={t("Go back")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-neutral-200 dark:bg-neutral-800 text-[var(--color-text)] font-mono text-[10px] px-2 py-0.5 font-bold">
                {t("REPORT")} #{reportId}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {t("Industrial Diagnostic Documentation")}
              </span>
            </div>
            <h1 className="text-lg font-bold text-[var(--color-text)]">
              {t("Diagnostic Report Preview")}
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            {t("Print")}
          </button>

          <a
            href={`/api/reports/${reportId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-xs flex items-center gap-1.5 px-3 py-1.5 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            {t("Download PDF")}
          </a>

          <a
            href={`/api/reports/${reportId}/html`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5 cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("Full Screen")}
          </a>
        </div>
      </div>

      {/* Main Report View Area */}
      {loading ? (
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
            <span>{t("Loading diagnostic report")} #{reportId}...</span>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/20 p-6 text-center space-y-2">
          <FileText className="h-8 w-8 text-red-500 mx-auto" />
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">{t("Report Unavailable")}</p>
          <p className="text-xs text-red-600 dark:text-red-300">{error}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-white shadow-sm overflow-hidden min-h-[600px] flex-1">
          <iframe
            src={`/api/reports/${reportId}/html`}
            title={`Report ${reportId}`}
            className="w-full h-[750px] border-0"
          />
        </div>
      )}
      </div>
    </div>
  );
}
