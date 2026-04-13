import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const token = await getAuthTokenFromCookie();
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json();

  const res = await fetch(`${API_BASE_URL}/api/v1/users/${id}/reset-password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ message: data?.message ?? "Failed to reset password" }, { status: res.status });
  }
  return NextResponse.json(data);
}
