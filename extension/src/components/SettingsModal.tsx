import React, { useState, useEffect } from "react";
import { X, CheckCircle2, AlertCircle, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { checkBackendHealth, getBackendBaseUrl, DEFAULT_BACKEND_URL } from "../services/api";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [url, setUrl] = useState(DEFAULT_BACKEND_URL);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: "idle" | "success" | "error";
    message: string;
    model?: string;
  }>({ status: "idle", message: "" });

  useEffect(() => {
    if (isOpen) {
      getBackendBaseUrl().then((savedUrl) => {
        setUrl(savedUrl);
        handleTest(savedUrl);
      });
    }
  }, [isOpen]);

  const handleTest = async (testTarget?: string) => {
    const targetUrl = (testTarget || url).trim().replace(/\/+$/, "");
    setTesting(true);
    setTestResult({ status: "idle", message: "" });

    try {
      const res = await checkBackendHealth(targetUrl);
      if (res.status === "connected") {
        setTestResult({
          status: "success",
          message: "Connected to Machine Troubleshooter Backend",
          model: res.model,
        });
      } else {
        setTestResult({
          status: "error",
          message: res.error || "Could not connect to backend server.",
        });
      }
    } catch (err: any) {
      setTestResult({
        status: "error",
        message: err.message || "Failed to reach endpoint.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const cleanUrl = url.trim().replace(/\/+$/, "");
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ backendUrl: cleanUrl });
    }
    onSaved();
    onClose();
  };

  const handleReset = async () => {
    setUrl(DEFAULT_BACKEND_URL);
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ backendUrl: DEFAULT_BACKEND_URL });
    }
    handleTest(DEFAULT_BACKEND_URL);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden space-y-4 p-4 text-xs">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Arjuna Sarthi Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Backend Endpoint Form */}
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            Backend API Endpoint:
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:8000"
              className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => handleTest()}
              disabled={testing}
              className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
              title="Test connection"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${testing ? "animate-spin text-indigo-600" : ""}`} />
              <span>Test</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            Default: <code className="font-mono">http://localhost:8000</code>. Groq requests are routed securely via FastAPI.
          </p>
        </div>

        {/* Connection Status Banner */}
        {testResult.status !== "idle" && (
          <div
            className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
              testResult.status === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              {testResult.status === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              )}
              <span>{testResult.message}</span>
            </div>
            {testResult.model && (
              <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                <span>Active Groq Model:</span>
                <span className="font-bold">{testResult.model}</span>
              </div>
            )}
          </div>
        )}

        {/* Security badge */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
          <span>Zero client secrets. All API keys remain isolated inside backend environment.</span>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
          >
            Reset Default
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs transition cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
