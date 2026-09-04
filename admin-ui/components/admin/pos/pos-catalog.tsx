"use client";

import { useEffect, useMemo, useState } from "react";

import { errorMessageOf } from "@/lib/api/http";
import { listMembershipPlans, type MembershipPlan } from "@/lib/api/membership-plans";
import { isTemplatePackage, listPtPackages, type PtPackage } from "@/lib/api/pt-packages";
import {
  bookedCountOf,
  isBookable,
  listUpcomingClassSchedules,
  remainingSlotsOf,
  type ApiClass,
} from "@/lib/api/classes";
import {
  formatRupiah,
  newLineId,
  type CartItem,
  type ClassBookingCartItem,
  type MembershipCartItem,
} from "@/lib/pos/cart";
import { PosPtOptionsModal } from "./pos-pt-options-modal";

type Category = "all" | "membership" | "pt" | "class";

const CATEGORIES: Array<{ key: Category; label: string; icon: string }> = [
  { key: "all", label: "All", icon: "fa-th-large" },
  { key: "membership", label: "Membership", icon: "fa-ticket-alt" },
  { key: "pt", label: "PT Package", icon: "fa-id-badge" },
  { key: "class", label: "Classes", icon: "fa-calendar-alt" },
];

type Props = {
  onAdd: (item: CartItem) => void;
  /** Class schedules already queued in the cart, to prevent double booking. */
  bookedScheduleIds: string[];
  disabled?: boolean;
};

function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

function Card({
  title,
  subtitle,
  meta,
  price,
  disabled,
  disabledLabel,
  onClick,
}: {
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  price: string;
  disabled?: boolean;
  disabledLabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-left bg-card border border-border rounded-xl p-3 hover:border-sweat hover:bg-white/[0.03] transition disabled:opacity-40 disabled:hover:border-border disabled:cursor-not-allowed flex flex-col gap-1 min-h-[104px]"
    >
      <span className="text-sm font-bold text-white leading-tight line-clamp-2">{title}</span>
      {subtitle && <span className="text-[11px] text-gray-500 line-clamp-1">{subtitle}</span>}
      {meta && <span className="text-[11px] text-gray-400 line-clamp-1">{meta}</span>}
      <span className="mt-auto text-sm font-bold text-sweat">
        {disabled && disabledLabel ? disabledLabel : price}
      </span>
    </button>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-3 min-h-[104px] animate-pulse">
          <div className="h-4 bg-gray-700/50 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-700/40 rounded w-1/2 mb-2" />
          <div className="h-4 bg-gray-700/40 rounded w-2/3 mt-6" />
        </div>
      ))}
    </div>
  );
}

/**
 * The sellable catalogue: membership plans, PT packages and bookable classes.
 * Every card is one tap to add — the front desk should never need a menu dive.
 */
export function PosCatalog({ onAdd, bookedScheduleIds, disabled = false }: Props) {
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [packages, setPackages] = useState<PtPackage[]>([]);
  const [classes, setClasses] = useState<ApiClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ptTarget, setPtTarget] = useState<PtPackage | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const [planResult, pkgResult, classResult] = await Promise.allSettled([
        listMembershipPlans(),
        listPtPackages(),
        listUpcomingClassSchedules(),
      ]);
      if (cancelled) return;
      const problems: string[] = [];
      if (planResult.status === "fulfilled") setPlans(planResult.value);
      else problems.push(errorMessageOf(planResult.reason, "membership plan"));
      if (pkgResult.status === "fulfilled") {
        setPackages(pkgResult.value.filter((p) => isTemplatePackage(p) && p.isActive !== false));
      } else problems.push(errorMessageOf(pkgResult.reason, "PT package"));
      if (classResult.status === "fulfilled") setClasses(classResult.value);
      else problems.push(errorMessageOf(classResult.reason, "class schedule"));
      if (problems.length > 0) setError(problems.join(" · "));
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const term = search.trim().toLowerCase();
  const matches = (...values: Array<string | null | undefined>) =>
    !term || values.some((v) => (v ?? "").toLowerCase().includes(term));

  const visiblePlans = useMemo(
    () =>
      category === "all" || category === "membership"
        ? plans.filter((p) => matches(p.planName, p.description, p.planCategory))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plans, category, term]
  );

  const visiblePackages = useMemo(
    () =>
      category === "all" || category === "pt"
        ? packages.filter((p) => matches(p.name, p.description, p.coachName))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [packages, category, term]
  );

  const visibleClasses = useMemo(
    () =>
      category === "all" || category === "class"
        ? classes
            .filter((c) => matches(c.className, c.coachName, c.branchName, c.classType))
            .sort((a, b) =>
              `${a.classDate}${a.startTime}`.localeCompare(`${b.classDate}${b.startTime}`)
            )
            .slice(0, category === "class" ? 60 : 8)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classes, category, term]
  );

  const isEmpty =
    !loading &&
    visiblePlans.length === 0 &&
    visiblePackages.length === 0 &&
    visibleClasses.length === 0;

    function addPlan(plan: MembershipPlan) {
    const item: MembershipCartItem = {
      lineId: newLineId(),
      kind: "membership",
      name: plan.planName,
      price: plan.price ?? 0,
      plan,
    };
    onAdd(item);
  }

  function addClass(schedule: ApiClass) {
    const item: ClassBookingCartItem = {
      lineId: newLineId(),
      kind: "class",
      name: schedule.className,
      price: 0,
      schedule,
    };
    onAdd(item);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 sm:p-5 border-b border-border space-y-3">
        <div className="relative">
          <i
            className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none"
            aria-hidden
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari membership, PT package, atau class"
            className="w-full bg-sidebar border border-border text-white pl-10 pr-9 py-3 rounded-lg text-sm focus:outline-none focus:border-sweat"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              aria-label="Clear search"
            >
              <i className="fas fa-times" aria-hidden />
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={`px-3 py-2 rounded-lg text-xs font-bold border transition flex items-center gap-2 ${
                category === c.key
                  ? "bg-sweat text-black border-sweat"
                  : "bg-sidebar border-border text-gray-400 hover:text-white"
              }`}
            >
              <i className={`fas ${c.icon}`} aria-hidden />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
            {error}
          </p>
        )}

        {loading ? (
          <SkeletonGrid />
        ) : isEmpty ? (
          <div className="text-center py-16">
            <i className="fas fa-box-open text-3xl text-gray-700 mb-3 block" aria-hidden />
            <p className="text-sm text-gray-500">Tidak ada item yang cocok.</p>
          </div>
        ) : (
          <>
            {visiblePlans.length > 0 && (
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Membership
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {visiblePlans.map((plan) => (
                    <Card
                      key={plan.id}
                      title={plan.planName}
                      subtitle={`${plan.validityDays} hari · ${
                        plan.isUnlimitedClasses ? "Unlimited class" : `${plan.credits} credit`
                      }`}
                      meta={
                        plan.isPtIncluded
                          ? `Termasuk ${plan.ptSessions ?? 0} sesi PT`
                          : plan.planCategory
                      }
                      price={formatRupiah(plan.price ?? 0)}
                      disabled={disabled}
                      onClick={() => addPlan(plan)}
                    />
                  ))}
                </div>
              </section>
            )}

            {visiblePackages.length > 0 && (
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                  PT Package
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {visiblePackages.map((pkg) => (
                    <Card
                      key={pkg.id}
                      title={pkg.name}
                      subtitle={`${pkg.sessionCount ?? 0} sesi`}
                      meta={pkg.coachName ? `Coach ${pkg.coachName}` : pkg.branchName}
                      price={formatRupiah(pkg.price ?? 0)}
                      disabled={disabled}
                      onClick={() => setPtTarget(pkg)}
                    />
                  ))}
                </div>
              </section>
            )}

            {visibleClasses.length > 0 && (
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Classes
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {visibleClasses.map((c) => {
                    const already = bookedScheduleIds.includes(c.id);
                    const full = !isBookable(c);
                    return (
                      <Card
                        key={c.id}
                        title={c.className}
                        subtitle={`${formatDate(c.classDate)} · ${c.startTime?.slice(0, 5) ?? "-"}–${c.endTime?.slice(0, 5) ?? "-"}`}
                        meta={`${c.coachName ?? "-"} · ${c.branchName ?? "-"}`}
                        price={`${bookedCountOf(c)} / ${c.capacity ?? 0} · ${remainingSlotsOf(c)} slot`}
                        disabled={disabled || already || full}
                        disabledLabel={already ? "Sudah di cart" : full ? "Penuh / tidak aktif" : undefined}
                        onClick={() => addClass(c)}
                      />
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {ptTarget && (
        <PosPtOptionsModal
          pkg={ptTarget}
          onClose={() => setPtTarget(null)}
          onAdd={(item) => {
            setPtTarget(null);
            onAdd(item);
          }}
        />
      )}
    </div>
  );
}
