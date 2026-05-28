import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";
import { getAuthTokenFromCookie } from "@/lib/auth/server-token";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthTokenFromCookie();
  if (!token) {
    console.warn("[API/v1/coaches/[id]/status/PATCH] Unauthorized - no token");
    return unauthorized();
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  console.log(`[API/v1/coaches/[id]/status/PATCH] Payload for ${id}:`, body);

  const url = `${API_BASE_URL}/api/v1/coaches/${id}/status`;
  console.log(`[API/v1/coaches/[id]/status/PATCH] Sending to: ${url}`);

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[API/v1/coaches/[id]/status/PATCH] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: data?.message ?? "Failed to update coach status" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/coaches/[id]/status/PATCH] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}