"use client";

import { useState, type FormEvent } from "react";
import { dispatchManualScan, type ManualMode } from "@/lib/scan/dispatch";
import { BranchSelect } from "./branch-select";
import { ScanResultPanel, type ScanResultState } from "./scan-result-panel";

const IDLE: ScanResultState = {
  type: "—",
  status: "idle",
  message: "",
  raw: null,
};

export function ScanBarcodeView() {
  const [mode, setMode] = useState<ManualMode>("member");
  const [scanValue, setScanValue] = useState("");
  const [classScheduleId, setClassScheduleId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResultState>(IDLE);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setResult({
      type: mode === "coach" ? "Coach" : "Member",
      status: "loading",
      message: "Sending to SWEATBOX…",
      raw: null,
    });

    try {
      const outcome = await dispatchManualScan(mode, {
        scanValue,
        classScheduleId,
        branchId: mode === "member" ? branchId : undefined,
      });
      setResult({
        type: mode === "coach" ? "Coach session" : "Member check-in",
        status: outcome.ok ? "success" : "failed",
        message: outcome.message,
        raw: outcome.raw,
      });
    } finally {
      setLoading(false);
    }
  }

  const scanValueLabel = mode === "coach" ? "Coach ID" : "Member code";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-display uppercase">Scan Barcode</h1>
        <p className="text-sm text-gray-400 mt-1">
          Manual override — choose Coach or Member, then trigger an attendance
          check-in on behalf of a coach or member.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mode selector */}
            <div>
              <span className="text-gray-500 text-xs uppercase font-bold">Mode</span>
              <div className="mt-1 inline-flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setMode("coach")}
                  className={`px-4 py-2 text-sm font-bold transition ${
                    mode === "coach"
                      ? "bg-sweat text-black"
                      : "bg-sidebar text-gray-400 hover:text-white"
                  }`}
                >
                  Coach
                </button>
                <button
                  type="button"
                  onClick={() => setMode("member")}
                  className={`px-4 py-2 text-sm font-bold transition ${
                    mode === "member"
                      ? "bg-sweat text-black"
                      : "bg-sidebar text-gray-400 hover:text-white"
                  }`}
                >
                  Member
                </button>
              </div>
            </div>

            <label className="block">
              <span className="text-gray-500 text-xs uppercase font-bold">{scanValueLabel}</span>
              <input
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                placeholder={mode === "coach" ? "3fa85f64-5717-4562-b3fc-2c963f66afa6" : "SB000123"}
                autoFocus
                className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sweat"
              />
            </label>

            <label className="block">
              <span className="text-gray-500 text-xs uppercase font-bold">Class schedule ID</span>
              <input
                value={classScheduleId}
                onChange={(e) => setClassScheduleId(e.target.value)}
                placeholder="3fa85f64-5717-4562-b3fc-2c963f66afa6"
                className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sweat"
              />
            </label>

            {mode === "member" && (
              <label className="block">
                <span className="text-gray-500 text-xs uppercase font-bold">Branch</span>
                <div className="mt-1">
                  <BranchSelect value={branchId} onChange={setBranchId} />
                </div>
              </label>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-sweat text-black py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send scan"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanValue("");
                  setClassScheduleId("");
                  setResult(IDLE);
                }}
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
