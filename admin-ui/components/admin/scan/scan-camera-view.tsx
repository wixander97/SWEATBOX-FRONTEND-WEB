"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import { parseScan } from "@/lib/scan/parse-scan";
import { dispatchScan } from "@/lib/scan/dispatch";
import { ScanResultPanel, type ScanResultState } from "./scan-result-panel";

const CAMERA_ELEMENT_ID = "scan-camera-region";
const DUPLICATE_SCAN_WINDOW_MS = 2500;

const IDLE: ScanResultState = {
  type: "—",
  status: "idle",
  message: "",
  raw: null,
};

type CamState = "stopped" | "starting" | "running" | "error";

export function ScanCameraView() {
  const [camState, setCamState] = useState<CamState>("stopped");
  const [camError, setCamError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResultState>(IDLE);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });

  const isSecureContext =
    typeof window !== "undefined" && window.isSecureContext;
  const hasMediaDevices =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function";

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner && scanner.isScanning) {
      try {
        await scanner.stop();
      } catch {
        // ignore
      }
    }
    try {
      scanner?.clear();
    } catch {
      // ignore
    }
    setCamState("stopped");
  }, []);

  // Release the camera when the page unmounts.
  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setCamError("");
    if (!isSecureContext) {
      setCamState("error");
      setCamError(
        "Camera blocked: this page must be served over https:// or opened from http://localhost (not file://).",
      );
      return;
    }
    if (!hasMediaDevices) {
      setCamState("error");
      setCamError("This browser does not expose a camera API.");
      return;
    }

    setCamState("starting");
    try {
      const scanner = new Html5Qrcode(CAMERA_ELEMENT_ID, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          void handleDecode(decodedText);
        },
        () => {
          // Per-frame decode failures are expected when no QR is in view.
        },
      );
      setCamState("running");
    } catch (err) {
      const name = (err as { name?: string })?.name;
      setCamState("error");
      setCamError(
        name === "NotAllowedError"
          ? "Camera permission denied. Allow camera access in the browser and tap Start again."
          : `Could not open the camera: ${(err as Error)?.message || String(err)}`,
      );
      scannerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSecureContext, hasMediaDevices]);

  const handleDecode = useCallback(
    async (decodedText: string) => {
      // Duplicate-scan guard: ignore the same QR held in view.
      const now = Date.now();
      if (
        decodedText === lastScanRef.current.value &&
        now - lastScanRef.current.at < DUPLICATE_SCAN_WINDOW_MS
      ) {
        return;
      }
      lastScanRef.current = { value: decodedText, at: now };

      const intent = parseScan(decodedText);
      setResult({
        type:
          intent.type === "coach"
            ? "Coach"
            : intent.type === "member"
              ? "Member"
              : "Invalid",
        status: "loading",
        message:
          intent.type === "invalid"
            ? intent.reason
            : "Sending to SWEATBOX…",
        raw: decodedText,
      });

      if (intent.type === "invalid") {
        return;
      }

      setLoading(true);
      try {
        const outcome = await dispatchScan(intent, "");
        setResult({
          type: intent.type === "coach" ? "Coach session" : "Member check-in",
          status: outcome.ok ? "success" : "failed",
          message: outcome.message,
          raw: outcome.raw,
        });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-display uppercase">Webcam Scanner</h1>
        <p className="text-sm text-gray-400 mt-1">
          Point the camera at a coach/member QR code. Decoded values are sent
          through the same scan pipeline as the manual scanner.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div>
            <div
              id={CAMERA_ELEMENT_ID}
              className="w-full rounded-lg overflow-hidden bg-black border border-border min-h-[240px]"
            />
            {camState !== "running" && (
              <div className="mt-2 text-center text-sm text-gray-400 min-h-[1.25rem]">
                {camState === "error"
                  ? camError
                  : camState === "starting"
                    ? "Starting camera…"
                    : "Camera is off. Tap “Start camera”."}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {camState !== "running" ? (
              <button
                type="button"
                onClick={() => void startCamera()}
                disabled={camState === "starting"}
                className="flex-1 bg-sweat text-black py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition disabled:opacity-50"
              >
                {camState === "starting" ? "Starting…" : "Start camera"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void stopCamera()}
                className="flex-1 px-4 py-2 rounded-lg text-sm border border-border text-gray-300 hover:text-white"
              >
                Stop camera
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500 leading-relaxed">
            Camera needs a secure context: serve over <code className="font-mono">https://</code> or
            open from <code className="font-mono">http://localhost</code>. A QR held in view is only
            sent once (duplicate-guarded).
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm uppercase font-bold text-gray-500 mb-4">Last scan</h2>
          <ScanResultPanel result={result} />
        </div>
      </div>
    </div>
  );
}
