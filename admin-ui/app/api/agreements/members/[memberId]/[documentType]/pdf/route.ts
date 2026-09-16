import { forwardFile } from "@/lib/api/backend";

/** The signed copy of one document, rendered by the backend. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ memberId: string; documentType: string }> }
) {
  const { memberId, documentType } = await ctx.params;
  return forwardFile(
    `/api/v1/agreements/members/${memberId}/${encodeURIComponent(documentType)}/pdf`,
    `${documentType}-${memberId}.pdf`
  );
}
