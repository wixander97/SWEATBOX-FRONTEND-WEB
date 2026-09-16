import { forwardJson, readJsonBody } from "@/lib/api/backend";

/**
 * Registers a customer from the admin portal.
 *
 * Proxies `POST /api/v1/members/register`, the staff/POS endpoint. It is the
 * one that enforces the complete registration the business made mandatory —
 * every personal field, the waiver, the house rules and the signature — and it
 * returns the created member so POS can select them straight away.
 *
 * Deliberately *not* `auth/register-member`: that is the member app's own
 * sign-up, it still accepts its existing looser payload, and pointing the admin
 * portal at it would let a registration be completed without the agreements.
 * Leaving it untouched is what keeps the mobile app working without a release.
 */
export async function POST(req: Request) {
  return forwardJson("/api/v1/members/register", {
    method: "POST",
    body: await readJsonBody(req),
  });
}
