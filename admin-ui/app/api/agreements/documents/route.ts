import { forwardJson, queryFrom, readJsonBody } from "@/lib/api/backend";

export async function GET(req: Request) {
  return forwardJson("/api/v1/agreements/documents", { query: queryFrom(req) });
}

export async function POST(req: Request) {
  return forwardJson("/api/v1/agreements/documents", {
    method: "POST",
    body: await readJsonBody(req),
  });
}
