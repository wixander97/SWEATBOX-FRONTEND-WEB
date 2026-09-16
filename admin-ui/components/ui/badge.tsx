"use client";

import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
  success: "bg-green-500/10 text-green-500 border border-green-500/20",
  warning: "bg-yellow-500/10 text-yellow-500 border border-yellow-500/30",
  danger: "bg-red-500/10 text-red-500 border border-red-500/20",
  info: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  accent: "bg-sweat/10 text-sweat border border-sweat/30",
};

export function Badge({
  tone = "neutral",
  children,
  icon,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  icon?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${TONE_CLASS[tone]}`}
    >
      {icon ? <i className={`fas ${icon}`} aria-hidden /> : null}
      {children}
    </span>
  );
}
