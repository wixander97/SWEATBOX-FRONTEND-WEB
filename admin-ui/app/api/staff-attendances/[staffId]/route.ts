import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ staffId: string }> }
) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { staffId } = await params;

  const res = await fetch(
    `${API_BASE_URL}/api/v1/staff-attendances/staff/${staffId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );
  const data = await res.json().catch(() => []);

  if (!res.ok) {
    return NextResponse.json(
      { message: "Failed to fetch staff attendance" },
      { status: res.status }
    );
  }

  return NextResponse.json(data);
}
