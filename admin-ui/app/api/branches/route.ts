import { forwardJson } from "@/lib/api/backend";

export async function GET() {
  return forwardJson("/api/v1/branches");
}
