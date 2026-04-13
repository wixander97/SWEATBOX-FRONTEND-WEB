import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const token = await getAuthTokenFromCookie();
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const isActive = url.searchParams.get("isActive");

  const backendUrl = new URL(`${API_BASE_URL}/api/v1/coaches/${id}/status`);
  if (isActive !== null) backendUrl.searchParams.set("isActive", isActive);

  const res = await fetch(backendUrl.toString(), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ message: data?.message ?? "Failed to update coach status" }, { status: res.status });
  }
  return NextResponse.json(data);
}
