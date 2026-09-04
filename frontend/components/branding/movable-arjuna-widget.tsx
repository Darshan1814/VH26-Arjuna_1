"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArjunaSarthiLogo } from "@/components/branding/arjuna-sarthi-logo";
import {
  X,
  Sparkles,
  Send,
  Loader2,
  Globe,
  Compass,
  ArrowUpRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { getApiBase } from "@/lib/api";

export function MovableArjunaWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });
  const hasDraggedRef = useRef(false);

  // In-Widget mini companion chat state
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<any[]>([]);

  // Initialize position to bottom right corner once mounted
  useEffect(() => {
    if (typeof window !== "undefined") {
      const initialX = window.innerWidth - 80;
      const initialY = window.innerHeight - 100;
      setPosition({ x: Math.max(20, initialX), y: Math.max(20, initialY) });
    }
  }, []);

  // Window resize handler to keep within bounds
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => ({
        x: Math.min(prev.x, window.innerWidth - 76),
        y: Math.min(prev.y, window.innerHeight - 76),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag with main mouse button
    if (e.button !== 0) return;
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position.x,
      initY: position.y,
    };
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!e.touches[0]) return;
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      initX: position.x,
      initY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartRef.current.startX;
      const deltaY = e.clientY - dragStartRef.current.startY;

      if (Math.hypot(deltaX, deltaY) > 6) {
        hasDraggedRef.current = true;
      }

      const newX = Math.min(Math.max(12, dragStartRef.current.initX + deltaX), window.innerWidth - 76);
      const newY = Math.min(Math.max(12, dragStartRef.current.initY + deltaY), window.innerHeight - 76);

      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || !e.touches[0]) return;
      const deltaX = e.touches[0].clientX - dragStartRef.current.startX;
      const deltaY = e.touches[0].clientY - dragStartRef.current.startY;

      if (Math.hypot(deltaX, deltaY) > 6) {
        hasDraggedRef.current = true;
      }

      const newX = Math.min(Math.max(12, dragStartRef.current.initX + deltaX), window.innerWidth - 76);
      const newY = Math.min(Math.max(12, dragStartRef.current.initY + deltaY), window.innerHeight - 76);

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging]);

  const handleClick = () => {
    if (hasDraggedRef.current) return;
    setIsOpen((prev) => !prev);
  };

  // Submit test query
  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setAnswer(null);

    try {
      const res = await fetch(`${getApiBase()}/api/extension/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: typeof window !== "undefined" ? window.location.href : "http://localhost:3000",
          title: "Active Page Intelligence",
          question: question.trim(),
          context: [
            {
              id: "page-overview",
              heading: "Page Overview",
              section: "System Intelligence",
              content:
                "Arjuna Sarthi is an AI web intelligence companion. It processes in-page DOM text, provides grounded answers with source citations, and strictly prevents hallucinations.",
            },
          ],
          conversation: [],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAnswer(data.answer);
        setSources(data.sources || []);
      } else {
        setAnswer("Could not reach AI backend. Please verify backend is running on port 8000.");
      }
    } catch {
      setAnswer("Backend offline or request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ================= MOVABLE CIRCULAR BUTTON ================= */}
      <div
        style={{
          position: "fixed",
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 9999,
          touchAction: "none",
        }}
        className="select-none"
      >
        <button
          type="button"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onClick={handleClick}
          title="Arjuna Sarthi (Drag to move, click to open)"
          className={`group relative flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl transition-transform hover:scale-105 active:scale-95 cursor-grab ${
            isDragging ? "cursor-grabbing shadow-2xl ring-2 ring-[var(--color-primary)]" : ""
          }`}
          style={{
            boxShadow: "0 8px 24px rgba(45, 38, 32, 0.25)",
          }}
          aria-label="Toggle Arjuna Sarthi Web Companion"
        >
          {/* Subtle pulsating outer ring */}
          <span className="absolute -inset-0.5 rounded-full border border-[var(--color-primary)] opacity-40 animate-pulse pointer-events-none" />

          {/* Centered Circular Orbit Logo */}
          <ArjunaSarthiLogo size="sm" animate={true} />

          {/* Active indicator dot */}
          <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[var(--color-surface)] bg-emerald-600" />
        </button>
      </div>

      {/* ================= COMPACT FLOATING COMPANION DRAWER / MODAL ================= */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-6 z-50 w-80 sm:w-96 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-2xl overflow-hidden flex flex-col max-h-[520px] animate-fade-in"
          style={{
            boxShadow: "0 16px 40px rgba(26, 22, 19, 0.35)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
            <div className="flex items-center gap-2">
              <ArjunaSarthiLogo size="sm" animate={true} />
              <div>
                <h4 className="text-xs font-bold leading-tight flex items-center gap-1.5">
                  <span>Arjuna Sarthi</span>
                  <span className="text-[10px] font-mono font-normal text-[var(--color-primary)]">AI</span>
                </h4>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  Movable Web Companion
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] transition"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Context Banner */}
          <div className="px-3 py-2 bg-[var(--color-surface)] border-b border-[var(--color-border-subtle)] flex items-center justify-between text-[11px] text-[var(--color-text-secondary)]">
            <span className="flex items-center gap-1.5 truncate">
              <Globe className="h-3 w-3 text-[var(--color-primary)] flex-shrink-0" />
              <span className="truncate">Active Page Intelligence</span>
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
          </div>

          {/* Conversation Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
            <div className="p-2.5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] leading-relaxed text-[11px]">
              Click the floating circle anytime to open or close. Drag it anywhere across your screen.
            </div>

            {answer && (
              <div className="p-3 rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-surface-elevated)] space-y-2">
                <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-wider">
                  <Sparkles className="h-3 w-3" />
                  <span>Grounded Answer</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--color-text)] whitespace-pre-line">
                  {answer}
                </p>
                {sources.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1 border-t border-[var(--color-border-subtle)]">
                    {sources.map((s, i) => (
                      <span
                        key={i}
                        className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
                      >
                        {s.heading || `Source ${i + 1}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input Footer */}
          <div className="p-2.5 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
            <form onSubmit={handleAsk} className="flex gap-1.5">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about this page..."
                className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-text)] focus:outline-hidden focus:ring-1 focus:ring-[var(--color-primary)]"
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white px-3 py-1.5 text-xs font-semibold transition"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
