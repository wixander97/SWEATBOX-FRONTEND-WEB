import { NextResponse } from "next/server";
import { loginWithApi } from "@/lib/auth/service";
import { setAuthTokenCookie } from "@/lib/auth/token";
import type { LoginRequest } from "@/lib/auth/types";

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<LoginRequest>;
  if (!body.email || !body.password) {
    return NextResponse.json(
      { message: "Email dan password wajib diisi" },
      { status: 400 }
    );
  }

  const result = await loginWithApi({
    email: body.email,
    password: body.password,
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.error }, { status: result.status });
  }

  await setAuthTokenCookie(result.token);
  return NextResponse.json({ ok: true });
}
