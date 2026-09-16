import { forwardJson, readJsonBody } from "@/lib/api/backend";

/**
 * Moves a workout to a publication moment.
 *
 * `publishAt` travels as a Jakarta wall-clock value with no offset — the
 * backend reads it through `JakartaTime.ToUtc`, so appending `Z` here would
 * publish the workout seven hours early.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return forwardJson(`/api/v1/workouts/${id}/schedule-publish`, {
    method: "POST",
    body: await readJsonBody(req),
  });
}
