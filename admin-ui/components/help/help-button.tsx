"use client";

type Props = {
  open: boolean;
  onClick: () => void;
  /** POS lifts the button above its mobile checkout bar. */
  compact?: boolean;
};

/**
 * The floating entry point, bottom-right on every admin page and in the POS.
 *
 * Sized to the same 3.5rem touch target the POS uses elsewhere, and lifted on
 * small screens in the POS so it never sits on top of the checkout bar.
 */
export function HelpButton({ open, onClick, compact = false }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "Close Help Assistant" : "Open Help Assistant"}
      aria-expanded={open}
      title={open ? "Close Help Assistant" : "Open Help Assistant"}
      className={`fixed right-4 z-[60] w-12 h-12 rounded-full grid place-items-center
        bg-sweat text-black shadow-lg border border-black/10
        transition hover:brightness-95 active:scale-95
        focus:outline-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-dark
        ${compact ? "bottom-20 lg:bottom-4" : "bottom-4"}`}
    >
      <i
        className={`fas ${open ? "fa-times" : "fa-question"} text-lg`}
        aria-hidden
      />
    </button>
  );
}
