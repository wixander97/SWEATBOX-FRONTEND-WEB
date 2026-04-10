export function redirectToLoginIfUnauthorized(status: number) {
  if (status !== 401) return false;
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
  return true;
}
