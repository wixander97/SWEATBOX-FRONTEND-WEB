import { forwardJson } from "@/lib/api/backend";

/** The workout attached to one class occurrence, published or not. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ classScheduleId: string }> }
) {
  const { classScheduleId } = await ctx.params;
  return forwardJson(`/api/v1/workouts/class-schedule/${classScheduleId}`);
}
