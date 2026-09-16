import { forwardFile } from "@/lib/api/backend";

/** The invoice PDF, rendered by the backend with the configured letterhead. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return forwardFile(
    `/api/v1/payments/${id}/invoice/pdf`,
    `Invoice-${id}.pdf`
  );
}
