"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import {
  redirectTypeLabel,
  type ApiPromoBanner,
} from "@/components/admin/promo-banner/promo-banners.types";

type Props = {
  bannerId: string;
  onClose: () => void;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-b-0 gap-3">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-200 text-right break-words">{String(value ?? "—")}</span>
    </div>
  );
}

export function PromoBannerDetailModal({ bannerId, onClose }: Props) {
  const [banner, setBanner] = useState<ApiPromoBanner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await authFetch(`${API_BASE_URL}/api/PromoBanners/${bannerId}`, {
          cache: "no-store",
        });
        if (redirectToLoginIfUnauthorized(res.status)) return;
        const data = (await res.json().catch(() => ({}))) as ApiPromoBanner & {
          message?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.message || "Gagal mengambil detail promo banner");
          setBanner(null);
        } else {
          setBanner(data);
        }
      } catch {
        if (!cancelled) setError("Gagal mengambil detail promo banner");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [bannerId]);

  return (
    <div
      id="modal-overlay"
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
        id="modal-box"
        role="dialog"
        aria-labelledby="modal-title"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold font-display uppercase" id="modal-title">
            Promo Banner Detail
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none shrink-0"
            aria-label="Close modal"
          >
            <i className="fas fa-times" aria-hidden />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-200 text-sm rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-gray-400 text-sm">
            <i className="fas fa-spinner fa-spin mr-2" aria-hidden />
            Loading...
          </div>
        ) : (
          banner && (
            <div className="space-y-4">
              {banner.imageUrl && (
                <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border border-border bg-sidebar">
                  <Image
                    src={banner.imageUrl}
                    alt={banner.title || "promo banner"}
                    fill
                    sizes="(max-width: 768px) 100vw, 32rem"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}
              <div className="bg-sidebar rounded-lg border border-border px-4 py-2">
                <InfoRow label="Title" value={banner.title} />
                <InfoRow label="Description" value={banner.description} />
                <InfoRow label="Redirect Type" value={redirectTypeLabel(banner.redirectType)} />
                <InfoRow label="Redirect Value" value={banner.redirectValue} />
                <InfoRow label="Display Order" value={banner.displayOrder} />
                <InfoRow label="Start Date" value={formatDate(banner.startDate)} />
                <InfoRow label="End Date" value={formatDate(banner.endDate)} />
                <InfoRow label="Active" value={banner.isActive ? "Yes" : "No"} />
              </div>
            </div>
          )
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full bg-sidebar border border-border text-gray-300 px-4 py-2.5 rounded-lg font-semibold hover:bg-sidebar/80 hover:text-white transition text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}