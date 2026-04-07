import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "./constants";

export async function getAuthTokenFromCookie() {
  const store = await cookies();
  return store.get(AUTH_COOKIE_NAME)?.value ?? null;
}
