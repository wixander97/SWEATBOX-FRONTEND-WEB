"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import {
  dropInPassStatusMeta,
  type MemberDropInPass,
} from "@/lib/api/drop-in-passes";
import { formatClassCredits } from "@/components/admin/members/members.types";

/** The pass model lives with its service now; re-exported for existing callers. */
export type { MemberDropInPass };

type Props = {
  memberId: string;
  memberName: string;
  onClose: () => void;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function membershipBadge(status?: string) {
  const s = (status ?? "").toLowerCase();
  if (s === "active")
    return { label: "Active", class: "bg-green-500/10 text-success border-green-500/30" };
  if (s === "frozen")
    return { label: "Frozen", class: "bg-blue-500/10 text-info border-blue-500/30" };
  return { label: status || "—", class: "bg-gray-500/10 text-muted border-gray-500/30" };
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-b-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-fg-soft text-right">{String(value)}</span>
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
      className="fixed inset-0 bg-overlay z-50 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => { if (e.currentTarget === e.target) onClose(); }}
    >
      <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold font-display uppercase text-fg">
              Drop In Passes
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-fg-soft font-medium">{memberName}</span>
              {memberInfo?.memberCode && (
                <span className="text-xs font-mono text-accent-ink bg-sweat/10 px-2 py-0.5 rounded">
                  {memberInfo.memberCode}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-fg text-xl leading-none shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {loading ? (
            <div className="text-muted text-sm py-4">Loading...</div>
          ) : error ? (
            <div className="text-danger text-sm py-4">{error}</div>
          ) : passes.length === 0 ? (
            <div className="text-muted text-sm py-4">No passes found for this member.</div>
          ) : (
            <>
              {/* Member Info */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <i className="fas fa-user text-accent-ink w-4 text-sm" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">
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
                  <InfoRow
                    label="Remaining Credits"
                    value={
                      memberInfo ? formatClassCredits(memberInfo, "") : undefined
                    }
                  />
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
                  <i className="fas fa-ticket-alt text-accent-ink w-4 text-sm" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">
                    Passes ({passes.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {passes.map((p) => {
                    const badge = dropInPassStatusMeta(p);
                    return (
                      <div
                        key={p.id}
                        className="bg-sidebar rounded-lg border border-border px-4 py-3"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-semibold text-fg">
                            {p.branch?.branchName ?? "—"}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.class}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted">
                          <span>
                            <span className="text-accent-ink font-semibold">{p.remainingVisits}</span>{" "}
                            remaining of{" "}
                            <span className="text-fg-soft">{p.totalVisits}</span> visits
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 text-[11px] text-muted">
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
            className="w-full bg-sidebar border border-border text-fg-soft px-4 py-2.5 rounded-lg font-semibold hover:bg-sidebar/80 hover:text-fg transition text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
