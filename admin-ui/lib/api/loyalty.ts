import { apiDelete, apiGet, apiPost, apiPut, type RequestOptions } from "./http";
import { readPage, type PageInfo, type Paged } from "./client";

/**
 * Loyalty programme (`/api/v1/loyalty`).
 *
 * The backend owns every number here: points are earned automatically when a
 * payment is Paid (floor(paid / amountPerPoint) × pointsPerUnit), reversed on
 * refund, and balances are never computed client-side.
 */

const BASE = "/api/v1/loyalty";

export type LoyaltySettings = {
  isEnabled: boolean;
  amountPerPoint: number;
  pointsPerUnit: number;
  reverseOnRefund: boolean;
  /** Always "Floor". */
  rounding?: string;
};

export type LoyaltyBalance = {
  memberId: string;
  memberName: string;
  memberCode: string;
  balance: number;
  totalEarned: number;
  totalRedeemed: number;
  amountPerPoint: number;
  pointsPerUnit: number;
  isEnabled: boolean;
};

export type LoyaltyEntryType =
  | "Earn"
  | "Redeem"
  | "Adjust"
  | "Reversal"
  | "Expire"
  | "ReferralReward"
  | "ReferralSignupReward";

export const LOYALTY_ENTRY_TYPES: LoyaltyEntryType[] = [
  "Earn",
  "Redeem",
  "Adjust",
  "Reversal",
  "Expire",
  "ReferralReward",
  "ReferralSignupReward",
];

export type LoyaltyLedgerEntry = {
  id: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  entryType: LoyaltyEntryType | string;
  /** Signed. */
  points: number;
  balanceAfter: number;
  reference: string;
  description: string;
  paymentId?: string | null;
  redemptionId?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
  createdAt: string;
};

export type LoyaltyRewardRequest = {
  name: string;
  description: string;
  voucherAmount: number;
  requiredPoints: number;
  voucherCodePrefix: string;
  voucherValidityDays: number | null;
  totalQuantity: number | null;
  perMemberLimit: number | null;
  branchId: string | null;
  minimumTransaction: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
};

export type LoyaltyReward = LoyaltyRewardRequest & {
  id: string;
  branchName?: string | null;
  redeemedCount: number;
  remainingQuantity: number | null;
  isAvailable: boolean;
  canRedeem: boolean;
  createdAt: string;
};

export type LoyaltyVoucherStatus = "Issued" | "Used" | "Expired" | "Cancelled";

export const LOYALTY_VOUCHER_STATUSES: LoyaltyVoucherStatus[] = [
  "Issued",
  "Used",
  "Expired",
  "Cancelled",
];

export type LoyaltyVoucher = {
  id: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  rewardId: string;
  rewardName: string;
  voucherCode: string;
  voucherAmount: number;
  pointsSpent: number;
  status: LoyaltyVoucherStatus | string;
  branchId?: string | null;
  branchName?: string | null;
  minimumTransaction: number;
  expiresAt?: string | null;
  usedAt?: string | null;
  usedReference: string;
  createdAt: string;
};

export type UseVoucherRequest = {
  branchId: string | null;
  transactionAmount: number | null;
  reference: string;
};

function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/* Settings ---------------------------------------------------------------- */

export function getLoyaltySettings(options?: RequestOptions): Promise<LoyaltySettings> {
  return apiGet<LoyaltySettings>(`${BASE}/settings`, {
    errorMessage: "Failed to load loyalty settings",
    ...options,
  });
}

export function updateLoyaltySettings(
  body: Omit<LoyaltySettings, "rounding"> & { reason: string },
  options?: RequestOptions
): Promise<LoyaltySettings> {
  return apiPut<LoyaltySettings>(`${BASE}/settings`, body, {
    errorMessage: "Failed to save loyalty settings",
    ...options,
  });
}

/* Rewards ----------------------------------------------------------------- */

export async function listLoyaltyRewards(options?: RequestOptions): Promise<LoyaltyReward[]> {
  const payload = await apiGet<LoyaltyReward[]>(`${BASE}/rewards?includeInactive=true`, {
    errorMessage: "Failed to load rewards",
    ...options,
  });
  return Array.isArray(payload) ? payload : [];
}

export function createLoyaltyReward(body: LoyaltyRewardRequest): Promise<LoyaltyReward> {
  return apiPost<LoyaltyReward>(`${BASE}/rewards`, body, {
    errorMessage: "Failed to create reward",
  });
}

export function updateLoyaltyReward(id: string, body: LoyaltyRewardRequest): Promise<LoyaltyReward> {
  return apiPut<LoyaltyReward>(`${BASE}/rewards/${encodeURIComponent(id)}`, body, {
    errorMessage: "Failed to update reward",
  });
}

export function deleteLoyaltyReward(id: string): Promise<unknown> {
  return apiDelete<unknown>(`${BASE}/rewards/${encodeURIComponent(id)}`, {
    errorMessage: "Failed to delete reward",
  });
}

/* Accounts & ledger ------------------------------------------------------- */

export async function listLoyaltyAccounts(
  params: { page: number; pageSize: number; search?: string },
  options?: RequestOptions
): Promise<PageInfo<LoyaltyBalance>> {
  const payload = await apiGet<Paged<LoyaltyBalance> | LoyaltyBalance[]>(
    `${BASE}/accounts${query({ page: params.page, pageSize: params.pageSize, search: params.search?.trim() })}`,
    { errorMessage: "Failed to load loyalty accounts", ...options }
  );
  return readPage(payload, params.pageSize);
}

export function getLoyaltyAccount(
  memberId: string,
  options?: RequestOptions
): Promise<LoyaltyBalance> {
  return apiGet<LoyaltyBalance>(`${BASE}/accounts/${encodeURIComponent(memberId)}`, {
    errorMessage: "Failed to load the member's points",
    ...options,
  });
}

export async function listLoyaltyLedger(
  params: {
    page: number;
    pageSize: number;
    memberId?: string;
    type?: string;
    search?: string;
  },
  options?: RequestOptions
): Promise<PageInfo<LoyaltyLedgerEntry>> {
  const payload = await apiGet<Paged<LoyaltyLedgerEntry> | LoyaltyLedgerEntry[]>(
    `${BASE}/ledger${query({
      page: params.page,
      pageSize: params.pageSize,
      memberId: params.memberId,
      type: params.type,
      search: params.search?.trim(),
    })}`,
    { errorMessage: "Failed to load the points ledger", ...options }
  );
  return readPage(payload, params.pageSize);
}

export function adjustLoyaltyPoints(body: {
  memberId: string;
  points: number;
  reason: string;
}): Promise<LoyaltyLedgerEntry> {
  return apiPost<LoyaltyLedgerEntry>(`${BASE}/adjustments`, body, {
    errorMessage: "Failed to adjust points",
  });
}

/* Vouchers ---------------------------------------------------------------- */

export async function listLoyaltyVouchers(
  params: { page: number; pageSize: number; search?: string; status?: string },
  options?: RequestOptions
): Promise<PageInfo<LoyaltyVoucher>> {
  const payload = await apiGet<Paged<LoyaltyVoucher> | LoyaltyVoucher[]>(
    `${BASE}/vouchers${query({
      page: params.page,
      pageSize: params.pageSize,
      search: params.search?.trim(),
      status: params.status,
    })}`,
    { errorMessage: "Failed to load vouchers", ...options }
  );
  return readPage(payload, params.pageSize);
}

export function getLoyaltyVoucher(code: string, options?: RequestOptions): Promise<LoyaltyVoucher> {
  return apiGet<LoyaltyVoucher>(`${BASE}/vouchers/${encodeURIComponent(code.trim())}`, {
    errorMessage: "Voucher not found",
    ...options,
  });
}

export function redeemLoyaltyVoucher(code: string, body: UseVoucherRequest): Promise<LoyaltyVoucher> {
  return apiPost<LoyaltyVoucher>(
    `${BASE}/vouchers/${encodeURIComponent(code.trim())}/use`,
    body,
    { errorMessage: "Failed to redeem the voucher" }
  );
}
