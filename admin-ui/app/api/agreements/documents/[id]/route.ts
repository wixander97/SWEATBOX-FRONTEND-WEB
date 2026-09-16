import { forwardJson, readJsonBody } from "@/lib/api/backend";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return forwardJson(`/api/v1/agreements/documents/${id}`);
}

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return forwardJson(`/api/v1/agreements/documents/${id}`, {
    method: "PUT",
    body: await readJsonBody(req),
  });
}
