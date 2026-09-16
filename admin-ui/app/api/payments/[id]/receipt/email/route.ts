import { forwardJson, readJsonBody } from "@/lib/api/backend";

/** Emails the receipt to the paying member; the body is rendered server-side. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return forwardJson(`/api/v1/payments/${id}/receipt/email`, {
    method: "POST",
    body: await readJsonBody(req),
  });
}
