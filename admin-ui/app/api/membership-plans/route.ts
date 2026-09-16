import { forwardJson, queryFrom, readJsonBody } from "@/lib/api/backend";

/**
 * The plan catalogue.
 *
 * `branchId` narrows to one club's plans through the API's own branch
 * endpoint, so POS never has to filter a full catalogue client-side.
 */
export async function GET(req: Request) {
  const { branchId, activeOnly } = queryFrom(req);

  if (branchId) {
    return forwardJson(`/api/v1/membership-plans/branch/${branchId}`);
  }

  return forwardJson(
    activeOnly === "true"
      ? "/api/v1/membership-plans/active"
      : "/api/v1/membership-plans"
  );
}

export async function POST(req: Request) {
  return forwardJson("/api/v1/membership-plans", {
    method: "POST",
    body: await readJsonBody(req),
  });
}
