import { forwardJson, queryFrom, readJsonBody } from "@/lib/api/backend";

export async function GET(req: Request) {
  const { page, pageSize, search, isActive, branchId } = queryFrom(req);

  return forwardJson("/api/v1/class-schedules/paged", {
    query: {
      page: page ?? "1",
      pageSize: pageSize ?? "10",
      search,
      isActive,
      branchId,
    },
  });
}

export async function POST(req: Request) {
  return forwardJson("/api/v1/class-schedules", {
    method: "POST",
    body: await readJsonBody(req),
  });
}
