"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { guideForPath, HELP_PATH } from "@/lib/help/registry";
import { adminPaths } from "@/lib/admin-routes";
import { HelpButton } from "./help-button";
import { HelpPanel } from "./help-panel";
import { HelpSpotlight } from "./help-spotlight";

/**
 * The floating Help Assistant, mounted once per layout.
 *
 * Context comes from the router's own pathname — there is no second routing
 * table — so a new module gets its guide by adding one entry to the registry
 * with the path it already has.
 *
 * Reopening starts at step 1. Nothing in the portal tracks onboarding progress,
 * so remembering a half-finished walkthrough would leave staff on a step whose
 * context they have long since lost.
 */
export function HelpAssistant() {
  const pathname = usePathname();
  /*
   * Which page the panel was opened for, rather than a plain boolean.
   *
   * Navigating away therefore closes the panel by making this stale — no effect
   * has to watch the pathname and reset state, which would be a synchronous
   * setState in an effect and an extra render on every navigation.
   */
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const guide = useMemo(() => guideForPath(pathname), [pathname]);
  const isPos = pathname?.startsWith(adminPaths.pos) ?? false;
  const open = openedFor !== null && openedFor === pathname;

  const close = useCallback(() => setOpenedFor(null), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // The Help & Support page is the full experience already; a floating shortcut
  // back to it there would only be a button that points at the current page.
  if (pathname === HELP_PATH) return null;

  const steps = guide?.steps ?? [];
  const step = steps[stepIndex];

  return (
    <>
      <HelpButton
        open={open}
        compact={isPos}
        onClick={() => {
          if (open) {
            close();
          } else {
            setStepIndex(0);
            setOpenedFor(pathname ?? null);
          }
        }}
      />

      {open && (
        <>
          <HelpSpotlight selector={step?.target} stepKey={stepIndex} />
          <HelpPanel
            guide={guide}
            stepIndex={stepIndex}
            compact={isPos}
            onBack={() => setStepIndex((i) => Math.max(0, i - 1))}
            onNext={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
            onClose={close}
          />
        </>
      )}
    </>
  );
}
