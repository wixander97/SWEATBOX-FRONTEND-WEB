import { apiGet, apiPut, type RequestOptions } from "./http";
import { readPage, type PageInfo, type Paged } from "./client";

/**
 * Drop-in catalogue and sold passes (`/api/v1/drop-in`).
 *
 * The catalogue is still stored in System Settings (`DROP_IN_PASS_{BRANCH}`,
 * `_VISITS`, `_VALIDITY_DAYS`, `_ENABLED`), but the backend now reads and writes
 * those rows itself, so the portal edits products, not raw keys.
 *
 * Payment category 4 is the One Day Pass (unlimited classes on one day at one
 * branch); 3 is the Single Visit (one class).
 */

export const DROP_IN_CATEGORY = {
  singleVisit: 3,
  dayPass: 4,
} as const;

export type DropInPassType = "DayPass" | "SingleVisit" | "MultiVisit" | string;

export type DropInProduct = {
  branchId: string;
  branchName: string;
  /** 3 = Single Visit, 4 = One Day Pass. */
  paymentCategory: number;
  passType: DropInPassType;
  name: string;
  description: string;
  price: number;
  discount: number;
  finalPrice: number;
  discountReason?: string | null;
  isUnlimited: boolean;
  /** Null when unlimited. */
  visits: number | null;
  validityDays: number;
  isEnabled: boolean;
};

export type UpdateDropInProductRequest = {
  branchId: string;
  paymentCategory: number;
  price: number;
  /** Null or 0 = unlimited (One Day Pass only). */
  visits: number | null;
  validityDays: number;
  isEnabled: boolean;
};

export type DropInPassRow = {
  id: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  branchId: string;
  branchName: string;
  passType: DropInPassType;
  passName: string;
  isUnlimitedVisits: boolean;
  totalVisits: number;
  remainingVisits: number;
  usedCount: number;
  reservedCount: number;
  purchasedAt: string;
  validFrom?: string | null;
  expiredAt: string;
  isActive: boolean;
  /** "Active" | "Used" | "Expired". */
  status: string;
  paymentId?: string | null;
};

/** User-facing product name, independent of what an older backend sends. */
export function dropInProductLabel(
  product: Pick<DropInProduct, "paymentCategory" | "isUnlimited" | "name">
): string {
  if (product.paymentCategory === DROP_IN_CATEGORY.singleVisit) return "Single Visit";
  if (product.isUnlimited) return "One Day Pass";
  return product.name || "Drop-In Pass";
}

/** "One Day Pass" / "Single Visit" / legacy multi-visit "Drop-In Pass". */
export function dropInPassTypeLabel(passType: string | null | undefined, passName?: string): string {
  switch ((passType ?? "").toLowerCase()) {
    case "daypass":
      return "One Day Pass";
    case "singlevisit":
      return "Single Visit";
    case "multivisit":
      return "Drop-In Pass";
    default:
      return passName || "Drop-In Pass";
  }
}

/** `GET /api/v1/drop-in/catalogue` — every product at every active branch. */
export async function getDropInCatalogue(options?: RequestOptions): Promise<DropInProduct[]> {
  const payload = await apiGet<DropInProduct[]>("/api/v1/drop-in/catalogue", {
    errorMessage: "Failed to load the drop-in catalogue",
    ...options,
  });
  return Array.isArray(payload) ? payload : [];
}

/** `PUT /api/v1/drop-in/catalogue` — Management only. */
export function updateDropInProduct(
  body: UpdateDropInProductRequest,
  options?: RequestOptions
): Promise<DropInProduct> {
  return apiPut<DropInProduct>("/api/v1/drop-in/catalogue", body, {
    errorMessage: "Failed to save the drop-in product",
    ...options,
  });
}

export type DropInPassQuery = {
  page: number;
  pageSize: number;
  search?: string;
  branchId?: string;
  passType?: string;
};

/** `GET /api/v1/drop-in/passes` — paged, with usage counts per pass. */
export async function listDropInPasses(
  query: DropInPassQuery,
  options?: RequestOptions
): Promise<PageInfo<DropInPassRow>> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.branchId) params.set("branchId", query.branchId);
  if (query.passType) params.set("passType", query.passType);

  const payload = await apiGet<Paged<DropInPassRow> | DropInPassRow[]>(
    `/api/v1/drop-in/passes?${params.toString()}`,
    { errorMessage: "Failed to load drop-in passes", ...options }
  );
  return readPage(payload, query.pageSize);
}
