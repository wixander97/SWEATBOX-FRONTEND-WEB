export const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME ?? "sb_access_token";

const parsedMaxAge = Number(process.env.AUTH_COOKIE_MAX_AGE_SECONDS);
export const AUTH_COOKIE_MAX_AGE_SECONDS =
  Number.isFinite(parsedMaxAge) && parsedMaxAge > 0
    ? parsedMaxAge
    : 60 * 60 * 24 * 7;

export const API_BASE_URL =
  process.env.SWEATBOX_API_BASE_URL ?? "https://api.sweatboxfnp.com";
