"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

/**
 * POS colour scheme.
 *
 * Only the POS is themeable — the rest of the admin portal stays dark. The
 * choice is written onto <html> as `data-pos-theme`, which re-declares the
 * `--sb-*` surface tokens (see `app/globals.css`). It goes on the document
 * element rather than a POS wrapper because the receipt prints from a portal
 * mounted on <body>, which a wrapper would leave unthemed. The attribute is
 * removed on unmount, so leaving the POS restores the portal's own palette.
 *
 * The preference lives in localStorage and is read through
 * `useSyncExternalStore`, which is what makes it safe to render on the server
 * (always dark) and then adopt the stored value on the client without a
 * flash-of-wrong-state effect.
 */

export type PosTheme = "dark" | "light";

const STORAGE_KEY = "sweatbox.pos.theme";

/** Bumped on every write so same-tab readers re-render; cross-tab uses `storage`. */
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): PosTheme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" ? "light" : "dark";
  } catch {
    // Private browsing / blocked storage: the till still works, just always dark.
    return "dark";
  }
}

/** The server has no preference to read, so it renders the default. */
function getServerSnapshot(): PosTheme {
  return "dark";
}

function writeTheme(theme: PosTheme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // A front desk that cannot persist the choice still gets to use it for the
    // shift; losing it on reload is not worth failing the click.
  }
  emit();
}

type ThemeContextValue = {
  theme: PosTheme;
  setTheme: (theme: PosTheme) => void;
  toggleTheme: () => void;
};

const PosThemeContext = createContext<ThemeContextValue | null>(null);

export function PosThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-pos-theme", theme);
    return () => root.removeAttribute("data-pos-theme");
  }, [theme]);

  const setTheme = useCallback((next: PosTheme) => writeTheme(next), []);

  const toggleTheme = useCallback(
    () => writeTheme(theme === "dark" ? "light" : "dark"),
    [theme]
  );

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <PosThemeContext.Provider value={value}>{children}</PosThemeContext.Provider>
  );
}

export function usePosTheme(): ThemeContextValue {
  const ctx = useContext(PosThemeContext);
  if (!ctx) {
    throw new Error("usePosTheme must be used inside PosThemeProvider");
  }
  return ctx;
}
