"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

type Coach = {
  id: string;
  fullName?: string | null;
  specialization?: string | null;
  profileImageUrl?: string | null;
  rating?: number;
  totalClasses?: number;
  totalMembers?: number;
  isActive?: boolean;
};

type CoachDetail = Coach & {
  email?: string | null;
  phoneNumber?: string | null;
  bio?: string | null;
};

export function CoachesView() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [selected, setSelected] = useState<CoachDetail | null>(null);

  const loadCoaches = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/coaches", { cache: "no-store" });
    const payload = (await res.json().catch(() => [])) as
      | Coach[]
      | { data?: Coach[]; items?: Coach[]; message?: string };
    if (!res.ok) {
      const msg =
        typeof payload === "object" && !Array.isArray(payload)
          ? payload.message
          : "Failed to fetch coaches";
      setError(msg || "Failed to fetch coaches");
      setCoaches([]);
      setLoading(false);
      return;
    }
    if (Array.isArray(payload)) setCoaches(payload);
    else setCoaches(payload.data || payload.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCoaches();
  }, [loadCoaches]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setDetailError("");
    setSelected(null);
    const res = await fetch(`/api/coaches/${id}`, { cache: "no-store" });
    const payload = (await res.json().catch(() => ({}))) as CoachDetail & {
      data?: CoachDetail;
      message?: string;
    };
    if (!res.ok) {
      setDetailError(payload.message || "Failed to fetch detail");
      setDetailLoading(false);
      return;
    }
    setSelected(payload.data || payload);
    setDetailLoading(false);
  }

  return (
    <>
      {loading ? (
        <div className="text-gray-400">Loading coaches...</div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : coaches.length === 0 ? (
        <div className="text-gray-400">No coaches found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {coaches.map((coach) => (
            <div
              key={coach.id}
              className="bg-card rounded-xl border border-border p-6 text-center group hover:border-sweat transition"
            >
              <div className="w-24 h-24 bg-gray-700 rounded-full mx-auto mb-4 overflow-hidden border-2 border-transparent group-hover:border-sweat transition">
                <Image
                  src={
                    coach.profileImageUrl ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      coach.fullName || "Coach"
                    )}&background=random`
                  }
                  alt=""
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              <h3 className="font-bold text-xl text-white">
                {coach.fullName || "-"}
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                {coach.specialization || "No specialization"}
              </p>
              <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-left">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Total Classes</p>
                  <p className="font-bold text-lg text-white">
                    {coach.totalClasses ?? 0}{" "}
                    <span className="text-xs font-normal">/mo</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Rating</p>
                  <p className="font-bold text-lg text-sweat">
                    {coach.rating ?? 0}{" "}
                    <i className="fas fa-star text-xs" aria-hidden />
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void openDetail(coach.id)}
                className="w-full mt-4 bg-white/5 hover:bg-white/10 text-white py-2 rounded-lg text-sm border border-border transition"
              >
                View Detail
              </button>
            </div>
          ))}
        </div>
      )}

      {(detailLoading || detailError || selected) && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm"
          onClick={(e) => {
            if (e.currentTarget === e.target) {
              setSelected(null);
              setDetailError("");
              setDetailLoading(false);
            }
          }}
        >
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold font-display uppercase">
                Coach Detail
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setDetailError("");
                  setDetailLoading(false);
                }}
                className="text-gray-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>
            {detailLoading ? (
              <p className="text-gray-400">Loading detail...</p>
            ) : detailError ? (
              <p className="text-red-400">{detailError}</p>
            ) : selected ? (
              <div className="space-y-2 text-sm text-gray-300">
                <p>
                  <span className="text-gray-500">Name:</span>{" "}
                  {selected.fullName || "-"}
                </p>
                <p>
                  <span className="text-gray-500">Email:</span>{" "}
                  {selected.email || "-"}
                </p>
                <p>
                  <span className="text-gray-500">Phone:</span>{" "}
                  {selected.phoneNumber || "-"}
                </p>
                <p>
                  <span className="text-gray-500">Specialization:</span>{" "}
                  {selected.specialization || "-"}
                </p>
                <p>
                  <span className="text-gray-500">Total Members:</span>{" "}
                  {selected.totalMembers ?? 0}
                </p>
                <p>
                  <span className="text-gray-500">Bio:</span>{" "}
                  {selected.bio || "-"}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
