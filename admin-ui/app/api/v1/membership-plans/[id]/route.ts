import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/membership-plans/[id]/GET] Unauthorized - no token");
    return unauthorized();
  }

  const { id } = await params;
  const url = `${API_BASE_URL}/api/v1/membership-plans/${id}`;
  console.log(`[API/v1/membership-plans/[id]/GET] Fetching: ${url}`);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    console.log(`[API/v1/membership-plans/[id]/GET] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: data?.message ?? "Failed to fetch membership plan" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/membership-plans/[id]/GET] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/membership-plans/[id]/PUT] Unauthorized - no token");
    return unauthorized();
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  console.log(`[API/v1/membership-plans/[id]/PUT] Payload for ${id}:`, body);

  const url = `${API_BASE_URL}/api/v1/membership-plans/${id}`;
  console.log(`[API/v1/membership-plans/[id]/PUT] Sending to: ${url}`);

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[API/v1/membership-plans/[id]/PUT] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: data?.message ?? "Failed to update membership plan" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/membership-plans/[id]/PUT] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/membership-plans/[id]/DELETE] Unauthorized - no token");
    return unauthorized();
  }

  const { id } = await params;
  const url = `${API_BASE_URL}/api/v1/membership-plans/${id}`;
  console.log(`[API/v1/membership-plans/[id]/DELETE] Deleting: ${url}`);

  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[API/v1/membership-plans/[id]/DELETE] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: data?.message ?? "Failed to delete membership plan" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/membership-plans/[id]/DELETE] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}