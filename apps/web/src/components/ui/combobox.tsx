// Enhanced dropdown — ported from the legacy prototype's DestinationCombobox
// (see legacy src/components/shared/destination-combobox.tsx) but generalised
// to any {code,label} option list, with no Radix dependency (none is
// installed in this build): a styled trigger button + an animated popover
// panel with an optional search box, keyboard-friendly click-outside close,
// and a selected-option checkmark. Used for every dropdown on Add Tour so
// the whole form matches the legacy's richer combobox feel instead of a
// plain <select>.
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronsUpDown, LucideIcon, Search } from "lucide-react";

export interface ComboboxOption {
  code: string;
  label: string;
  sublabel?: string;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  icon: Icon,
  disabled = false,
  searchable = true,
  clearable = false,
}: {
  value: string;
  onChange: (code: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  searchable?: boolean;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.code === value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.code.toLowerCase().includes(q) || o.label.toLowerCase().includes(q)
    );
  }, [options, search]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (open && searchable) inputRef.current?.focus();
  }, [open, searchable]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm shadow-sm transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-sail-500 disabled:cursor-not-allowed disabled:bg-steel-50 disabled:text-steel-400 ${
          open ? "border-sail-400 ring-1 ring-sail-500/30" : "border-steel-200 hover:border-steel-300"
        }`}
      >
        <span className={`flex min-w-0 items-center gap-2 truncate ${!selected ? "text-steel-400" : "text-steel-800"}`}>
          {Icon && <Icon className="h-4 w-4 shrink-0 text-sail-500" />}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-steel-400" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-steel-200 bg-white shadow-premium"
          >
            {searchable && (
              <div className="border-b border-steel-100 p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-steel-400" />
                  <input
                    ref={inputRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full rounded-lg border border-steel-200 py-2 pl-8 pr-3 text-sm focus:border-sail-400 focus:outline-none focus:ring-1 focus:ring-sail-500"
                  />
                </div>
              </div>
            )}
            <div className="max-h-64 overflow-auto p-1">
              {clearable && value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-medium text-steel-400 hover:bg-steel-50"
                >
                  Clear selection
                </button>
              )}
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-steel-400">No matches found.</p>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => {
                      onChange(opt.code);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-sail-50 ${
                      value === opt.code ? "bg-sail-50" : ""
                    }`}
                  >
                    <Check className={`h-4 w-4 shrink-0 text-sail-500 ${value === opt.code ? "" : "opacity-0"}`} />
                    <span className="flex min-w-0 flex-col items-start">
                      <span className="truncate font-medium text-steel-800">{opt.label}</span>
                      {opt.sublabel && <span className="text-xs text-steel-400">{opt.sublabel}</span>}
                    </span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
