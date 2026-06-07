import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/auth/constants";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  console.log("[API/v1/auth/register/POST] Payload:", body);

  const url = `${API_BASE_URL}/api/v1/auth/register`;
  console.log(`[API/v1/auth/register/POST] Sending to: ${url}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[API/v1/auth/register/POST] Status: ${res.status}`, res.ok ? "✓ OK" : "✗ ERROR", data);

    if (!res.ok) {
      return NextResponse.json({ message: data?.message ?? "Registration failed" }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[API/v1/auth/register/POST] Network error:", err);
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}