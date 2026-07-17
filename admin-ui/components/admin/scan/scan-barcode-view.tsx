"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { dispatchManualScan, type ManualMode } from "@/lib/scan/dispatch";
import { parseScan } from "@/lib/scan/parse-scan";
import { BranchSelect } from "./branch-select";
import { ScanResultPanel, type ScanResultState } from "./scan-result-panel";

const DUPLICATE_SCAN_WINDOW_MS = 2500;
const SCAN_BUFFER_RESET_MS = 250;

const IDLE: ScanResultState = {
  type: "—",
  status: "idle",
  message: "",
  raw: null,
};

type DisplayType = "—" | "Coach" | "Member" | "PT" | "Invalid";

function typeForMode(mode: ManualMode): DisplayType {
  return mode === "coach" ? "Coach" : mode === "pt" ? "PT" : "Member";
}

export function ScanBarcodeView() {
  const [mode, setMode] = useState<ManualMode>("member");
  const [scanValue, setScanValue] = useState("");
  const [classScheduleId, setClassScheduleId] = useState("");
  const [ptSessionId, setPtSessionId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [scanBuffer, setScanBuffer] = useState("");
  const [displayType, setDisplayType] = useState<DisplayType>("—");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResultState>(IDLE);

  // Hidden capture input — the only focus target for the HID scanner. It is
  // visually hidden (sr-only) so the user never sees it as an editable field;
  // it merely absorbs keystrokes from the barcode scanner and triggers parsing
  // on Enter.
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastScanRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  const bufferResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus the hidden capture input on mount so the scanner is live immediately.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Re-focus the capture input after the BranchSelect's value changes
  // (select auto-closes after change).
  const handleBranchChange = useCallback((next: string) => {
    setBranchId(next);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // Buttons use mousedown-preventDefault so they fire their click handlers
  // without stealing focus from the capture input (kiosk pattern).
  const keepFocus = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  }, []);

  // After manual typing in an editable field, re-focus the HID capture
  // input so the next scan is captured.
  const refocusCapture = useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const autofillFromIntent = useCallback((raw: string) => {
    const intent = parseScan(raw);
    if (intent.type === "invalid") {
      setDisplayType("Invalid");
      setResult({
        type: "Invalid",
        status: "failed",
        message: intent.reason,
        raw,
      });
      return;
    }

    // Auto-detect mode from the scanned QR intent so the operator doesn't
    // have to pre-select Coach / Member / PT — the QR carries its own type.
    const nextMode: ManualMode =
      intent.type === "coach"
        ? "coach"
        : intent.type === "pt"
          ? "pt"
          : "member";
    setMode(nextMode);

    const intentType: DisplayType =
      intent.type === "coach" ? "Coach" : intent.type === "pt" ? "PT" : "Member";
    setDisplayType(intentType);
    setResult({
      type: intentType,
      status: "idle",
      message: "Ready to send.",
      raw,
    });

    // A fresh scan overwrites the form fields so re-scanning always reflects
    // the latest QR (manual edits are reserved for the manual-input path).
    if (intent.type === "coach") {
      setScanValue(intent.coachId);
      setClassScheduleId(intent.classScheduleId);
      return;
    }

    if (intent.type === "pt") {
      setPtSessionId(intent.ptSessionId);
      setScanValue(intent.memberId);
      return;
    }

    // member intent
    setScanValue(intent.memberCode);
    if (intent.classScheduleId) setClassScheduleId(intent.classScheduleId);
    if (intent.branchId) setBranchId(intent.branchId);
  }, []);

  const handleScanKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const raw = scanBuffer.trim();
      setScanBuffer("");
      if (bufferResetRef.current) {
        clearTimeout(bufferResetRef.current);
        bufferResetRef.current = null;
      }
      if (!raw) {
        setDisplayType("Invalid");
        setResult({
          type: "Invalid",
          status: "failed",
          message: "Empty scan.",
          raw: "",
        });
        return;
      }

      // Duplicate guard.
      const now = Date.now();
      if (
        raw === lastScanRef.current.value &&
        now - lastScanRef.current.at < DUPLICATE_SCAN_WINDOW_MS
      ) {
        return;
      }
      lastScanRef.current = { value: raw, at: now };

      autofillFromIntent(raw);
    },
    [scanBuffer, autofillFromIntent],
  );

  // Accumulate scanner keystrokes into the hidden buffer; if typing pauses
  // (human input is slow), reset the buffer so stale fragments don't leak
  // into the next scan. A HID scanner fires characters in a rapid burst that
  // comfortably stays under SCAN_BUFFER_RESET_MS.
  const handleScanChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setScanBuffer(e.target.value);
      if (bufferResetRef.current) clearTimeout(bufferResetRef.current);
      bufferResetRef.current = setTimeout(() => {
        setScanBuffer("");
        bufferResetRef.current = null;
      }, SCAN_BUFFER_RESET_MS);
    },
    [],
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    if (!scanValue.trim()) return;
    if (mode === "pt") {
      if (!ptSessionId.trim()) return;
    } else {
      if (!classScheduleId.trim()) return;
      if (mode === "member" && !branchId) return;
    }

    setLoading(true);
    setResult({
      type: mode === "coach" ? "Coach" : mode === "pt" ? "PT" : "Member",
      status: "loading",
      message: "Sending to SWEATBOX…",
      raw: null,
    });

    try {
      const outcome = await dispatchManualScan(mode, {
        scanValue,
        classScheduleId: mode === "pt" ? undefined : classScheduleId,
        branchId: mode === "member" ? branchId : undefined,
        ptSessionId: mode === "pt" ? ptSessionId : undefined,
      });
      setResult({
        type:
          mode === "coach"
            ? "Coach session"
            : mode === "pt"
              ? "PT session check-in"
              : "Member check-in",
        status: outcome.ok ? "success" : "failed",
        message: outcome.message,
        raw: outcome.raw,
      });
    } finally {
      setLoading(false);
      // Re-focus the capture input so the next scan is ready.
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function handleClear() {
    setScanValue("");
    setClassScheduleId("");
    setPtSessionId("");
    setScanBuffer("");
    setDisplayType("—");
    setResult(IDLE);
    lastScanRef.current = { value: "", at: 0 };
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  // Display Type reflects the toggle, not the parsed intent (toggle is
  // authoritative for the dispatch). Only flips to "Invalid" when the scan
  // is invalid.
  const displayTypeShown: DisplayType =
    displayType === "Invalid" ? "Invalid" : typeForMode(mode);

  const sendDisabled =
    loading ||
    !scanValue.trim() ||
    (mode === "pt"
      ? !ptSessionId.trim()
      : !classScheduleId.trim() || (mode === "member" && !branchId));

  // Banner copy reflects current scan/dispatch state.
  const bannerDot =
    result.status === "loading"
      ? "bg-sweat animate-pulse"
      : result.status === "failed"
        ? "bg-red-500"
        : result.status === "success"
          ? "bg-green-500"
          : "bg-green-500";
  const bannerTitle =
    result.status === "loading"
      ? "Memproses scan…"
      : result.status === "failed"
        ? "Scan gagal"
        : result.status === "success"
          ? "Scan terkirim"
          : "Siap menerima scan";
  const bannerHint =
    result.status === "idle" || result.status === "success"
      ? "Arahkan scanner QR ke kode — kolom di bawah terisi otomatis. Atau isi manual, lalu klik Send scan."
      : result.message;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-display uppercase">Barcode Scanner</h1>
        <p className="text-sm text-gray-400 mt-1">
          Arahkan scanner QR ke kode anggota/pelatih/sesi PT. Hasil scan terdeteksi
          otomatis dan mengisi kolom di bawah. Untuk input manual, ketik langsung di
          kolom yang tersedia lalu klik &quot;Send scan&quot;.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Scanner status banner — not an editable field. Explains to the
                operator that the page is listening for a HID scan. */}
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-sidebar px-4 py-3">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${bannerDot}`}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{bannerTitle}</p>
                <p className="text-xs text-gray-400 truncate">{bannerHint}</p>
              </div>
            </div>

            {/* Hidden HID scan-capture input — the sole focus target for the
                barcode scanner. Visually hidden so it never appears as an
                editable field to the user. */}
            <input
              ref={inputRef}
              value={scanBuffer}
              onChange={handleScanChange}
              onKeyDown={handleScanKeyDown}
              autoFocus
              autoComplete="off"
              name="scan-buffer"
              inputMode="text"
              enterKeyHint="send"
              aria-label="Barcode scanner input"
              tabIndex={-1}
              className="sr-only"
            />

            {/* Coach / Member / PT toggle — reflects the auto-detected mode and
                is still manually switchable. Authoritative for the dispatch. */}
            <div>
              <span className="text-gray-500 text-xs uppercase font-bold">Mode</span>
              <div className="mt-1 inline-flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => setMode("coach")}
                  className={`px-4 py-2 text-sm font-bold transition ${mode === "coach"
                    ? "bg-sweat text-black"
                    : "bg-sidebar text-gray-400 hover:text-white"
                    }`}
                >
                  Coach
                </button>
                <button
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => setMode("member")}
                  className={`px-4 py-2 text-sm font-bold transition ${mode === "member"
                    ? "bg-sweat text-black"
                    : "bg-sidebar text-gray-400 hover:text-white"
                    }`}
                >
                  Member
                </button>
                <button
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => setMode("pt")}
                  className={`px-4 py-2 text-sm font-bold transition ${mode === "pt"
                    ? "bg-sweat text-black"
                    : "bg-sidebar text-gray-400 hover:text-white"
                    }`}
                >
                  PT
                </button>
              </div>
            </div>

            {/* Type — reflects the detected/mode (authoritative). */}
            <div>
              <span className="text-gray-500 text-xs uppercase font-bold">
                Type
              </span>
              <p className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white font-mono text-sm">
                {displayTypeShown}
              </p>
            </div>

            {/* Editable scan-value column — auto-filled by scan, manual-typable. */}
            <div>
              <span className="text-gray-500 text-xs uppercase font-bold">
                {mode === "coach" ? "Coach ID" : mode === "pt" ? "Member ID" : "Member code"}
              </span>
              <input
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onBlur={refocusCapture}
                autoComplete="off"
                aria-label="Scan value"
                className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sweat"
              />
            </div>

            {/* Class schedule ID — editable (Coach / Member only). */}
            {mode !== "pt" && (
              <div>
                <span className="text-gray-500 text-xs uppercase font-bold">
                  Class schedule ID
                </span>
                <input
                  value={classScheduleId}
                  onChange={(e) => setClassScheduleId(e.target.value)}
                  onBlur={refocusCapture}
                  autoComplete="off"
                  aria-label="Class schedule ID"
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sweat"
                />
              </div>
            )}

            {/* PT session ID — editable (PT mode only). */}
            {mode === "pt" && (
              <div>
                <span className="text-gray-500 text-xs uppercase font-bold">
                  PT session ID
                </span>
                <input
                  value={ptSessionId}
                  onChange={(e) => setPtSessionId(e.target.value)}
                  onBlur={refocusCapture}
                  autoComplete="off"
                  aria-label="PT session ID"
                  className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sweat"
                />
              </div>
            )}

            {/* Branch — Member mode only. */}
            {mode === "member" && (
              <div>
                <span className="text-gray-500 text-xs uppercase font-bold">
                  Branch
                </span>
                <div className="mt-1">
                  <BranchSelect value={branchId} onChange={handleBranchChange} />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                onMouseDown={keepFocus}
                disabled={sendDisabled}
                className="flex-1 bg-sweat text-black py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send scan"}
              </button>
              <button
                type="button"
                onMouseDown={keepFocus}
                onClick={handleClear}
                className="px-4 py-2 rounded-lg text-sm border border-border text-gray-300 hover:text-white"
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm uppercase font-bold text-gray-500 mb-4">Last scan</h2>
          <ScanResultPanel result={result} />
        </div>
      </div>
    </div>
  );
}