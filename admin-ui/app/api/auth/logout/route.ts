import { NextResponse } from "next/server";
import { clearAuthTokenCookie } from "@/lib/auth/token";

export async function POST() {
  await clearAuthTokenCookie();
  return NextResponse.json({ ok: true });
}
