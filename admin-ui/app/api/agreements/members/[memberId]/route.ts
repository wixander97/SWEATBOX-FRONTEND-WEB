import { forwardJson } from "@/lib/api/backend";

/** A member's acceptances, including the signature they drew. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await ctx.params;
  return forwardJson(`/api/v1/agreements/members/${memberId}`);
}
