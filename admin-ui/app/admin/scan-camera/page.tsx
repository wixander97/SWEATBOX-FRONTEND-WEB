"use client";

import dynamic from "next/dynamic";

// Camera access (navigator.mediaDevices / html5-qrcode) is browser-only.
// Load the view with SSR disabled to avoid window/navigator errors at build.
const ScanCameraView = dynamic(
  () => import("@/components/admin/scan/scan-camera-view").then((m) => m.ScanCameraView),
  { ssr: false, loading: () => <p className="text-gray-400">Loading scanner…</p> },
);

export default function ScanCameraPage() {
  return <ScanCameraView />;
}
