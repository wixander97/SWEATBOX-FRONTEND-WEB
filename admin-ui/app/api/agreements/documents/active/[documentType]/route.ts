import { forwardJson } from "@/lib/api/backend";

/**
 * The version a registration form must present.
 *
 * Fetched rather than hard-coded so the text a member signs is the current one,
 * and so the acceptance is recorded against the version they actually read.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ documentType: string }> }
) {
  const { documentType } = await ctx.params;
  return forwardJson(
    `/api/v1/agreements/documents/active/${encodeURIComponent(documentType)}`
  );
}
