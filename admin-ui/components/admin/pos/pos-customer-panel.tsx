"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { errorMessageOf } from "@/lib/api/http";
import {
  getMember,
  memberDisplayName,
  searchMembers,
  type ApiMember,
} from "@/lib/api/members";
import { listMemberUpcomingBookings, type ClassBooking } from "@/lib/api/classes";
import { listMemberPtPackages, type PtPackage } from "@/lib/api/pt-packages";
import {
  getMembershipPlan,
  membershipKindOf,
  type MembershipKind,
  type MembershipPlan,
} from "@/lib/api/membership-plans";
import { PosQuickRegisterModal } from "./pos-quick-register-modal";

type Props = {
  customer: ApiMember | null;
  onSelect: (member: ApiMember | null) => void;
  /** Locked while a checkout is in flight so the customer cannot change mid-payment. */
  locked?: boolean;
  /** Bumped by the POS after a sale or a booking, to re-read the context. */
  refreshKey?: number;
};

function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-GB");
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function ContextRow({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "warn";
}) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-1">
      <span className="text-[11px] text-muted uppercase tracking-wide">{label}</span>
      <span
        className={`text-xs text-right truncate ${
          tone === "warn" ? "text-red-500 font-semibold" : "text-fg-soft"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/** What the front desk needs to know about class entitlement, in one line. */
function creditsLabel(
  kind: MembershipKind | null,
  remainingCredits: number
): { value: string; tone: "normal" | "warn" } {
  switch (kind) {
    case "unlimited":
      return { value: "Unlimited · no credits used", tone: "normal" };
    case "regular":
      return { value: "Gym access · cannot book classes", tone: "normal" };
    case "credit":
      return {
        value: `${remainingCredits} class credit`,
        tone: remainingCredits > 0 ? "normal" : "warn",
      };
    default:
      return { value: `${remainingCredits} class credit`, tone: "normal" };
  }
}

/**
 * Customer search / selection plus the compact context panel.
 *
 * The selected customer stays put while staff add memberships and PT packages
 * and book classes — it is only cleared explicitly or after a completed sale.
 *
 * The context deliberately mirrors what `ClassBookingService` will actually
 * enforce (active, paid, unexpired, and either credits, an unlimited plan, or a
 * plan that allows classes at all) so staff can see a refusal coming instead of
 * discovering it at the booking modal.
 */
export function PosCustomerPanel({
  customer,
  onSelect,
  locked = false,
  refreshKey = 0,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  const [detail, setDetail] = useState<ApiMember | null>(null);
  const [plan, setPlan] = useState<MembershipPlan | null>(null);
  const [ptPackages, setPtPackages] = useState<PtPackage[]>([]);
  const [bookings, setBookings] = useState<ClassBooking[]>([]);
  const [contextLoading, setContextLoading] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced customer lookup by phone / email / name / member code.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setShowResults(false);
      setSearchError("");
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const list = await searchMembers(trimmed);
        setResults(list);
        setShowResults(true);
      } catch (err) {
        setSearchError(errorMessageOf(err, "Failed to search customers"));
        setResults([]);
        setShowResults(true);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const loadContext = useCallback(async (member: ApiMember) => {
    setContextLoading(true);
    setDetail(member);
    setPtPackages([]);
    setBookings([]);
    setPlan(null);

    const [detailResult, packagesResult, bookingsResult] = await Promise.allSettled([
      getMember(member.id),
      // The backend's own assignment lookup, not a client-side scan of every
      // package in the system.
      listMemberPtPackages(member.id),
      listMemberUpcomingBookings(member.id),
    ]);

    const resolved =
      detailResult.status === "fulfilled" && detailResult.value
        ? detailResult.value
        : member;
    setDetail(resolved);

    if (packagesResult.status === "fulfilled") {
      setPtPackages(packagesResult.value.filter((p) => p.isActive !== false));
    }
    if (bookingsResult.status === "fulfilled") {
      setBookings(bookingsResult.value);
    }

    // The plan carries the unlimited / regular flags the member record does not.
    if (resolved.membershipPlanId) {
      try {
        setPlan(await getMembershipPlan(resolved.membershipPlanId));
      } catch {
        setPlan(null);
      }
    }

    setContextLoading(false);
  }, []);

  useEffect(() => {
    if (!customer) {
      setDetail(null);
      setPtPackages([]);
      setBookings([]);
      setPlan(null);
      return;
    }
    void loadContext(customer);
  }, [customer, loadContext, refreshKey]);

  function select(member: ApiMember) {
    setQuery("");
    setResults([]);
    setShowResults(false);
    onSelect(member);
  }

  // `/member/{id}/upcoming` already filters by date backend-side.
  const upcoming = useMemo(
    () =>
      bookings
        .filter((b) => !b.isCancelled)
        .sort((a, b) => String(a.classDate).localeCompare(String(b.classDate)))
        .slice(0, 3),
    [bookings]
  );

  const m = detail ?? customer;
  const kind = membershipKindOf(plan);
  const credits = creditsLabel(kind, m?.remainingCredits ?? 0);
  const expired = m?.isExpired === true;
  const inactive = (m?.membershipStatus ?? "").toLowerCase() !== "active";

  return (
    <div className="border-b border-border">
      {!customer ? (
        <div className="p-4" ref={wrapperRef}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
            Customer
          </p>
          <div className="relative">
            <i
              className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.trim().length >= 2 && setShowResults(true)}
              placeholder="Search by phone, email, name, or member code"
              className="w-full bg-sidebar border border-border text-fg pl-9 pr-9 py-2.5 rounded-lg text-sm focus:outline-none focus:border-sweat"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-sweat border-t-transparent" />
            )}
          </div>

          {showResults && (
            <div className="mt-2 bg-sidebar border border-border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {searchError ? (
                <p className="px-3 py-3 text-xs text-red-500">{searchError}</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted">
                  {searching ? "Searching..." : "No customers found."}
                </p>
              ) : (
                results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => select(r)}
                    className="w-full text-left px-3 py-2.5 hover:bg-sweat/10 border-b border-border/60 last:border-b-0 transition"
                  >
                    <p className="text-sm text-fg font-semibold truncate">
                      {memberDisplayName(r)}
                    </p>
                    <p className="text-[11px] text-muted truncate">
                      {r.phoneNumber || "-"} · {r.email || "-"}
                    </p>
                  </button>
                ))
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setRegisterOpen(true)}
            data-help-target="pos-quick-register"
            className="mt-2 w-full bg-sidebar border border-dashed border-border text-fg-soft hover:text-fg hover:border-sweat py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2"
          >
            <i className="fas fa-user-plus text-xs" aria-hidden />
            Quick Register
          </button>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-sweat text-black font-bold flex items-center justify-center shrink-0">
              {initialsOf(memberDisplayName(m))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-fg truncate">{memberDisplayName(m)}</p>
              <p className="text-[11px] text-muted truncate">{m?.phoneNumber || "-"}</p>
              <p className="text-[11px] text-muted truncate">{m?.email || "-"}</p>
              {m?.memberCode && (
                <span className="inline-block mt-1 text-[10px] font-mono text-accent-ink">
                  {m.memberCode}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onSelect(null)}
              disabled={locked}
              title={locked ? "Complete the transaction first" : "Change customer"}
              className="text-muted hover:text-fg text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Clear customer"
            >
              <i className="fas fa-times" aria-hidden />
            </button>
          </div>

          <div className="mt-3 bg-sidebar rounded-lg border border-border px-3 py-2">
            {contextLoading && !detail ? (
              <p className="text-xs text-muted py-1">Loading customer data...</p>
            ) : (
              <>
                <ContextRow
                  label="Membership"
                  value={
                    m?.membershipPlanName
                      ? `${m.membershipPlanName}${m.membershipStatus ? ` · ${m.membershipStatus}` : ""}`
                      : "No active membership"
                  }
                  tone={m?.membershipPlanName && inactive ? "warn" : "normal"}
                />
                {m?.expiryDate && (
                  <ContextRow
                    label="Expiry"
                    value={expired ? `${formatDate(m.expiryDate)} · expired` : formatDate(m.expiryDate)}
                    tone={expired ? "warn" : "normal"}
                  />
                )}
                <ContextRow label="Credits" value={credits.value} tone={credits.tone} />
                <ContextRow
                  label="PT sessions"
                  value={`${m?.remainingPtSessions ?? 0} sessions remaining`}
                />
                <ContextRow
                  label="Drop in"
                  value={`${m?.remainingDropInVisits ?? 0} visits remaining`}
                />
                {(m?.emergencyContactName || m?.emergencyContactPhone) && (
                  <ContextRow
                    label="Emergency"
                    value={[
                      m?.emergencyContactName,
                      m?.emergencyContactRelation,
                      m?.emergencyContactPhone,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                )}
                {m?.injuryAllergies && (
                  <ContextRow label="Injury / allergies" value={m.injuryAllergies} tone="warn" />
                )}

                <div className="pt-1 mt-1 border-t border-border/60">
                  <p className="text-[11px] text-muted uppercase tracking-wide mb-1">
                    PT package assigned
                  </p>
                  {ptPackages.length === 0 ? (
                    <p className="text-xs text-muted">No packages assigned yet.</p>
                  ) : (
                    ptPackages.slice(0, 3).map((p) => (
                      <p key={p.id} className="text-xs text-fg-soft truncate">
                        {p.name} · {p.sessionCount ?? 0} sessions
                      </p>
                    ))
                  )}
                </div>

                <div className="pt-1 mt-1 border-t border-border/60">
                  <p className="text-[11px] text-muted uppercase tracking-wide mb-1">
                    Upcoming classes
                  </p>
                  {upcoming.length === 0 ? (
                    <p className="text-xs text-muted">No upcoming bookings.</p>
                  ) : (
                    upcoming.map((b) => (
                      <p key={b.id} className="text-xs text-fg-soft truncate">
                        {formatDate(b.classDate)} {b.startTime?.slice(0, 5) ?? ""} ·{" "}
                        {b.className ?? "-"}
                      </p>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {registerOpen && (
        <PosQuickRegisterModal
          initialQuery={query}
          onClose={() => setRegisterOpen(false)}
          onCreated={(member) => {
            setRegisterOpen(false);
            select(member);
          }}
        />
      )}
    </div>
  );
}
