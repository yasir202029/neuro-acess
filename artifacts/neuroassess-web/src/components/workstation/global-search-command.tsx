/**
 * Global Search / Command Palette — powerful search interface where permitted.
 *
 * Allows authorised users to quickly navigate to patient, appointment,
 * assessment, report, task, document, workflow. Search results obey
 * server-side permissions. Never exposes records merely because they match.
 *
 * ⚠️ DEVELOPMENT PLACEHOLDER: Backend search endpoint not yet implemented.
 * UI renders but returns no live results. Marked as incomplete per clinical
 * safety rule: no fake production functionality.
 */

import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";

export function GlobalSearchCommand() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpen = () => {
    setOpen(true);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleOpen();
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors border-[hsl(var(--border))]"
      >
        <Search size={14} className="mr-1" />
        <span>Search patients, appointments, assessments…</span>
        <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">⌘K</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-80 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[0_20px_50px_-5px_rgba(0,0,0,0.25)]">
          <div className="border-b border-[hsl(var(--border))] p-3">
            <label className="block text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))] mb-2">
              Command
            </label>
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              placeholder="Type to search…"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            <div className="px-3 py-4 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--warning))]/[.1] border-[hsl(var(--warning))]/[.3] text-[hsl(var(--warning))]">
                  ⚠
                </span>
                Backend search not yet implemented
              </span>
            </div>
          </div>
          <div className="border-t border-[hsl(var(--border))] p-2 text-[10px] text-[hsl(var(--muted-foreground))]">
            Results will obey server-side permissions.
          </div>
        </div>
      )}
    </div>
  );
}
