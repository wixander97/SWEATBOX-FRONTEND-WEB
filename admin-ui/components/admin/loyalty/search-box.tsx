"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A search input that reports its trimmed value after the user stops typing.
 * Shared by the loyalty tabs so each keeps one debounce rule.
 */
export function SearchBox({
  placeholder,
  onSearch,
  initialValue = "",
  delayMs = 400,
}: {
  placeholder: string;
  onSearch: (value: string) => void;
  initialValue?: string;
  delayMs?: number;
}) {
  const [value, setValue] = useState(initialValue);
  const onSearchRef = useRef(onSearch);
  const lastSent = useRef(initialValue.trim());

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = value.trim();
      if (next === lastSent.current) return;
      lastSent.current = next;
      onSearchRef.current(next);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return (
    <div className="relative">
      <i
        className={`fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs ${value ? "text-accent-ink" : "text-muted"}`}
        aria-hidden
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full sm:w-72 bg-sidebar border border-border text-fg text-sm rounded-lg pl-9 pr-9 py-2 focus:outline-none focus:border-sweat transition placeholder:text-muted"
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg transition"
          aria-label="Clear search"
        >
          <i className="fas fa-times text-xs" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
