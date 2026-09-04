import { apiGet, toList, type PagedResponse, type RequestOptions } from "./http";
import type { PtPackage } from "@/components/admin/pt/pt-types";

export type { PtPackage };

/**
 * PT packages catalogue.
 *
 * `GET /api/PTPackages` returns every package. Templates (records without a
 * `memberId`) are what the front desk sells; member-owned packages are existing
 * purchases and are filtered out of the catalogue but used for customer context.
 */
export async function listPtPackages(options?: RequestOptions): Promise<PtPackage[]> {
  const payload = await apiGet<PtPackage[] | PagedResponse<PtPackage>>(
    "/api/PTPackages?page=1&pageSize=200",
    { errorMessage: "Gagal memuat PT package", ...options }
  );
  return toList(payload);
}

const ZERO_GUID = "00000000-0000-0000-0000-000000000000";

export function isTemplatePackage(pkg: PtPackage): boolean {
  const memberId = pkg.memberId;
  if (!memberId) return true;
  return memberId.toLowerCase() === ZERO_GUID;
}

export function isOwnedBy(pkg: PtPackage, memberId: string): boolean {
  return !!pkg.memberId && pkg.memberId.toLowerCase() === memberId.toLowerCase();
}
