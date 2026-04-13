import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const token = await getAuthTokenFromCookie();
  if (!token) return unauthorized();
  const { id } = await ctx.params;

  const res = await fetch(`${API_BASE_URL}/api/v1/staffs/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ message: data?.message ?? "Failed to fetch staff" }, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const token = await getAuthTokenFromCookie();
  if (!token) return unauthorized();
  const { id } = await ctx.params;
  const body = await req.json();

  const res = await fetch(`${API_BASE_URL}/api/v1/staffs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ message: data?.message ?? "Failed to update staff" }, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const token = await getAuthTokenFromCookie();
  if (!token) return unauthorized();
  const { id } = await ctx.params;

  const res = await fetch(`${API_BASE_URL}/api/v1/staffs/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return NextResponse.json({ message: "Failed to delete staff" }, { status: res.status });
  }
  return NextResponse.json({ ok: true });
}
