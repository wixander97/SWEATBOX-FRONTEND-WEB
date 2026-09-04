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
 * Application colour scheme.
 *
 * The whole admin portal is themeable, not just the POS: the choice is written
 * onto <html> as `data-theme`, which re-declares the `--sb-*` surface tokens
 * (see `app/globals.css`). It goes on the document element rather than a
 * wrapper because the receipt prints from a portal mounted on <body>, which a
 * wrapper would leave unthemed.
 *
 * The preference lives in localStorage and is read through
 * `useSyncExternalStore`, which is what makes it safe to render on the server
 * (always dark) and then adopt the stored value on the client without a
 * flash-of-wrong-state effect.
 */

export type Theme = "dark" | "light";

const STORAGE_KEY = "sweatbox.theme";
/** The POS shipped first and owned the preference; keep honouring its key. */
const LEGACY_STORAGE_KEY = "sweatbox.pos.theme";

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

function getSnapshot(): Theme {
  try {
    const stored =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY);
    return stored === "light" ? "light" : "dark";
  } catch {
    // Private browsing / blocked storage: the portal still works, just always dark.
    return "dark";
  }
}

/** The server has no preference to read, so it renders the default. */
function getServerSnapshot(): Theme {
  return "dark";
}

function writeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
    // Keep the old key in step so a downgrade does not lose the choice.
    window.localStorage.setItem(LEGACY_STORAGE_KEY, theme);
  } catch {
    // A front desk that cannot persist the choice still gets to use it for the
    // shift; losing it on reload is not worth failing the click.
  }
  emit();
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => writeTheme(next), []);

  const toggleTheme = useCallback(
    () => writeTheme(theme === "dark" ? "light" : "dark"),
    [theme]
  );

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Reading the theme outside the provider is not an error worth crashing a page
 * over — it only ever drives a toggle icon — so it falls back to the default.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return { theme: "dark", setTheme: () => {}, toggleTheme: () => {} };
}
