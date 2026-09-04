import { apiGet, toList, type PagedResponse, type RequestOptions } from "./http";

export type Coach = {
  id: string;
  fullName?: string | null;
  name?: string | null;
  isActive?: boolean;
};

export async function listCoaches(options?: RequestOptions): Promise<Coach[]> {
  const payload = await apiGet<Coach[] | PagedResponse<Coach>>(
    "/api/v1/coaches?page=1&pageSize=200",
    { errorMessage: "Gagal memuat coach", ...options }
  );
  return toList(payload);
}

export function coachLabel(c: Coach): string {
  return c.fullName || c.name || c.id;
}
