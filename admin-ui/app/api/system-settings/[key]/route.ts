import { forwardJson, readJsonBody } from "@/lib/api/backend";

type Ctx = { params: Promise<{ key: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { key } = await ctx.params;
  return forwardJson(`/api/system-settings/${encodeURIComponent(key)}`);
}

export async function PUT(req: Request, ctx: Ctx) {
  const { key } = await ctx.params;
  return forwardJson(`/api/system-settings/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: await readJsonBody(req),
  });
}
