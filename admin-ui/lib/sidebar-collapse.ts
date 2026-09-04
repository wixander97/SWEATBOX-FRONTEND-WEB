"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether the desktop sidebar is collapsed.
 *
 * Separate from the mobile drawer's open state, which is transient: this is a
 * preference, so it is remembered across pages and reloads the same way the
 * theme is. It follows `lib/theme.tsx` deliberately — `useSyncExternalStore`
 * renders the server default (expanded) and adopts the stored value on the
 * client without a setState-in-effect or a flash of the wrong layout.
 *
 * Below `lg` this is ignored entirely; there the sidebar is a drawer.
 */

const STORAGE_KEY = "sweatbox.sidebar.collapsed";

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

function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private browsing / blocked storage: the portal still works, just always
    // starts with the sidebar showing.
    return false;
  }
}

/** The server has no preference to read, so it renders the default. */
function getServerSnapshot(): boolean {
  return false;
}

function write(collapsed: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Losing the preference on reload is not worth failing the click over.
  }
  emit();
}

export function useSidebarCollapsed(): {
  collapsed: boolean;
  toggleCollapsed: () => void;
} {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggleCollapsed = useCallback(() => write(!collapsed), [collapsed]);
  return { collapsed, toggleCollapsed };
}
