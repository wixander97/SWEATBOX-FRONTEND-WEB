"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminPaths } from "@/lib/admin-routes";
import { useRole } from "@/contexts/role-context";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";

type StatsPayload = Record<string, unknown>;

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
  memberName?: string;
  fullName?: string;
  membershipType?: string;
  amount?: number;
  paymentStatus?: string;
  status?: string;
};

type TodayClass = {
  id: string;
  className?: string;
  name?: string;
  coachName?: string;
  startTime?: string;
  time?: string;
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

function formatRupiah(amount: number): string {
  if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(0)}M`;
  if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(0)}K`;
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function Skeleton({ w = "w-16" }: { w?: string }) {
  return <span className={`inline-block ${w} h-8 bg-gray-700 rounded animate-pulse`} />;
}

function StatCard({
  label,
  value,
  sub,
  accent,
  icon,
  loading,
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
  icon: string;
  loading: boolean;
  href?: string;
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
        <p className={`text-2xl font-bold ${accent ?? "text-white"}`}>
          {loading ? <Skeleton /> : value}
        </p>
        {sub && !loading && (
          <p className="text-xs text-gray-500 mt-1">{sub}</p>
        )}
      </div>
    </div>
  );
  if (href) return <Link href={href} className="block h-full">{inner}</Link>;
  return inner;
}

export function DashboardView() {
  const { currentRole } = useRole();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [statsRes, paymentsRes, classesRes] = await Promise.allSettled([
        fetch("/api/stats", { cache: "no-store" }),
        fetch("/api/payments", { cache: "no-store" }),
        fetch("/api/classes?page=1&pageSize=6", { cache: "no-store" }),
      ]);

      if (statsRes.status === "fulfilled") {
        if (redirectToLoginIfUnauthorized(statsRes.value.status)) return;
        const data = await statsRes.value.json().catch(() => null);
        if (data) setStats(data as DashboardStats);
      }

      if (paymentsRes.status === "fulfilled" && paymentsRes.value.ok) {
        const data = await paymentsRes.value.json().catch(() => []);
        const list: RecentPayment[] = Array.isArray(data)
          ? data.slice(0, 5)
          : ((data?.items ?? data?.data ?? []) as RecentPayment[]).slice(0, 5);
        setRecentPayments(list);
      }

      if (classesRes.status === "fulfilled" && classesRes.value.ok) {
        const data = await classesRes.value.json().catch(() => []);
        const list: TodayClass[] = Array.isArray(data)
          ? data.slice(0, 6)
          : ((data?.items ?? data?.data ?? []) as TodayClass[]).slice(0, 6);
        setTodayClasses(list);
      }

      setLoading(false);
    }
    void load();
  }, []);

  // ── Member stats ─────────────────────────────────────────────────────────
  const m = stats?.members ?? null;
  const totalMembers   = getNum(m, "totalMembers", "total", "count");
  const activeMembers  = getNum(m, "totalActive", "activeCount", "active");
  const expiredMembers = getNum(m, "totalExpired", "expiredCount", "expired");
  const expiringCount  = getNum(m, "expiringSoonCount", "expiringCount", "expiringSoon", "expiringSoonCount");
  const frozenCount    = getNum(m, "frozenCount", "frozen", "totalFrozen");
  const pendingPaymentCount = getNum(m, "pendingPaymentCount", "pendingPayment", "unpaidCount");

  // ── Coach stats ───────────────────────────────────────────────────────────
  const c = stats?.coaches ?? null;
  const totalCoaches  = getNum(c, "totalCoaches", "total", "count");
  const activeCoaches = getNum(c, "totalActive", "activeCount", "active");
  const avgRating     = getNum(c, "averageRating", "avgRating", "rating");

  // ── Class stats ───────────────────────────────────────────────────────────
  const cl = stats?.classes ?? null;
  const totalClasses     = getNum(cl, "totalClasses", "total", "count");
  const activeClasses    = getNum(cl, "activeCount", "totalActive", "active");
  const upcomingClasses  = getNum(cl, "upcomingCount", "upcoming", "totalUpcoming");
  const completedClasses = getNum(cl, "completedCount", "completed", "totalCompleted");
  const cancelledClasses = getNum(cl, "cancelledCount", "cancelled", "totalCancelled");
  const classOccupancy   = getNum(cl, "averageOccupancy", "occupancyRate", "avgOccupancy", "averageOccupancyRate");

  // ── Payment stats ─────────────────────────────────────────────────────────
  const p = stats?.payments ?? null;
  const totalRevenue  = getNum(p, "totalRevenue", "totalAmount", "revenue", "total", "totalPaid");
  const paidCount     = getNum(p, "paidCount", "totalPaid", "paid");
  const pendingCount  = getNum(p, "pendingCount", "totalPending", "pending");
  const failedCount   = getNum(p, "failedCount", "totalFailed", "failed");
  const totalTx       = getNum(p, "totalTransactions", "totalCount", "count");

  // ── Staff stats ───────────────────────────────────────────────────────────
  const s = stats?.staffs ?? null;
  const totalStaff  = getNum(s, "totalStaff", "totalActive", "total", "count", "activeCount");
  const activeStaff = getNum(s, "totalActive", "activeCount", "active");

  // ── Attendance stats ──────────────────────────────────────────────────────
  const a = stats?.attendance ?? null;
  const checkedIn  = getNum(a, "checkedIn", "presentCount", "totalPresent", "present");
  const lateCount  = getNum(a, "lateCount", "late", "totalLate");
  const absentCount= getNum(a, "absentCount", "absent", "totalAbsent");
  const onTimeCount= getNum(a, "onTimeCount", "onTime", "totalOnTime");

  const staffDisplay  = activeStaff ?? totalStaff;

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
        />
        {currentRole === "owner" ? (
          <StatCard
            label="Revenue Total"
            value={totalRevenue != null ? formatRupiah(totalRevenue) : "—"}
            sub={totalTx != null ? `${totalTx} transaksi` : undefined}
            accent="text-sweat"
            icon="fa-wallet"
            loading={loading}
            href={adminPaths.payments}
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
          sub={totalClasses != null ? `${totalClasses} total kelas` : undefined}
          accent="text-yellow-400"
          icon="fa-calendar-alt"
          loading={loading}
          href={adminPaths.classes}
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

      {/* ── Row 2: Secondary KPIs ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Expiring Soon"
          value={expiringCount ?? "—"}
          sub={frozenCount != null ? `${frozenCount} frozen` : undefined}
          accent={(expiringCount ?? 0) > 0 ? "text-yellow-400" : "text-white"}
          icon="fa-clock"
          loading={loading}
          href={adminPaths.members}
        />
        <StatCard
          label="Active Coaches"
          value={activeCoaches ?? totalCoaches ?? "—"}
          sub={avgRating != null ? `Avg rating ${avgRating.toFixed(1)} ★` : undefined}
          icon="fa-dumbbell"
          loading={loading}
          href={adminPaths.coaches}
        />
        {currentRole === "owner" ? (
          <StatCard
            label="Pending Payments"
            value={pendingCount ?? "—"}
            sub={failedCount != null ? `${failedCount} failed` : undefined}
            accent={(pendingCount ?? 0) > 0 ? "text-yellow-400" : "text-white"}
            icon="fa-hourglass-half"
            loading={loading}
            href={adminPaths.payments}
          />
        ) : (
          <div className="bg-card p-5 rounded-xl border border-dashed border-gray-700 flex flex-col items-center justify-center opacity-60">
            <i className="fas fa-lock text-gray-500 text-xl mb-2" aria-hidden />
            <p className="text-gray-500 text-xs font-bold uppercase text-center">Payments</p>
            <p className="text-[10px] text-gray-600 mt-1">Owner Only</p>
          </div>
        )}
        <StatCard
          label="Upcoming Classes"
          value={upcomingClasses ?? activeClasses ?? "—"}
          sub={completedClasses != null ? `${completedClasses} selesai` : undefined}
          icon="fa-play-circle"
          loading={loading}
          href={adminPaths.classes}
        />
      </div>

      {/* ── Stats Breakdown Row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Member Breakdown */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-sm uppercase tracking-wide text-gray-300">Member Status</h4>
            <Link href={adminPaths.members} className="text-xs text-sweat hover:underline">Lihat</Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              [1,2,3,4].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="w-24 h-4 bg-gray-700 rounded animate-pulse" />
                  <span className="w-8 h-4 bg-gray-700 rounded animate-pulse" />
                </div>
              ))
            ) : (
              <>
                <MemberStatRow label="Active" value={activeMembers} color="bg-green-500" total={totalMembers} />
                <MemberStatRow label="Expiring Soon" value={expiringCount} color="bg-yellow-500" total={totalMembers} />
                <MemberStatRow label="Expired" value={expiredMembers} color="bg-red-500" total={totalMembers} />
                <MemberStatRow label="Frozen" value={frozenCount} color="bg-blue-500" total={totalMembers} />
                {pendingPaymentCount != null && (
                  <MemberStatRow label="Pending Payment" value={pendingPaymentCount} color="bg-orange-500" total={totalMembers} />
                )}
              </>
            )}
          </div>
        </div>

        {/* Attendance Breakdown */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-sm uppercase tracking-wide text-gray-300">Staff Attendance Today</h4>
            <Link href={adminPaths.reports} className="text-xs text-sweat hover:underline">Lihat</Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              [1,2,3].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="w-20 h-4 bg-gray-700 rounded animate-pulse" />
                  <span className="w-8 h-4 bg-gray-700 rounded animate-pulse" />
                </div>
              ))
            ) : (
              <>
                <AttendanceRow label="On Time" value={onTimeCount} color="text-green-400" icon="fa-check-circle" />
                <AttendanceRow label="Late" value={lateCount} color="text-yellow-400" icon="fa-exclamation-circle" />
                <AttendanceRow label="Absent" value={absentCount} color="text-red-400" icon="fa-times-circle" />
                {checkedIn != null && (
                  <div className="pt-2 border-t border-border flex justify-between items-center text-xs text-gray-400">
                    <span className="font-bold">Total Checked In</span>
                    <span className="font-bold text-white">{checkedIn}{staffDisplay != null ? ` / ${staffDisplay}` : ""}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Class & Coach Stats */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-sm uppercase tracking-wide text-gray-300">Kelas &amp; Coach</h4>
            <Link href={adminPaths.classes} className="text-xs text-sweat hover:underline">Lihat</Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              [1,2,3,4].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="w-24 h-4 bg-gray-700 rounded animate-pulse" />
                  <span className="w-8 h-4 bg-gray-700 rounded animate-pulse" />
                </div>
              ))
            ) : (
              <>
                <QuickStatRow label="Total Kelas" value={totalClasses} />
                <QuickStatRow label="Upcoming" value={upcomingClasses} accent="text-green-400" />
                <QuickStatRow label="Completed" value={completedClasses} accent="text-gray-400" />
                <QuickStatRow label="Cancelled" value={cancelledClasses} accent="text-red-400" />
                <div className="pt-2 border-t border-border" />
                <QuickStatRow label="Active Coaches" value={activeCoaches ?? totalCoaches} accent="text-sweat" />
                {avgRating != null && (
                  <QuickStatRow label="Avg Rating" value={`${avgRating.toFixed(1)} ★`} accent="text-sweat" />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Payment Summary (owner only) ─────────────────────────────────── */}
      {currentRole === "owner" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Paid", value: paidCount, accent: "text-green-400", icon: "fa-check" },
            { label: "Pending", value: pendingCount, accent: "text-yellow-400", icon: "fa-hourglass-half" },
            { label: "Failed", value: failedCount, accent: "text-red-400", icon: "fa-times" },
            { label: "Total Revenue", value: totalRevenue != null ? formatRupiah(totalRevenue) : null, accent: "text-sweat", icon: "fa-dollar-sign" },
          ].map(({ label, value, accent, icon }) => (
            <Link key={label} href={adminPaths.payments} className="block">
              <div className="bg-card rounded-xl border border-border p-4 hover:border-sweat/40 transition">
                <div className="flex items-center gap-2 mb-2">
                  <i className={`fas ${icon} text-xs ${accent}`} aria-hidden />
                  <p className="text-xs text-gray-400 font-bold uppercase">{label}</p>
                </div>
                <p className={`text-xl font-bold ${accent}`}>
                  {loading ? <Skeleton w="w-12" /> : (value ?? "—")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Recent Transactions + Today's Classes ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    const status = p.paymentStatus ?? p.status ?? "—";
                    const statusLower = status.toLowerCase();
                    const badgeCls =
                      statusLower === "paid"
                        ? "bg-green-500/10 text-green-500"
                        : statusLower === "pending"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : "bg-red-500/10 text-red-400";
                    return (
                      <tr key={p.id} className="table-row transition">
                        <td className="px-5 py-3 font-medium text-white">
                          {p.memberName ?? p.fullName ?? "—"}
                        </td>
                        <td className="px-5 py-3">{p.membershipType ?? "—"}</td>
                        <td className="px-5 py-3 text-white font-mono text-xs">
                          {p.amount != null ? formatRupiah(p.amount) : "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${badgeCls}`}>
                            {status}
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
            <p className="text-gray-500 text-sm">No classes found.</p>
          ) : (
            <div className="space-y-3">
              {todayClasses.map((c) => {
                const isCancelled = c.isCancelled;
                return (
                  <div
                    key={c.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                      isCancelled
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
                      <p className="text-xs text-gray-400 truncate">
                        {c.coachName ?? "—"} · {c.branchName ?? c.location ?? "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-sweat leading-none">
                        {c.bookedCount ?? c.enrolled ?? 0}
                        <span className="text-xs text-gray-500 font-normal">/{c.capacity ?? 0}</span>
                      </p>
                      <p className="text-[10px] text-gray-500">booked</p>
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

function MemberStatRow({
  label,
  value,
  color,
  total,
}: {
  label: string;
  value: number | null;
  color: string;
  total: number | null;
}) {
  if (value == null) return null;
  const pct = total != null && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-bold">{value.toLocaleString("id-ID")}{pct != null ? ` (${pct}%)` : ""}</span>
      </div>
      {pct != null && (
        <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

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
    <div className="flex justify-between items-center text-sm">
      <span className="flex items-center gap-2 text-gray-400">
        <i className={`fas ${icon} text-xs ${color}`} aria-hidden />
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
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={`font-bold ${accent ?? "text-white"}`}>
        {typeof value === "number" ? value.toLocaleString("id-ID") : value}
      </span>
    </div>
  );
}
