import { forwardJson } from "@/lib/api/backend";

/** What each seat on one class is paid, and where the number came from. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ classScheduleId: string }> }
) {
  const { classScheduleId } = await ctx.params;
  return forwardJson(
    `/api/v1/coach-rate-tiers/class-schedule/${classScheduleId}`
  );
}
