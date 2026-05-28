import { cookies } from "next/headers";
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME } from "./constants";

const REFRESH_TOKEN_COOKIE_NAME = "sb_refresh_token";
const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

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

export async function setRefreshTokenCookie(refreshToken: string) {
  const store = await cookies();
  store.set(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });
}

export async function getRefreshTokenFromCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_TOKEN_COOKIE_NAME)?.value ?? null;
}

export async function clearAuthTokenCookie() {
  const store = await cookies();
  store.delete(AUTH_COOKIE_NAME);
  store.delete(REFRESH_TOKEN_COOKIE_NAME);
}

export async function clearRefreshTokenCookie() {
  const store = await cookies();
  store.delete(REFRESH_TOKEN_COOKIE_NAME);
}