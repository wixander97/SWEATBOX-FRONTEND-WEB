import { forwardJson, queryFrom, readJsonBody } from "@/lib/api/backend";

export async function GET(req: Request) {
  return forwardJson("/api/v1/workouts", { query: queryFrom(req) });
}

export async function POST(req: Request) {
  return forwardJson("/api/v1/workouts", {
    method: "POST",
    body: await readJsonBody(req),
  });
}
