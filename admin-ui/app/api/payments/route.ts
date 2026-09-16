import { forwardJson, queryFrom, readJsonBody } from "@/lib/api/backend";

/**
 * Lists payments.
 *
 * `status` selects one of the backend's pre-filtered collections rather than
 * being passed through as a query parameter — those are separate endpoints on
 * the API. Any other filter (paging, search, date range) forwards untouched.
 */
export async function GET(req: Request) {
  const query = queryFrom(req);
  const { status, ...rest } = query;

  const byStatus: Record<string, string> = {
    paid: "/api/v1/payments/paid",
    pending: "/api/v1/payments/pending",
    failed: "/api/v1/payments/failed",
  };
  const path = byStatus[status ?? ""] ?? "/api/v1/payments";

  // A recognised status is expressed by the path, so it is not forwarded twice.
  return forwardJson(path, { query: path === "/api/v1/payments" ? query : rest });
}

/**
 * Records a sale.
 *
 * The amount is not sent: the backend prices the plan itself, applies the
 * cross-branch member discount and rejects a plan outside its sales window, so
 * what is charged is what the API decided — the POS screen only reports it.
 */
export async function POST(req: Request) {
  return forwardJson("/api/v1/payments", {
    method: "POST",
    body: await readJsonBody(req),
  });
}
