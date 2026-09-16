import { forwardJson, queryFrom } from "@/lib/api/backend";

/**
 * Class occurrences for the workout form's picker.
 *
 * Reads the paged endpoint rather than `upcoming`, because `upcoming` drops any
 * class that has already finished — and a coach writing up this morning's
 * session still needs to attach it. One large page stands in for a searchable
 * picker; the form filters within it.
 */
export async function GET(req: Request) {
  const { search, branchId, pageSize } = queryFrom(req);

  return forwardJson("/api/v1/class-schedules/paged", {
    query: {
      page: 1,
      pageSize: pageSize ?? "200",
      search,
      branchId,
      isActive: "true",
    },
  });
}
