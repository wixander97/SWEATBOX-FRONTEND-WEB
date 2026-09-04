"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { errorMessageOf } from "@/lib/api/http";
import {
  isDropInPlan,
  listMembershipPlans,
  type MembershipPlan,
} from "@/lib/api/membership-plans";
import {
  isTemplatePackage,
  listMemberPtPackages,
  listPtPackages,
  type PtPackage,
} from "@/lib/api/pt-packages";
import {
  bookedCountOf,
  isBookable,
  listMemberUpcomingBookings,
  listUpcomingClassSchedules,
  remainingSlotsOf,
  type ApiClass,
  type ClassBooking,
} from "@/lib/api/classes";
import type { ApiMember } from "@/lib/api/members";
import {
  formatRupiah,
  newLineId,
  queuedPlanIds as planIdsInCart,
  type CartItem,
  type MembershipCartItem,
} from "@/lib/pos/cart";
import { PosPtOptionsModal } from "./pos-pt-options-modal";
import { PosBookClassModal } from "./pos-book-class-modal";

type Category = "all" | "membership" | "pt" | "class";

const CATEGORIES: Array<{ key: Category; label: string; icon: string }> = [
  { key: "all", label: "All", icon: "fa-th-large" },
  { key: "membership", label: "Membership", icon: "fa-ticket-alt" },
  { key: "pt", label: "PT Package", icon: "fa-id-badge" },
  { key: "class", label: "Classes", icon: "fa-calendar-alt" },
];

type Props = {
  onAdd: (item: CartItem) => void;
  /** Selected customer; drives the assigned-package section and class booking. */
  customer: ApiMember | null;
  /** Active POS branch — everything sellable is scoped to it. */
  branchId: string;
  branchName: string;
  /** Current cart, to grey out what is already queued. */
  cartItems: CartItem[];
  disabled?: boolean;
  /** Fired after a class booking so the customer context can refresh. */
  onBooked?: () => void;
};

function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

/**
 * Which membership shape a plan is, for the card subtitle.
 *
 * These are the three the backend distinguishes: an unlimited plan spends no
 * credits, a "Regular" plan is gym access with no class booking at all, and
 * everything else is credit-based.
 */
function planSubtitle(plan: MembershipPlan): string {
  const days = `${plan.validityDays} hari`;
  if ((plan.planCategory ?? "").toLowerCase() === "regular") {
    return `${days} · Gym access (tanpa class)`;
  }
  if (plan.isUnlimitedClasses) return `${days} · Unlimited class`;
  return `${days} · ${plan.credits} credit`;
}

function Card({
  title,
  subtitle,
  meta,
  price,
  badge,
  disabled,
  disabledLabel,
  onClick,
}: {
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  price: string;
  badge?: string | null;
  disabled?: boolean;
  disabledLabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-left bg-card border border-border rounded-xl p-3 hover:border-sweat hover:bg-sweat/5 transition disabled:opacity-40 disabled:hover:border-border disabled:cursor-not-allowed flex flex-col gap-1 min-h-[104px]"
    >
      {badge && (
        <span className="self-start text-[9px] font-bold uppercase tracking-wide bg-sweat text-black px-1.5 py-0.5 rounded">
          {badge}
        </span>
      )}
      <span className="text-sm font-bold text-fg leading-tight line-clamp-2">{title}</span>
      {subtitle && <span className="text-[11px] text-muted line-clamp-1">{subtitle}</span>}
      {meta && <span className="text-[11px] text-fg-soft line-clamp-1">{meta}</span>}
      <span className="mt-auto text-sm font-bold text-accent-ink">
        {disabled && disabledLabel ? disabledLabel : price}
      </span>
    </button>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-xl p-3 min-h-[104px] animate-pulse"
        >
          <div className="h-4 bg-border rounded w-3/4 mb-2" />
          <div className="h-3 bg-border rounded w-1/2 mb-2" />
          <div className="h-4 bg-border rounded w-2/3 mt-6" />
        </div>
      ))}
    </div>
  );
}

/**
 * The sellable catalogue for one branch: membership plans, PT packages and
 * bookable classes. Every card is one tap — the front desk should never need a
 * menu dive.
 *
 * Two things are deliberately not symmetrical with a normal shop:
 *
 *  - PT packages assigned to the selected customer get their own section. The
 *    admin screen assigns a package by stamping `MemberId` on it, which takes
 *    it out of the open catalogue; without this section a package that had just
 *    been assigned would be invisible at the till. `PurchasePTPackageAsync`
 *    accepts a package assigned to the buyer, so these are genuinely sellable.
 *
 *  - Classes are not added to anything. They are booked on the spot through the
 *    same endpoint the member app uses, because a class is settled with the
 *    member's entitlement rather than with money.
 */
export function PosCatalog({
  onAdd,
  customer,
  branchId,
  branchName,
  cartItems,
  disabled = false,
  onBooked,
}: Props) {
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [packages, setPackages] = useState<PtPackage[]>([]);
  const [classes, setClasses] = useState<ApiClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ptTarget, setPtTarget] = useState<PtPackage | null>(null);
  const [classTarget, setClassTarget] = useState<ApiClass | null>(null);

  /** Packages already assigned to the selected customer. */
  const [memberPackages, setMemberPackages] = useState<PtPackage[]>([]);
  const [memberPackagesError, setMemberPackagesError] = useState("");
  const [bookedScheduleIds, setBookedScheduleIds] = useState<string[]>([]);
  const [bookingVersion, setBookingVersion] = useState(0);

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

  // The customer's own PT packages, read from the backend's assignment lookup.
  const customerId = customer?.id ?? "";

  useEffect(() => {
    let cancelled = false;

    // Resolving to an empty list keeps the state updates off the effect body and
    // on the promise, so clearing and loading follow the same path.
    const pending = customerId
      ? listMemberPtPackages(customerId)
      : Promise.resolve<PtPackage[]>([]);

    pending
      .then((list) => {
        if (cancelled) return;
        setMemberPackages(list.filter((p) => p.isActive !== false));
        setMemberPackagesError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setMemberPackages([]);
        setMemberPackagesError(errorMessageOf(err, "Gagal memuat PT package member"));
      });

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  // Classes the customer already holds, so the till cannot double-book.
  useEffect(() => {
    let cancelled = false;

    const pending = customerId
      ? listMemberUpcomingBookings(customerId)
      : Promise.resolve<ClassBooking[]>([]);

    pending
      .then((list) => {
        if (cancelled) return;
        setBookedScheduleIds(
          list.filter((b) => !b.isCancelled).map((b) => b.classScheduleId)
        );
      })
      .catch(() => {
        if (!cancelled) setBookedScheduleIds([]);
      });

    return () => {
      cancelled = true;
    };
  }, [customerId, bookingVersion]);

  const term = search.trim().toLowerCase();
  const matches = useCallback(
    (...values: Array<string | null | undefined>) =>
      !term || values.some((v) => (v ?? "").toLowerCase().includes(term)),
    [term]
  );

  /*
   * Branch scoping. A record with no branch on it is shown rather than hidden:
   * older plans and packages predate the branch column, and hiding them would
   * silently make them unsellable.
   */
  const inBranch = useCallback(
    (recordBranchId?: string | null) => !recordBranchId || recordBranchId === branchId,
    [branchId]
  );

  /*
   * Drop-in plans never appear here. A drop-in is not something the front desk
   * shops for: it is what a customer without a valid entitlement pays when they
   * try to book, so it is offered inside `PosBookClassModal` from the tiers in
   * System Settings. Filtering them out of the Membership shelf also keeps a
   * drop-in plan from being rung up as a membership by accident.
   */
  const visiblePlans = useMemo(
    () =>
      category === "all" || category === "membership"
        ? plans.filter(
            (p) =>
              !isDropInPlan(p) &&
              inBranch(p.branchId) &&
              matches(p.planName, p.description, p.planCategory)
          )
        : [],
    [plans, category, matches, inBranch]
  );

  const visiblePackages = useMemo(
    () =>
      category === "all" || category === "pt"
        ? packages.filter(
            (p) => inBranch(p.branchId) && matches(p.name, p.description, p.coachName)
          )
        : [],
    [packages, category, matches, inBranch]
  );

  const visibleMemberPackages = useMemo(
    () =>
      category === "all" || category === "pt"
        ? memberPackages.filter((p) => matches(p.name, p.description, p.coachName))
        : [],
    [memberPackages, category, matches]
  );

  const visibleClasses = useMemo(
    () =>
      category === "all" || category === "class"
        ? classes
            .filter(
              (c) =>
                inBranch(c.branchId) &&
                matches(c.className, c.coachName, c.branchName, c.classType)
            )
            .sort((a, b) =>
              `${a.classDate}${a.startTime}`.localeCompare(`${b.classDate}${b.startTime}`)
            )
            .slice(0, category === "class" ? 60 : 8)
        : [],
    [classes, category, matches, inBranch]
  );

  const queuedPackageIds = useMemo(
    () => cartItems.filter((i) => i.kind === "pt").map((i) => i.pkg.id),
    [cartItems]
  );

  const queuedPlanIds = useMemo(() => planIdsInCart(cartItems), [cartItems]);

  const isEmpty =
    !loading &&
    visiblePlans.length === 0 &&
    visiblePackages.length === 0 &&
    visibleMemberPackages.length === 0 &&
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

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 sm:p-5 border-b border-border space-y-3">
        <div className="relative">
          <i
            className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none"
            aria-hidden
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari membership, PT package, atau class"
            className="w-full bg-sidebar border border-border text-fg pl-10 pr-9 py-3 rounded-lg text-sm focus:outline-none focus:border-sweat"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
              aria-label="Clear search"
            >
              <i className="fas fa-times" aria-hidden />
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={`px-3 py-2 rounded-lg text-xs font-bold border transition flex items-center gap-2 ${
                category === c.key
                  ? "bg-sweat text-black border-sweat"
                  : "bg-sidebar border-border text-fg-soft hover:text-fg"
              }`}
            >
              <i className={`fas ${c.icon}`} aria-hidden />
              {c.label}
            </button>
          ))}
          {branchName && (
            <span className="ml-auto text-[11px] text-muted truncate">
              <i className="fas fa-store mr-1.5" aria-hidden />
              {branchName}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
        {error && (
          <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
            {error}
          </p>
        )}

        {loading ? (
          <SkeletonGrid />
        ) : isEmpty ? (
          <div className="text-center py-16">
            <i className="fas fa-box-open text-3xl text-muted mb-3 block" aria-hidden />
            <p className="text-sm text-muted">
              Tidak ada item yang cocok untuk {branchName || "branch ini"}.
            </p>
          </div>
        ) : (
          <>
            {/* Packages already assigned to this customer come first: they are
                what staff are usually looking for when a member walks up. */}
            {visibleMemberPackages.length > 0 && (
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
                  PT Package member ini
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {visibleMemberPackages.map((pkg) => {
                    const queued = queuedPackageIds.includes(pkg.id);
                    return (
                      <Card
                        key={pkg.id}
                        badge="Assigned"
                        title={pkg.name}
                        subtitle={`${pkg.sessionCount ?? 0} sesi`}
                        meta={pkg.coachName ? `Coach ${pkg.coachName}` : pkg.branchName}
                        price={formatRupiah(pkg.price ?? 0)}
                        disabled={disabled || queued}
                        disabledLabel={queued ? "Sudah di transaksi" : undefined}
                        onClick={() => setPtTarget(pkg)}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {memberPackagesError && (
              <p className="text-xs text-red-500">{memberPackagesError}</p>
            )}

            {visiblePlans.length > 0 && (
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
                  Membership
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {visiblePlans.map((plan) => {
                    const queued = queuedPlanIds.includes(plan.id);
                    return (
                      <Card
                        key={plan.id}
                        title={plan.planName}
                        subtitle={planSubtitle(plan)}
                        meta={
                          plan.isPtIncluded
                            ? `Termasuk ${plan.ptSessions ?? 0} sesi PT`
                            : plan.planCategory
                        }
                        price={formatRupiah(plan.price ?? 0)}
                        disabled={disabled || queued}
                        disabledLabel={queued ? "Sudah di transaksi" : undefined}
                        onClick={() => addPlan(plan)}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {visiblePackages.length > 0 && (
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
                  PT Package
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {visiblePackages.map((pkg) => {
                    const queued = queuedPackageIds.includes(pkg.id);
                    return (
                      <Card
                        key={pkg.id}
                        title={pkg.name}
                        subtitle={`${pkg.sessionCount ?? 0} sesi`}
                        meta={pkg.coachName ? `Coach ${pkg.coachName}` : pkg.branchName}
                        price={formatRupiah(pkg.price ?? 0)}
                        disabled={disabled || queued}
                        disabledLabel={queued ? "Sudah di transaksi" : undefined}
                        onClick={() => setPtTarget(pkg)}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {visibleClasses.length > 0 && (
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
                  Classes · Book langsung, tanpa pembayaran
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
                        disabledLabel={
                          already ? "Sudah dibooking" : full ? "Penuh / tidak aktif" : undefined
                        }
                        onClick={() => setClassTarget(c)}
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
          branchId={branchId}
          branchName={branchName}
          assignedToMember={memberPackages.some((p) => p.id === ptTarget.id)}
          onClose={() => setPtTarget(null)}
          onAdd={(item) => {
            setPtTarget(null);
            onAdd(item);
          }}
        />
      )}

      {classTarget && customer && (
        <PosBookClassModal
          schedule={classTarget}
          customer={customer}
          alreadyBookedScheduleIds={bookedScheduleIds}
          branchId={branchId}
          branchName={branchName}
          onClose={() => setClassTarget(null)}
          onBooked={() => {
            setBookingVersion((v) => v + 1);
            onBooked?.();
          }}
        />
      )}

      {classTarget && !customer && (
        <PosBookClassGuard onClose={() => setClassTarget(null)} />
      )}
    </div>
  );
}

/** Booking needs a member; this says so rather than silently doing nothing. */
function PosBookClassGuard({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-overlay z-50 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card w-full max-w-sm rounded-2xl border border-border p-6 text-center">
        <i className="fas fa-user-slash text-2xl text-muted mb-3 block" aria-hidden />
        <p className="text-sm text-fg font-semibold mb-1">Pilih customer dulu</p>
        <p className="text-xs text-muted mb-4">
          Class dibooking atas nama member, jadi customer harus dipilih lebih dulu.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full bg-sweat text-black py-2.5 rounded-lg text-sm font-bold"
        >
          Mengerti
        </button>
      </div>
    </div>
  );
}
