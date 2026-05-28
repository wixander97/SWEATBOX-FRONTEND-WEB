import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/users/[id]/GET] Unauthorized - no token");
    return unauthorized();
  }

  const { id } = await params;
  const url = `${API_BASE_URL}/api/v1/users/${id}`;
  console.log(`[API/v1/users/[id]/GET] Fetching: ${url}`);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    console.log(`[API/v1/users/[id]/GET] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json(
        { message: data?.message ?? "Failed to fetch user" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/users/[id]/GET] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/users/[id]/PUT] Unauthorized - no token");
    return unauthorized();
  }

  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
    console.log(`[API/v1/users/[id]/PUT] Payload for ${id}:`, body);
  } catch {
    console.error("[API/v1/users/[id]/PUT] Failed to parse body");
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const url = `${API_BASE_URL}/api/v1/users/${id}`;
  console.log(`[API/v1/users/[id]/PUT] Sending to: ${url}`);

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[API/v1/users/[id]/PUT] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json(
        { message: data?.message ?? "Failed to update user" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/users/[id]/PUT] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/users/[id]/DELETE] Unauthorized - no token");
    return unauthorized();
  }

  const { id } = await params;
  const url = `${API_BASE_URL}/api/v1/users/${id}`;
  console.log(`[API/v1/users/[id]/DELETE] Deleting: ${url}`);

  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[API/v1/users/[id]/DELETE] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json(
        { message: data?.message ?? "Failed to delete user" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/users/[id]/DELETE] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}