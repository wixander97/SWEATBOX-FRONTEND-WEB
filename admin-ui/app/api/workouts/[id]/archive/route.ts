import { forwardJson } from "@/lib/api/backend";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return forwardJson(`/api/v1/workouts/${id}/archive`, { method: "POST" });
}
