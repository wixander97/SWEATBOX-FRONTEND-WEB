"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminPaths } from "@/lib/admin-routes";
import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { useRole } from "@/contexts/role-context";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";

type StatsPayload = Record<string, unknown>;

type MembersStatsPayload = {
  totalMembers: number;
  activeMembers: number;
  expiredMembers: number;
  frozenMembers: number;
  pendingPayments: number;
  ptMembers: number;
};

type PaymentSummaryPayload = {
  totalPayments: number;
  totalPendingPayments: number;
  totalPaidPayments: number;
  totalFailedPayments: number;
  totalRevenue: number;
  totalPendingRevenue: number;
  mostCommonStatus: number;
};

type ClassSchedulesStatsPayload = {
  totalClasses: number;
  activeClasses: number;
  cancelledClasses: number;
  completedClasses: number;
};

type StaffAttendanceStatsPayload = {
  totalAttendances: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
};

type CoachesStatsPayload = {
  totalCoaches: number;
  activeCoaches: number;
  inactiveCoaches: number;
  averageRating: number;
  averageAttendanceRate: number;
  totalPtSessions: number;
  totalClasses: number;
};

type DashboardStats = {
  members: StatsPayload | null;
  coaches: StatsPayload | null;
  classes: StatsPayload | null;
  payments: StatsPayload | null;
  staffs: StatsPayload | null;
  attendance: StatsPayload | null;
};

type RecentPayment = {
  id: string;
  membershipPlanName: string | null;
  invoiceNo: string;
  amount: number;
  finalAmount: number;
  paymentStatus: number;
  paymentProvider: number;
  notes: string | null;
  created: string;
};

type TodayClass = {
  id: string;
  className?: string;
  name?: string;
  coachName?: string;
  startTime?: string;
  time?: string;
  classDate?: string;
  branchName?: string;
  location?: string;
  bookedCount?: number;
  enrolled?: number;
  capacity?: number;
  isActive?: boolean;
  isCancelled?: boolean;
};

function getNum(obj: StatsPayload | null, ...keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number") return v;
  }
  return null;
}

function toUtcDateStr(isoString: string): string {
  const hasTime = /T\d{2}:\d{2}/.test(isoString);
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(isoString);
  const normalized = hasTime && !hasTz ? isoString + "Z" : isoString;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function isToday(isoString: string): boolean {
  return toUtcDateStr(isoString) === new Date().toISOString().slice(0, 10);
}

function formatRupiah(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(0)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toLocaleString("id-ID");
}

/**
 * Calculate class occupancy using weighted average formula
 * Formula: (Total Booked Spots / Total Available Capacity) × 100
 * Excludes cancelled classes to reflect actual capacity utilization
 */
function calculateClassOccupancy(classes: TodayClass[]): number | null {
  if (!classes || classes.length === 0) return null;

  const activeClasses = classes.filter((c) => !c.isCancelled);
  if (activeClasses.length === 0) return null;

  let totalBooked = 0;
  let totalCapacity = 0;

  for (const c of activeClasses) {
    const booked = c.bookedCount ?? c.enrolled ?? 0;
    const capacity = c.capacity ?? 0;

    if (capacity > 0) {
      totalBooked += booked;
      totalCapacity += capacity;
    }
  }

  if (totalCapacity === 0) return null;

  return (totalBooked / totalCapacity) * 100;
}

function Skeleton({ w = "w-16" }: { w?: string }) {
  return <span className={`inline-block ${w} h-8 bg-gray-700 rounded animate-pulse`} />;
}

// ── Enhanced StatCard with growth, target, showAvg props ────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
  icon,
  loading,
  href,
  growth,
  target,
  showAvg,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
  icon: string;
  loading: boolean;
  href?: string;
  growth?: number | null;
  target?: number | null;
  showAvg?: boolean;
}) {
  const inner = (
    <div className="bg-card p-5 rounded-xl border border-border hover:border-sweat/40 transition cursor-default group h-full flex flex-col justify-between">
      <div className="flex items-start justify-between mb-3">
        <p className="text-gray-400 text-xs font-bold uppercase tracking-wide leading-tight">{label}</p>
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-sweat/10 transition">
          <i className={`fas ${icon} text-gray-500 group-hover:text-sweat text-sm transition`} aria-hidden />
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <p className={`text-2xl font-bold ${accent ?? "text-white"}`}>
            {loading ? <Skeleton /> : value}
          </p>
          {/* Growth indicator - green ▲ with percentage */}
          {!loading && growth != null && (
            <span className="text-green-400 text-sm font-bold flex items-center">
              ▲ {growth}%
            </span>
          )}
        </div>
        {/* Sub info: target or Avg label */}
        {!loading && (
          <div className="mt-1">
            {target != null ? (
              <p className="text-xs text-gray-500">of {formatRupiah(target)}</p>
            ) : showAvg ? (
              <p className="text-xs text-gray-500">Avg</p>
            ) : sub ? (
              <p className="text-xs text-gray-500">{sub}</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
  if (href) return <Link href={href} className="block h-full">{inner}</Link>;
  return inner;
}

// ── Compact StatCard for secondary KPIs ─────────────────────────────────────

function CompactStatCard({
  label,
  value,
  accent,
  icon,
  loading,
  href,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
  icon: string;
  loading: boolean;
  href?: string;
}) {
  const inner = (
    <div className="bg-card/50 p-3 rounded-lg border border-border/50 hover:border-sweat/30 transition cursor-default group">
      <div className="flex items-center gap-2">
        <i className={`fas ${icon} text-gray-500 group-hover:text-sweat text-xs transition`} aria-hidden />
        <span className="text-gray-400 text-[10px] uppercase tracking-wide font-bold">{label}</span>
      </div>
      <p className={`text-lg font-bold ${accent ?? "text-white"} mt-1`}>
        {loading ? <Skeleton w="w-10" /> : value}
      </p>
    </div>
  );
  if (href) return <Link href={href} className="block">{inner}</Link>;
  return inner;
}

export function DashboardView() {
  const { currentRole } = useRole();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [memberStats, setMemberStats] = useState<MembersStatsPayload | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummaryPayload | null>(null);
  const [classStats, setClassStats] = useState<ClassSchedulesStatsPayload | null>(null);
  const [staffAttendanceStats, setStaffAttendanceStats] = useState<StaffAttendanceStatsPayload | null>(null);
  const [coachesStats, setCoachesStats] = useState<CoachesStatsPayload | null>(null);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsBreakdownOpen, setStatsBreakdownOpen] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [statsRes, memberStatsRes, paymentSummaryRes, classStatsRes, staffAttendanceRes, coachesStatsRes, paymentsRes, classesRes] = await Promise.allSettled([
        authFetch(`${API_BASE_URL}/api/v1/stats`, { cache: "no-store" }),
        authFetch(`${API_BASE_URL}/api/v1/members/stats`, { cache: "no-store" }),
        authFetch(`${API_BASE_URL}/api/v1/payments/summary`, { cache: "no-store" }),
        authFetch(`${API_BASE_URL}/api/v1/class-schedules/stats`, { cache: "no-store" }),
        authFetch(`${API_BASE_URL}/api/v1/staff-attendances/stats`, { cache: "no-store" }),
        authFetch(`${API_BASE_URL}/api/v1/coaches/stats`, { cache: "no-store" }),
        authFetch(`${API_BASE_URL}/api/v1/payments`, { cache: "no-store" }),
        authFetch(`${API_BASE_URL}/api/v1/class-schedules?page=1&pageSize=6`, { cache: "no-store" }),
      ]);

      if (statsRes.status === "fulfilled") {
        if (redirectToLoginIfUnauthorized(statsRes.value.status)) return;
        const data = await statsRes.value.json().catch(() => null);
        if (data) setStats(data as DashboardStats);
      }

      if (memberStatsRes.status === "fulfilled" && memberStatsRes.value.ok) {
        const data = await memberStatsRes.value.json().catch(() => null);
        if (data) setMemberStats(data as MembersStatsPayload);
      }

      if (paymentSummaryRes.status === "fulfilled" && paymentSummaryRes.value.ok) {
        const data = await paymentSummaryRes.value.json().catch(() => null);
        if (data) setPaymentSummary(data as PaymentSummaryPayload);
      }

      if (classStatsRes.status === "fulfilled" && classStatsRes.value.ok) {
        const data = await classStatsRes.value.json().catch(() => null);
        if (data) setClassStats(data as ClassSchedulesStatsPayload);
      }

      if (staffAttendanceRes.status === "fulfilled" && staffAttendanceRes.value.ok) {
        const data = await staffAttendanceRes.value.json().catch(() => null);
        if (data) setStaffAttendanceStats(data as StaffAttendanceStatsPayload);
      }

      if (coachesStatsRes.status === "fulfilled" && coachesStatsRes.value.ok) {
        const data = await coachesStatsRes.value.json().catch(() => null);
        if (data) setCoachesStats(data as CoachesStatsPayload);
      }

      if (paymentsRes.status === "fulfilled" && paymentsRes.value.ok) {
        const data = await paymentsRes.value.json().catch(() => []);
        const list: RecentPayment[] = Array.isArray(data)
          ? data.slice(0, 10)
          : ((data?.items ?? data?.data ?? []) as RecentPayment[]).slice(0, 10);
        setRecentPayments(list);
      }

      if (classesRes.status === "fulfilled" && classesRes.value.ok) {
        const data = await classesRes.value.json().catch(() => []);
        const raw: TodayClass[] = Array.isArray(data)
          ? data
          : ((data?.items ?? data?.data ?? []) as TodayClass[]);
        const list = raw.filter((c) => c.classDate && isToday(c.classDate)).slice(0, 6);
        setTodayClasses(list);
      }

      setLoading(false);
    }
    void load();
  }, []);

  // ── Member stats ─────────────────────────────────────────────────────────
  const totalMembers = memberStats?.totalMembers ?? null;
  const activeMembers = memberStats?.activeMembers ?? null;
  const expiredMembers = memberStats?.expiredMembers ?? null;
  const frozenCount = memberStats?.frozenMembers ?? null;
  const pendingPaymentCount = memberStats?.pendingPayments ?? null;
  const ptMembers = memberStats?.ptMembers ?? null;
  const expiringCount = null; // Not available in new endpoint

  // ── Coach stats ───────────────────────────────────────────────────────────
  const c = stats?.coaches ?? null;
  const totalCoachesFallback = getNum(c, "totalCoaches", "total", "count");
  const activeCoachesFallback = getNum(c, "totalActive", "activeCount", "active");
  const avgRatingFallback = getNum(c, "averageRating", "avgRating", "rating");

  // Use coachesStats from dedicated endpoint, fallback to stats?.coaches
  const totalCoaches = coachesStats?.totalCoaches ?? totalCoachesFallback;
  const activeCoaches = coachesStats?.activeCoaches ?? activeCoachesFallback;
  const avgRating = coachesStats?.averageRating ?? avgRatingFallback;

  // ── Class stats ───────────────────────────────────────────────────────────
  const cl = stats?.classes ?? null;
  const classOccupancy = getNum(cl, "averageOccupancy", "occupancyRate", "avgOccupancy", "averageOccupancyRate") ?? calculateClassOccupancy(todayClasses);
  const upcomingClasses = null; // Not in new endpoint, display replaced

  // Use classStats from dedicated endpoint, fallback to stats?.classes for classOccupancy
  const totalClasses = classStats?.totalClasses ?? getNum(cl, "totalClasses", "total", "count");
  const activeClasses = classStats?.activeClasses ?? getNum(cl, "activeCount", "totalActive", "active");
  const completedClasses = classStats?.completedClasses ?? getNum(cl, "completedCount", "completed", "totalCompleted");
  const cancelledClasses = classStats?.cancelledClasses ?? getNum(cl, "cancelledCount", "cancelled", "totalCancelled");

  // ── Payment stats ─────────────────────────────────────────────────────────
  const p = stats?.payments ?? null;
  const totalRevenueFallback = getNum(p, "totalRevenue", "totalAmount", "revenue", "total", "totalPaid");
  const paidCountFallback = getNum(p, "paidCount", "totalPaid", "paid");
  const pendingCountFallback = getNum(p, "pendingCount", "totalPending", "pending");
  const failedCountFallback = getNum(p, "failedCount", "totalFailed", "failed");
  const totalTx = getNum(p, "totalTransactions", "totalCount", "count");

  // Use paymentSummary from dedicated endpoint, fallback to stats?.payments
  const totalRevenue = paymentSummary?.totalRevenue ?? totalRevenueFallback;
  const paidCount = paymentSummary?.totalPaidPayments ?? paidCountFallback;
  const pendingCount = paymentSummary?.totalPendingPayments ?? pendingCountFallback;
  const failedCount = paymentSummary?.totalFailedPayments ?? failedCountFallback;

  // ── Staff stats ───────────────────────────────────────────────────────────
  const s = stats?.staffs ?? null;
  const totalStaff = getNum(s, "totalStaff", "totalActive", "total", "count", "activeCount");
  const activeStaff = getNum(s, "totalActive", "activeCount", "active");

  // ── Attendance stats ──────────────────────────────────────────────────────
  const a = stats?.attendance ?? null;
  const checkedInFallback = getNum(a, "checkedIn", "presentCount", "totalPresent", "present");
  const lateCountFallback = getNum(a, "lateCount", "late", "totalLate");
  const absentCountFallback = getNum(a, "absentCount", "absent", "totalAbsent");
  const onTimeCountFallback = getNum(a, "onTimeCount", "onTime", "totalOnTime");

  // Use staffAttendanceStats from dedicated endpoint, fallback to stats?.attendance
  const checkedIn = staffAttendanceStats?.totalPresent ?? checkedInFallback;
  const lateCount = staffAttendanceStats?.totalLate ?? lateCountFallback;
  const absentCount = staffAttendanceStats?.totalAbsent ?? absentCountFallback;
  const onTimeCount = (staffAttendanceStats?.totalPresent != null && staffAttendanceStats?.totalLate != null)
    ? Math.max(0, staffAttendanceStats.totalPresent - staffAttendanceStats.totalLate)
    : onTimeCountFallback;

  const staffDisplay = activeStaff ?? totalStaff;

  // Placeholder values for growth and target (as per spec)
  const growthPlaceholder = 0; // ▲ 0% when no data
  const targetPlaceholder = 500_000_000; // IDR 500M target

  return (
    <>
      {/* ── Expiry Alert ─────────────────────────────────────────────────── */}
      {!loading && (expiringCount ?? 0) > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 p-4 rounded-xl mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-lg">
          <div className="flex items-start sm:items-center gap-4 text-yellow-500">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
              <i className="fas fa-exclamation-triangle text-xl" aria-hidden />
            </div>
            <div>
              <p className="font-bold text-sm uppercase tracking-wide">Upcoming Expiry Alert</p>
              <p className="text-xs text-yellow-500/80 mt-1">
                Terdapat <strong>{expiringCount} member</strong> yang masa aktifnya akan habis dalam 5 hari ke depan.
              </p>
            </div>
          </div>
          <Link
            href={adminPaths.members}
            className="bg-yellow-500 text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-yellow-400 transition shrink-0"
          >
            Lihat Data
          </Link>
        </div>
      )}

      {/* ── Row 1: Primary KPIs ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <StatCard
          label="Active Members"
          value={activeMembers?.toLocaleString("id-ID") ?? "—"}
          sub={totalMembers != null ? `dari ${totalMembers.toLocaleString("id-ID")} total` : undefined}
          icon="fa-users"
          loading={loading}
          href={adminPaths.members}
          growth={growthPlaceholder} // FR-002: Placeholder growth indicator
        />
        {currentRole === "superadmin" ? (
          <StatCard
            label="Total Revenue" // FR-003: Changed from "Revenue Total" to "Revenue Monthly"
            value={totalRevenue != null ? formatRupiah(totalRevenue) : "—"}
            accent="text-sweat"
            icon="fa-wallet"
            loading={loading}
            href={adminPaths.payments}
            target={targetPlaceholder} // FR-003: Target comparison
          />
        ) : (
          <div className="bg-card p-5 rounded-xl border border-dashed border-gray-700 flex flex-col items-center justify-center opacity-60">
            <i className="fas fa-lock text-gray-500 text-xl mb-2" aria-hidden />
            <p className="text-gray-500 text-xs font-bold uppercase text-center">Revenue</p>
            <p className="text-[10px] text-gray-600 mt-1">Owner Only</p>
          </div>
        )}
        <StatCard
          label="Class Occupancy"
          value={classOccupancy != null ? `${Math.round(classOccupancy)}%` : "—"}
          accent="text-yellow-400"
          icon="fa-calendar-alt"
          loading={loading}
          href={adminPaths.classes}
          showAvg // FR-004: Add Avg label
        />
        <StatCard
          label="Staff Checked In"
          value={checkedIn ?? "—"}
          sub={staffDisplay != null ? `/ ${staffDisplay} Staff` : undefined}
          icon="fa-id-card"
          loading={loading}
          href={adminPaths.reports}
        />
      </div>

      {/* ── Row 2: Secondary KPIs (compact/minimized) ───────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 opacity-80">
        <CompactStatCard
          label="Expiring Soon"
          value={expiringCount ?? "—"}
          accent={(expiringCount ?? 0) > 0 ? "text-yellow-400" : "text-white"}
          icon="fa-clock"
          loading={loading}
          href={adminPaths.members}
        />
        <CompactStatCard
          label="Active Coaches"
          value={activeCoaches ?? totalCoaches ?? "—"}
          icon="fa-dumbbell"
          loading={loading}
          href={adminPaths.users}
        />
        {currentRole === "superadmin" ? (
          <CompactStatCard
            label="Pending Payments"
            value={pendingCount ?? "—"}
            accent={(pendingCount ?? 0) > 0 ? "text-yellow-400" : "text-white"}
            icon="fa-hourglass-half"
            loading={loading}
            href={`${adminPaths.payments}?status=pending`}
          />
        ) : (
          <div className="bg-card/50 p-3 rounded-lg border border-dashed border-gray-700/50 flex items-center justify-center opacity-40">
            <i className="fas fa-lock text-gray-600 text-xs" aria-hidden />
            <span className="text-gray-600 text-[10px] uppercase ml-2 font-bold">Payments</span>
          </div>
        )}
        <CompactStatCard
          label="Cancelled Classes"
          value={cancelledClasses ?? "—"}
          icon="fa-play-circle"
          loading={loading}
          href={`${adminPaths.classes}?status=cancelled`}
        />
      </div>

      {/* ── Stats Breakdown (collapsible/compact) ───────────────────────── */}
      <div className="mb-8">
        <button
          onClick={() => setStatsBreakdownOpen(!statsBreakdownOpen)}
          className="w-full flex items-center justify-between bg-card/50 rounded-lg border border-border/50 px-4 py-3 mb-3 hover:bg-card/70 transition cursor-pointer"
        >
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wide">
            Quick Stats
          </span>
          <i className={`fas fa-chevron-${statsBreakdownOpen ? "up" : "down"} text-gray-500 text-xs transition-transform`} aria-hidden />
        </button>

        {statsBreakdownOpen && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Member Breakdown */}
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-xs uppercase tracking-wide text-gray-300">Member Status</h4>
                <Link href={adminPaths.members} className="text-[10px] text-sweat hover:underline">Lihat</Link>
              </div>
              <div className="space-y-2">
                {loading ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="w-20 h-3 bg-gray-700 rounded animate-pulse" />
                      <span className="w-6 h-3 bg-gray-700 rounded animate-pulse" />
                    </div>
                  ))
                ) : (
                  <>
                    <QuickStatRow label="Active" value={activeMembers} accent="text-green-400" />
                    <QuickStatRow label="Expiring Soon" value={expiringCount} accent="text-yellow-400" />
                    <QuickStatRow label="Expired" value={expiredMembers} accent="text-red-400" />
                    <QuickStatRow label="Frozen" value={frozenCount} accent="text-blue-400" />
                  </>
                )}
              </div>
            </div>

            {/* Attendance Breakdown */}
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-xs uppercase tracking-wide text-gray-300">Staff Attendance</h4>
                <Link href={adminPaths.reports} className="text-[10px] text-sweat hover:underline">Lihat</Link>
              </div>
              <div className="space-y-2">
                {loading ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="w-16 h-3 bg-gray-700 rounded animate-pulse" />
                      <span className="w-6 h-3 bg-gray-700 rounded animate-pulse" />
                    </div>
                  ))
                ) : (
                  <>
                    <AttendanceRow label="On Time" value={onTimeCount} color="text-green-400" icon="fa-check-circle" />
                    <AttendanceRow label="Late" value={lateCount} color="text-yellow-400" icon="fa-exclamation-circle" />
                    <AttendanceRow label="Absent" value={absentCount} color="text-red-400" icon="fa-times-circle" />
                    {checkedIn != null && (
                      <div className="pt-2 border-t border-border/50 flex justify-between items-center text-[10px] text-gray-400">
                        <span className="font-bold">Checked In</span>
                        <span className="font-bold text-white">{checkedIn}{staffDisplay != null ? `/${staffDisplay}` : ""}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Class & Coach Stats */}
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-xs uppercase tracking-wide text-gray-300">Kelas &amp; Coach</h4>
                <Link href={adminPaths.classes} className="text-[10px] text-sweat hover:underline">Lihat</Link>
              </div>
              <div className="space-y-2">
                {loading ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="w-20 h-3 bg-gray-700 rounded animate-pulse" />
                      <span className="w-6 h-3 bg-gray-700 rounded animate-pulse" />
                    </div>
                  ))
                ) : (
                  <>
                    <QuickStatRow label="Total Kelas" value={totalClasses} />
                    <QuickStatRow label="Cancelled" value={cancelledClasses} accent="text-red-400" />
                    <QuickStatRow label="Completed" value={completedClasses} accent="text-gray-400" />
                    {avgRating != null && (
                      <QuickStatRow label="Avg Rating" value={`${avgRating.toFixed(1)} ★`} accent="text-sweat" />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Recent Transactions + Today's Classes ────────────────────────── */}
      <div className={`grid grid-cols-1 ${currentRole === "superadmin" ? "lg:grid-cols-2" : ""} gap-6`}>
        {currentRole === "superadmin" && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center">
              <h4 className="font-bold text-lg">Recent Transactions</h4>
              <Link href={adminPaths.payments} className="text-xs text-sweat hover:underline">
                View All
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-left text-sm text-gray-400">
                <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Member</th>
                    <th className="px-5 py-3">Plan</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-gray-500">Loading...</td>
                    </tr>
                  ) : recentPayments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-gray-500">No recent transactions</td>
                    </tr>
                  ) : (
                    recentPayments.map((p) => {
                      const statusLabel = p.paymentStatus === 1 ? "Paid" : p.paymentStatus === 0 ? "Pending" : "Failed";
                      const badgeCls =
                        p.paymentStatus === 1
                          ? "bg-green-500/10 text-green-500"
                          : p.paymentStatus === 0
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-red-500/10 text-red-400";
                      return (
                        <tr key={p.id} className="table-row transition">
                          <td className="px-5 py-3 font-medium text-white">
                            {p.invoiceNo}
                          </td>
                          <td className="px-5 py-3">{p.membershipPlanName ?? "—"}</td>
                          <td className="px-5 py-3 text-green-400 font-mono text-xs">
                            {formatRupiah(p.finalAmount)}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${badgeCls}`}>
                              {statusLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex justify-between items-center mb-5">
            <h4 className="font-bold text-lg">Today&apos;s Classes</h4>
            <span className="text-xs bg-sweat text-black px-2 py-1 rounded font-bold shadow-[0_0_10px_rgba(255,215,0,0.4)]">
              LIVE
            </span>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[72px] bg-gray-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : todayClasses.length === 0 ? (
            <p className="text-gray-500 text-sm">No classes scheduled for today.</p>
          ) : (
            <div className="space-y-3">
              {todayClasses.map((c) => {
                const isCancelled = c.isCancelled;
                const bookedCount = c.bookedCount ?? c.enrolled ?? 0;
                const capacity = c.capacity ?? 0;
                return (
                  <div
                    key={c.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition ${isCancelled
                      ? "border-red-500/20 opacity-50"
                      : "border-border hover:bg-white/5"
                      }`}
                  >
                    <div className="w-14 h-14 bg-gray-800 rounded-lg flex flex-col items-center justify-center text-center shrink-0">
                      <span className="text-[9px] text-gray-500 uppercase">Time</span>
                      <span className="text-base font-bold text-white leading-tight">
                        {(c.startTime ?? c.time ?? "—").substring(0, 5)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-white text-sm truncate">
                        {c.className ?? c.name ?? "—"}
                        {isCancelled && (
                          <span className="ml-2 text-[10px] text-red-400 font-normal">CANCELLED</span>
                        )}
                      </h5>
                      {/* FR-005: "Coach" prefix before coach name */}
                      <p className="text-xs text-gray-400 truncate">
                        Coach {c.coachName ?? "—"} · {c.branchName ?? c.location ?? "—"}
                      </p>
                    </div>
                    {/* FR-006: "X/Y Booked" with yellow styling */}
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-sweat leading-none">
                        {bookedCount}
                        <span className="text-xs text-gray-500 font-normal">/{capacity}</span>
                      </p>
                      <p className="text-[10px] text-gray-500">Booked</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Helper sub-components ───────────────────────────────────────────────────

function AttendanceRow({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number | null;
  color: string;
  icon: string;
}) {
  if (value == null) return null;
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="flex items-center gap-2 text-gray-400">
        <i className={`fas ${icon} text-[10px] ${color}`} aria-hidden />
        {label}
      </span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}

function QuickStatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string | null | undefined;
  accent?: string;
}) {
  if (value == null) return null;
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-gray-400">{label}</span>
      <span className={`font-bold ${accent ?? "text-white"}`}>
        {typeof value === "number" ? value.toLocaleString("id-ID") : value}
      </span>
    </div>
  );
}