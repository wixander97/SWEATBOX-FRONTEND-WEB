import { forwardJson, queryFrom, readJsonBody } from "@/lib/api/backend";

export async function GET(req: Request) {
  return forwardJson("/api/v1/coach-rate-tiers", { query: queryFrom(req) });
}

export async function POST(req: Request) {
  return forwardJson("/api/v1/coach-rate-tiers", {
    method: "POST",
    body: await readJsonBody(req),
  });
}
