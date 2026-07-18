"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import {
  redirectTypeLabel,
  type ApiPromoBanner,
} from "@/components/admin/promo-banner/promo-banners.types";
import { PromoBannerFormModal } from "@/components/admin/promo-banner/promo-banner-form-modal";
import { PromoBannerDetailModal } from "@/components/admin/promo-banner/promo-banner-detail-modal";

type FilterMode = "all" | "active";

async function extractMessage(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => ({}))) as { message?: string };
  return payload.message || "";
}

export function PromoBannersView() {
  const [banners, setBanners] = useState<ApiPromoBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiPromoBanner | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const loadBanners = useCallback(async (mode: FilterMode) => {
    setLoading(true);
    setError("");
    const url =
      mode === "active"
        ? `${API_BASE_URL}/api/PromoBanners/active`
        : `${API_BASE_URL}/api/PromoBanners`;
    try {
      const res = await authFetch(url, { cache: "no-store" });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      const data = (await res.json().catch(() => [])) as
        | ApiPromoBanner[]
        | { message?: string };
      if (!res.ok) {
        const msg =
          !Array.isArray(data) && data?.message
            ? data.message
            : "Gagal mengambil promo banners";
        setError(msg);
        setBanners([]);
      } else {
        setBanners(Array.isArray(data) ? data : []);
      }
    } catch {
      setError("Gagal mengambil promo banners");
      setBanners([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBanners(filterMode);
  }, [filterMode, loadBanners]);

  async function createBanner(fd: FormData) {
    const res = await authFetch(`${API_BASE_URL}/api/PromoBanners`, {
      method: "POST",
      body: fd,
    });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    if (!res.ok) {
      throw new Error((await extractMessage(res)) || "Create promo banner gagal");
    }
    await loadBanners(filterMode);
  }

  async function updateBanner(id: string, fd: FormData) {
    const res = await authFetch(`${API_BASE_URL}/api/PromoBanners/${id}`, {
      method: "PUT",
      body: fd,
    });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    if (!res.ok) {
      throw new Error((await extractMessage(res)) || "Update promo banner gagal");
    }
    await loadBanners(filterMode);
  }

  async function deleteBanner(id: string) {
    const yes = window.confirm("Delete this promo banner?");
    if (!yes) return;
    const res = await authFetch(`${API_BASE_URL}/api/PromoBanners/${id}`, {
      method: "DELETE",
    });
    if (redirectToLoginIfUnauthorized(res.status)) return;
    if (!res.ok) {
      const msg = (await extractMessage(res)) || "Delete promo banner gagal";
      window.alert(msg);
      return;
    }
    await loadBanners(filterMode);
  }

  function openEdit(banner: ApiPromoBanner) {
    setEditTarget(banner);
    setEditOpen(true);
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as FilterMode)}
                className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-sweat"
              >
                <option value="all">All Banners</option>
                <option value="active">Active Banners</option>
              </select>
            </div>
            <p className="text-[11px] text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-bold uppercase tracking-wide text-gray-400">
                Status
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400" aria-hidden />
                Active
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400" aria-hidden />
                Inactive
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <i className="fas fa-plus" aria-hidden />
            Create New Banner
          </button>
        </div>

        {error && (
          <div className="p-4 sm:p-6 bg-red-500/10 border-b border-red-500/30 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="py-10 text-center text-gray-400 text-sm">
              <i className="fas fa-spinner fa-spin mr-2" aria-hidden />
              Loading...
            </div>
          ) : banners.length === 0 ? (
            <div className="py-10 text-center text-gray-500 text-sm">
              No promo banners found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {banners.map((b) => (
                <div
                  key={b.id}
                  className="bg-sidebar border border-border rounded-xl overflow-hidden flex flex-col"
                >
                  <div className="relative w-full aspect-[16/9] bg-black/30">
                    {b.imageUrl ? (
                      <Image
                        src={b.imageUrl}
                        alt={b.title || "promo banner"}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                        <i className="fas fa-image text-3xl" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col gap-2 grow">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-white leading-tight line-clamp-2">
                        {b.title || "—"}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                          b.isActive
                            ? "bg-green-500/15 text-green-200 border border-green-500/35"
                            : "bg-red-500/15 text-red-200 border border-red-500/35"
                        }`}
                      >
                        {b.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {b.description && (
                      <p className="text-xs text-gray-400 line-clamp-2">
                        {b.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-card border border-border text-gray-300">
                        <i className="fas fa-directions mr-1" aria-hidden />
                        {redirectTypeLabel(b.redirectType)}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-card border border-border text-gray-300">
                        Order: {b.displayOrder ?? 0}
                      </span>
                    </div>
                    <div className="mt-auto pt-3 flex items-center gap-1 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setDetailId(b.id)}
                        className="flex-1 text-xs py-1.5 rounded text-gray-300 hover:text-white hover:bg-white/5 transition"
                      >
                        <i className="fas fa-eye mr-1" aria-hidden />
                        Detail
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(b)}
                        className="flex-1 text-xs py-1.5 rounded text-gray-300 hover:text-white hover:bg-white/5 transition"
                      >
                        <i className="fas fa-pen mr-1" aria-hidden />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteBanner(b.id)}
                        className="flex-1 text-xs py-1.5 rounded text-red-400 hover:text-red-300 hover:bg-white/5 transition"
                      >
                        <i className="fas fa-trash mr-1" aria-hidden />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PromoBannerFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={createBanner}
      />

      {editTarget && (
        <PromoBannerFormModal
          isOpen={editOpen}
          isEdit
          initialValues={editTarget}
          onClose={() => {
            setEditOpen(false);
            setEditTarget(null);
          }}
          onSubmit={(fd) => updateBanner(editTarget.id, fd)}
        />
      )}

      {detailId && (
        <PromoBannerDetailModal
          bannerId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </>
  );
}