"use client";

import { useEffect, useState } from "react";

type Measurement = {
  /** Which selector this measurement belongs to, so a stale one never paints. */
  selector: string;
  top: number;
  left: number;
  width: number;
  height: number;
};

type Props = {
  /** CSS selector for the element to highlight, if the step names one. */
  selector?: string;
  /** Bumped by the caller when the step changes, to force a re-measure. */
  stepKey: number;
};

const PADDING = 6;

/**
 * A ring drawn around the element a step is talking about.
 *
 * Deliberately not a dimming overlay that swallows clicks: the page stays fully
 * usable, so the assistant never stops staff from doing the thing the step is
 * describing. The ring is `pointer-events: none` and absolutely positioned, so
 * it adds no layout and cannot intercept a click.
 *
 * Every failure mode degrades to drawing nothing — a selector matching nothing,
 * a malformed selector, or a zero-size element — which is what keeps a stale
 * `target` in a guide from breaking the walkthrough.
 *
 * All measuring happens inside the animation frame loop rather than in the
 * effect body, both so the ring tracks a scrolling or resizing target and so
 * the effect never sets state synchronously.
 */
export function HelpSpotlight({ selector, stepKey }: Props) {
  const [measurement, setMeasurement] = useState<Measurement | null>(null);

  useEffect(() => {
    if (!selector) return;

    let frame = 0;

    const find = (): Element | null => {
      try {
        return document.querySelector(selector);
      } catch {
        // A malformed selector in a guide must not take the assistant down.
        return null;
      }
    };

    // Bring the target into view once, then track it while the step is shown.
    find()?.scrollIntoView({ block: "center", behavior: "smooth" });

    const tick = () => {
      const el = find();
      if (!el) {
        setMeasurement(null);
      } else {
        const r = el.getBoundingClientRect();
        setMeasurement(
          r.width === 0 && r.height === 0
            ? null
            : {
                selector,
                top: r.top,
                left: r.left,
                width: r.width,
                height: r.height,
              }
        );
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frame);
  }, [selector, stepKey]);

  if (!selector || measurement?.selector !== selector) return null;

  return (
    <div
      aria-hidden
      className="fixed z-[65] pointer-events-none rounded-lg border-2 border-sweat transition-all duration-200"
      style={{
        top: measurement.top - PADDING,
        left: measurement.left - PADDING,
        width: measurement.width + PADDING * 2,
        height: measurement.height + PADDING * 2,
        boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.35), 0 0 0 4px rgb(255 215 0 / 0.25)",
      }}
    />
  );
}
