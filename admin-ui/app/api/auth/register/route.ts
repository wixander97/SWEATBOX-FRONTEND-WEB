import { NextResponse } from "next/server";
import { registerWithApi } from "@/lib/auth/service";
import type { RegisterRequest } from "@/lib/auth/types";

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<RegisterRequest>;
  if (!body.fullName || !body.email || !body.password) {
    return NextResponse.json(
      { message: "Nama, email, dan password wajib diisi" },
      { status: 400 }
    );
  }

  const result = await registerWithApi({
    fullName: body.fullName,
    email: body.email,
    password: body.password,
    role: body.role || "Admin",
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
