import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/stats/GET] Unauthorized - no token");
    return unauthorized();
  }

  console.log("[API/v1/stats/GET] Fetching dashboard stats...");

  try {
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

    const data = {
      members: extract(membersRes),
      coaches: extract(coachesRes),
      classes: extract(classesRes),
      payments: extract(paymentsRes),
      staffs: extract(staffsRes),
      attendance: extract(attendanceRes),
    };

    console.log(`[API/v1/stats/GET] ✓ OK`, data);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/stats/GET] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}