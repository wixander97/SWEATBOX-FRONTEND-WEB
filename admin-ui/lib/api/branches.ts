import { apiGet, toList, type PagedResponse, type RequestOptions } from "./http";

export type Branch = {
  id: string;
  branchName?: string | null;
  name?: string | null;
  isActive?: boolean;
};

export async function listBranches(options?: RequestOptions): Promise<Branch[]> {
  const payload = await apiGet<Branch[] | PagedResponse<Branch>>("/api/v1/branches", {
    errorMessage: "Failed to load branches",
    ...options,
  });
  return toList(payload).filter((b) => b.isActive !== false);
}

export function branchLabel(b: Branch): string {
  return b.branchName || b.name || b.id;
}
