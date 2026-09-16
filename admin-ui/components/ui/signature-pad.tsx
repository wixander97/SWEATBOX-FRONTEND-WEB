"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * A drawn signature, captured as the data URL the registration API expects.
 *
 * Built on a plain canvas and pointer events rather than a library: the portal
 * carries no drawing dependency today, and one component's worth of pointer
 * handling is cheaper than adding one. Pointer events cover mouse, trackpad,
 * pen and touch in a single path, so a tablet at the front desk works without a
 * second code path.
 *
 * The output is `data:image/png;base64,...`, which is exactly what
 * `RegisterMemberRequest.SignatureImageData` is documented to take.
 */

const STROKE_COLOR = "#111111";
const BACKGROUND = "#ffffff";

export function SignaturePad({
  value,
  onChange,
  disabled = false,
  label = "Digital Signature",
  required = true,
  error,
}: {
  /** The current data URL, or "" when nothing has been drawn. */
  value: string;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
  label?: string;
  required?: boolean;
  error?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const dirtyRef = useRef(false);
  const [hasInk, setHasInk] = useState(Boolean(value));

  /**
   * Sizes the bitmap to the element's own box at device resolution.
   *
   * Without this the canvas draws at its default 300x150 and the signature
   * arrives stretched and blurred on a retina screen.
   */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // A resize clears the bitmap, so anything already drawn is preserved and
    // painted back at the new size.
    const previous = dirtyRef.current ? canvas.toDataURL("image/png") : null;

    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = STROKE_COLOR;

    if (previous) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, rect.width, rect.height);
      image.src = previous;
    }
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  /**
   * Repaints a signature handed in from outside — reopening a form that already
   * has one, for instance — without treating it as a fresh stroke.
   */
  useEffect(() => {
    if (!value) return;
    if (dirtyRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const image = new Image();
    image.onload = () => {
      ctx.drawImage(image, 0, 0, rect.width, rect.height);
      setHasInk(true);
    };
    image.src = value;
  }, [value]);

  function pointIn(canvas: HTMLCanvasElement, e: React.PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Capturing the pointer keeps the stroke attached when the finger leaves
    // the box mid-signature, which is otherwise a very easy way to lose one.
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;

    const { x, y } = pointIn(canvas, e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // A tap with no movement should still leave a mark.
    ctx.lineTo(x + 0.01, y);
    ctx.stroke();
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { x, y } = pointIn(canvas, e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    dirtyRef.current = true;

    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    setHasInk(true);
    onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = STROKE_COLOR;

    dirtyRef.current = false;
    setHasInk(false);
    onChange("");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-muted text-sm">
          {label}
          {required ? (
            <span className="text-accent-ink ml-1" aria-hidden>
              *
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasInk}
          className="text-xs text-muted hover:text-fg disabled:opacity-40 disabled:hover:text-muted"
        >
          <i className="fas fa-eraser mr-1.5" aria-hidden />
          Clear
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className={`w-full h-40 rounded-lg bg-white touch-none select-none ${
          error ? "border-2 border-red-500/70" : "border border-border"
        } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-crosshair"}`}
        aria-label="Signature area. Draw the member's signature."
        role="img"
      />

      <div className="flex items-center justify-between mt-1 gap-3">
        <p className="text-xs text-muted">
          {hasInk
            ? "Signature captured. Clear to redraw."
            : "Sign inside the box using a mouse, pen or finger."}
        </p>
        {hasInk ? (
          <span className="text-xs text-success font-bold whitespace-nowrap">
            <i className="fas fa-check mr-1" aria-hidden />
            Signed
          </span>
        ) : null}
      </div>

      {error ? <p className="text-xs text-danger mt-1">{error}</p> : null}
    </div>
  );
}
