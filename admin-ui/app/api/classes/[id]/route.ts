import { forwardJson, readJsonBody } from "@/lib/api/backend";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return forwardJson(`/api/v1/class-schedules/${id}`);
}

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return forwardJson(`/api/v1/class-schedules/${id}`, {
    method: "PUT",
    body: await readJsonBody(req),
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return forwardJson(`/api/v1/class-schedules/${id}`, { method: "DELETE" });
}
