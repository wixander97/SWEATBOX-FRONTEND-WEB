import { forwardJson, readJsonBody } from "@/lib/api/backend";

/**
 * System settings.
 *
 * Note the path: this controller is mounted at `/api/system-settings`, not
 * under `/api/v1` like the rest.
 */
export async function GET() {
  return forwardJson("/api/system-settings");
}

export async function POST(req: Request) {
  return forwardJson("/api/system-settings", {
    method: "POST",
    body: await readJsonBody(req),
  });
}
