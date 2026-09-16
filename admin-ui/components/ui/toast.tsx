"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Transient confirmations and failures.
 *
 * Replaces `window.alert` for the new screens: an alert blocks the page, cannot
 * be styled, and cannot say two things at once — which matters here because a
 * registration can succeed while its welcome email fails, and the desk needs to
 * be told both.
 */

export type ToastTone = "success" | "error" | "info" | "warning";

type Toast = {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
};

type ToastContextValue = {
  notify: (toast: Omit<Toast, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE: Record<ToastTone, { class: string; icon: string }> = {
  success: {
    class: "border-green-500/40 bg-green-500/10 text-green-300",
    icon: "fa-circle-check",
  },
  error: {
    class: "border-red-500/40 bg-red-500/10 text-red-300",
    icon: "fa-circle-exclamation",
  },
  info: {
    class: "border-blue-500/40 bg-blue-500/10 text-blue-300",
    icon: "fa-circle-info",
  },
  warning: {
    class: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
    icon: "fa-triangle-exclamation",
  },
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = nextId++;
      setToasts((list) => [...list, { ...toast, id }]);
      // Errors stay longer: they usually carry a sentence worth reading.
      const ttl = toast.tone === "error" ? 9000 : 5000;
      setTimeout(() => dismiss(id), ttl);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (title, description) =>
        notify({ tone: "success", title, description }),
      error: (title, description) =>
        notify({ tone: "error", title, description }),
      info: (title, description) => notify({ tone: "info", title, description }),
      warning: (title, description) =>
        notify({ tone: "warning", title, description }),
    }),
    [notify]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed z-[60] bottom-4 right-4 left-4 sm:left-auto sm:w-96 flex flex-col gap-2 pointer-events-none"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto fade-in rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-sm flex items-start gap-3 ${TONE[toast.tone].class}`}
          >
            <i
              className={`fas ${TONE[toast.tone].icon} mt-0.5 shrink-0`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold break-words">{toast.title}</p>
              {toast.description ? (
                <p className="text-xs opacity-90 mt-0.5 break-words">
                  {toast.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="opacity-60 hover:opacity-100 text-lg leading-none shrink-0"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
