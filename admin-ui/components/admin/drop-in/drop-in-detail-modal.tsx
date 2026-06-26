"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";

export type MemberDropInPass = {
  id: string;
  memberId: string;
  member: {
    fullName: string;
    memberCode: string;
    email?: string;
    phoneNumber?: string;
    membershipStatus?: string;
    remainingCredits?: number;
    remainingPtSessions?: number;
    joinDate?: string;
    expiryDate?: string;
  };
  branchId: string;
  branch: {
    branchName: string;
  };
  totalVisits: number;
  remainingVisits: number;
  purchasedAt: string;
  expiredAt: string;
  isActive: boolean;
};

type Props = {
  memberId: string;
  memberName: string;
  onClose: () => void;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function statusBadge(active: boolean) {
  return active
    ? { label: "Active", class: "bg-green-500/10 text-green-400 border-green-500/30" }
    : { label: "Expired", class: "bg-red-500/10 text-red-400 border-red-500/30" };
}

function membershipBadge(status?: string) {
  const s = (status ?? "").toLowerCase();
  if (s === "active")
    return { label: "Active", class: "bg-green-500/10 text-green-400 border-green-500/30" };
  if (s === "frozen")
    return { label: "Frozen", class: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
  return { label: status || "—", class: "bg-gray-500/10 text-gray-400 border-gray-500/30" };
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-b-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-gray-200 text-right">{String(value)}</span>
    </div>
  );
}

export function DropInDetailModal({ memberId, memberName, onClose }: Props) {
  const [passes, setPasses] = useState<MemberDropInPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await authFetch(
          `${API_BASE_URL}/api/member-drop-in-passes/member/${memberId}`,
          { cache: "no-store" }
        );
        const data = (await res.json().catch(() => [])) as MemberDropInPass[];
        if (!cancelled) {
          if (!res.ok) {
            setError("Failed to load passes");
            setPasses([]);
          } else {
            setPasses(Array.isArray(data) ? data : []);
          }
        }
      } catch {
        if (!cancelled) setError("Failed to load passes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [memberId]);

  const memberInfo = passes[0]?.member;
  const mb = membershipBadge(memberInfo?.membershipStatus);

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => { if (e.currentTarget === e.target) onClose(); }}
    >
      <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold font-display uppercase text-white">
              Drop In Passes
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-gray-300 font-medium">{memberName}</span>
              {memberInfo?.memberCode && (
                <span className="text-xs font-mono text-sweat bg-sweat/10 px-2 py-0.5 rounded">
                  {memberInfo.memberCode}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {loading ? (
            <div className="text-gray-400 text-sm py-4">Loading...</div>
          ) : error ? (
            <div className="text-red-400 text-sm py-4">{error}</div>
          ) : passes.length === 0 ? (
            <div className="text-gray-400 text-sm py-4">No passes found for this member.</div>
          ) : (
            <>
              {/* Member Info */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <i className="fas fa-user text-sweat w-4 text-sm" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Member Info
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${mb.class}`}
                  >
                    {mb.label}
                  </span>
                </div>
                <div className="bg-sidebar rounded-lg border border-border px-3 py-1">
                  <InfoRow label="Email" value={memberInfo?.email} />
                  <InfoRow label="Phone" value={memberInfo?.phoneNumber} />
                  <InfoRow label="Remaining Credits" value={memberInfo?.remainingCredits} />
                  <InfoRow label="Remaining PT Sessions" value={memberInfo?.remainingPtSessions} />
                  <InfoRow
                    label="Join Date"
                    value={memberInfo?.joinDate ? formatDate(memberInfo.joinDate) : null}
                  />
                  <InfoRow
                    label="Expiry Date"
                    value={memberInfo?.expiryDate ? formatDate(memberInfo.expiryDate) : null}
                  />
                </div>
              </div>

              {/* Passes */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <i className="fas fa-ticket-alt text-sweat w-4 text-sm" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Passes ({passes.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {passes.map((p) => {
                    const badge = statusBadge(p.isActive);
                    return (
                      <div
                        key={p.id}
                        className="bg-sidebar rounded-lg border border-border px-4 py-3"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-semibold text-white">
                            {p.branch?.branchName ?? "—"}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.class}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>
                            <span className="text-sweat font-semibold">{p.remainingVisits}</span>{" "}
                            remaining of{" "}
                            <span className="text-gray-300">{p.totalVisits}</span> visits
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 text-[11px] text-gray-500">
                          <span>Purchased: {formatDate(p.purchasedAt)}</span>
                          <span>Expires: {formatDate(p.expiredAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 sm:p-6 pt-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-sidebar border border-border text-gray-300 px-4 py-2.5 rounded-lg font-semibold hover:bg-sidebar/80 hover:text-white transition text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
