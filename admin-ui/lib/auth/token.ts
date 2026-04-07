import { cookies } from "next/headers";
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME } from "./constants";

export async function setAuthTokenCookie(token: string) {
  const store = await cookies();
  store.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearAuthTokenCookie() {
  const store = await cookies();
  store.delete(AUTH_COOKIE_NAME);
}
