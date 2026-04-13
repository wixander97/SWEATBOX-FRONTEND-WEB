import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

export async function GET() {
  const token = await getAuthTokenFromCookie();
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const headers = { Authorization: `Bearer ${token}` };
  const opts = { headers, cache: "no-store" } as RequestInit;

  const [membersRes, coachesRes, classesRes, paymentsRes, staffsRes, attendanceRes] =
    await Promise.allSettled([
      fetch(`${API_BASE_URL}/api/v1/members/stats`, opts).then((r) => r.json().catch(() => null)),
      fetch(`${API_BASE_URL}/api/v1/coaches/stats`, opts).then((r) => r.json().catch(() => null)),
      fetch(`${API_BASE_URL}/api/v1/class-schedules/stats`, opts).then((r) => r.json().catch(() => null)),
      fetch(`${API_BASE_URL}/api/v1/payments/summary`, opts).then((r) => r.json().catch(() => null)),
      fetch(`${API_BASE_URL}/api/v1/staffs/stats`, opts).then((r) => r.json().catch(() => null)),
      fetch(`${API_BASE_URL}/api/v1/staff-attendances/stats`, opts).then((r) => r.json().catch(() => null)),
    ]);

  function extract<T>(result: PromiseSettledResult<T>): T | null {
    return result.status === "fulfilled" ? result.value : null;
  }

  return NextResponse.json({
    members: extract(membersRes),
    coaches: extract(coachesRes),
    classes: extract(classesRes),
    payments: extract(paymentsRes),
    staffs: extract(staffsRes),
    attendance: extract(attendanceRes),
  });
}
