export type Branch = {
  id: string;
  branchName: string;
  latitude?: number;
  longitude?: number;
  attendanceRadiusMeter?: number;
  isActive: boolean;
};

/** Branch name for an id, for rows that carry only the id. */
export function branchName(
  branches: Branch[],
  id?: string | null
): string {
  if (!id) return "All branches";
  return branches.find((branch) => branch.id === id)?.branchName ?? "-";
}
