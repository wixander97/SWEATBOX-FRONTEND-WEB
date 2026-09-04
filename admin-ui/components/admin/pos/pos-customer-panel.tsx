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
import { isOwnedBy, listPtPackages, type PtPackage } from "@/lib/api/pt-packages";
import { PosQuickRegisterModal } from "./pos-quick-register-modal";

type Props = {
  customer: ApiMember | null;
  onSelect: (member: ApiMember | null) => void;
  /** Locked while a checkout is in flight so the customer cannot change mid-payment. */
  locked?: boolean;
};

function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("id-ID");
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

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-1">
      <span className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-xs text-gray-200 text-right truncate">{value}</span>
    </div>
  );
}

/**
 * Customer search / selection plus the compact context panel.
 *
 * The selected customer stays put while staff add memberships, PT packages and
 * class bookings — it is only cleared explicitly or after a completed sale.
 */
export function PosCustomerPanel({ customer, onSelect, locked = false }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  const [detail, setDetail] = useState<ApiMember | null>(null);
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
        setSearchError(errorMessageOf(err, "Gagal mencari customer"));
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
    const [detailResult, packagesResult, bookingsResult] = await Promise.allSettled([
      getMember(member.id),
      listPtPackages(),
      listMemberUpcomingBookings(member.id),
    ]);
    if (detailResult.status === "fulfilled" && detailResult.value) {
      setDetail(detailResult.value);
    }
    if (packagesResult.status === "fulfilled") {
      setPtPackages(packagesResult.value.filter((p) => isOwnedBy(p, member.id)));
    }
    if (bookingsResult.status === "fulfilled") {
      setBookings(bookingsResult.value);
    }
    setContextLoading(false);
  }, []);

  useEffect(() => {
    if (!customer) {
      setDetail(null);
      setPtPackages([]);
      setBookings([]);
      return;
    }
    void loadContext(customer);
  }, [customer, loadContext]);

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

  const activePt = useMemo(
    () => ptPackages.filter((p) => p.isActive !== false),
    [ptPackages]
  );

  const m = detail ?? customer;

  return (
    <div className="border-b border-border">
      {!customer ? (
        <div className="p-4" ref={wrapperRef}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
            Customer
          </p>
          <div className="relative">
            <i
              className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.trim().length >= 2 && setShowResults(true)}
              placeholder="Cari phone, email, nama, atau member code"
              className="w-full bg-sidebar border border-border text-white pl-9 pr-9 py-2.5 rounded-lg text-sm focus:outline-none focus:border-sweat"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-sweat border-t-transparent" />
            )}
          </div>

          {showResults && (
            <div className="mt-2 bg-sidebar border border-border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {searchError ? (
                <p className="px-3 py-3 text-xs text-red-400">{searchError}</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-3 text-xs text-gray-500">
                  {searching ? "Mencari..." : "Customer tidak ditemukan."}
                </p>
              ) : (
                results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => select(r)}
                    className="w-full text-left px-3 py-2.5 hover:bg-white/5 border-b border-border/60 last:border-b-0 transition"
                  >
                    <p className="text-sm text-white font-semibold truncate">
                      {memberDisplayName(r)}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
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
            className="mt-2 w-full bg-sidebar border border-dashed border-border text-gray-300 hover:text-white hover:border-sweat py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2"
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
              <p className="text-sm font-bold text-white truncate">
                {memberDisplayName(m)}
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                {m?.phoneNumber || "-"}
              </p>
              <p className="text-[11px] text-gray-500 truncate">{m?.email || "-"}</p>
              {m?.memberCode && (
                <span className="inline-block mt-1 text-[10px] font-mono text-sweat">
                  {m.memberCode}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onSelect(null)}
              disabled={locked}
              title={locked ? "Selesaikan transaksi dulu" : "Ganti customer"}
              className="text-gray-500 hover:text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Clear customer"
            >
              <i className="fas fa-times" aria-hidden />
            </button>
          </div>

          <div className="mt-3 bg-sidebar rounded-lg border border-border px-3 py-2">
            {contextLoading && !detail ? (
              <p className="text-xs text-gray-500 py-1">Memuat data customer...</p>
            ) : (
              <>
                <ContextRow
                  label="Membership"
                  value={
                    m?.membershipPlanName
                      ? `${m.membershipPlanName}${m.membershipStatus ? ` · ${m.membershipStatus}` : ""}`
                      : "Belum ada membership aktif"
                  }
                />
                {m?.expiryDate && (
                  <ContextRow label="Expiry" value={formatDate(m.expiryDate)} />
                )}
                <ContextRow
                  label="Credits"
                  value={`${m?.remainingCredits ?? 0} class credit`}
                />
                <ContextRow
                  label="PT"
                  value={
                    activePt.length > 0
                      ? `${activePt[0].name} · ${m?.remainingPtSessions ?? 0} sesi tersisa`
                      : `${m?.remainingPtSessions ?? 0} sesi PT tersisa`
                  }
                />
                <div className="pt-1 mt-1 border-t border-border/60">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">
                    Upcoming classes
                  </p>
                  {upcoming.length === 0 ? (
                    <p className="text-xs text-gray-600">Tidak ada booking mendatang.</p>
                  ) : (
                    upcoming.map((b) => (
                      <p key={b.id} className="text-xs text-gray-300 truncate">
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
