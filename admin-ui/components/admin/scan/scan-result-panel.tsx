"use client";

export type ScanResultState = {
  type: string; // "Coach" | "Member" | "Invalid" | "—"
  status: "idle" | "loading" | "success" | "failed";
  message: string;
  raw: unknown;
};

type Props = {
  result: ScanResultState;
};

function statusLabel(status: ScanResultState["status"]) {
  switch (status) {
    case "loading":
      return "Processing…";
    case "success":
      return "Success";
    case "failed":
      return "Failed";
    default:
      return "—";
  }
}

function statusClass(status: ScanResultState["status"]) {
  switch (status) {
    case "success":
      return "text-green-400";
    case "failed":
      return "text-red-400";
    case "loading":
      return "text-blue-400";
    default:
      return "text-gray-400";
  }
}

export function ScanResultPanel({ result }: Props) {
  const rawText =
    result.raw == null
      ? "—"
      : typeof result.raw === "string"
        ? result.raw
        : JSON.stringify(result.raw, null, 2);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase font-bold text-gray-500 mb-1">Type</p>
        <p className="font-mono text-sm text-white">{result.type}</p>
      </div>
      <div>
        <p className="text-xs uppercase font-bold text-gray-500 mb-1">Result</p>
        <p className={`text-sm font-semibold ${statusClass(result.status)}`}>
          {statusLabel(result.status)}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase font-bold text-gray-500 mb-1">Message</p>
        <p className="text-sm text-gray-200 break-words">{result.message || "—"}</p>
      </div>
      <div>
        <p className="text-xs uppercase font-bold text-gray-500 mb-1">API response</p>
        <pre className="bg-black/40 border border-border rounded-lg p-3 text-xs text-gray-300 max-h-64 overflow-auto whitespace-pre-wrap break-words">
          {rawText}
        </pre>
      </div>
    </div>
  );
}
