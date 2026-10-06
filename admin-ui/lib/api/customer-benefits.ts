import { apiGet, apiPost, apiPut, type RequestOptions } from "./http";
import { readPage, type PageInfo, type Paged } from "./client";

/**
 * Customer benefits: the first transaction discount, the referral programme
 * and the settings audit trail (`/api/v1/customer-benefits`, `/api/v1/referrals`).
 *
 * The backend decides every eligibility and amount; the portal only shows and
 * edits the configured values.
 */

const BENEFITS = "/api/v1/customer-benefits";
const REFERRALS = "/api/v1/referrals";

function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/* First transaction discount ---------------------------------------------- */

export type DiscountType = "Fixed" | "Percent";

/** Payment categories (backend `PaymentCategory`). */
export const PAYMENT_CATEGORY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Membership" },
  { value: 2, label: "PT Package" },
  { value: 3, label: "Single Visit" },
  { value: 4, label: "One Day Pass" },
];

export type FirstTransactionDiscountSettings = {
  isEnabled: boolean;
  discountType: DiscountType | string;
  /** Rupiah for Fixed, percent (0-100) for Percent. */
  amount: number;
  minimumTransaction: number;
  maximumDiscount: number | null;
  /** `YYYY-MM-DD` (request) / date-time (response); null = open. */
  startDate: string | null;
  endDate: string | null;
  /** Empty = every branch. */
  branchIds: string[];
  /** Empty = every category. */
  paymentCategories: number[];
  /** Response only. */
  isActiveNow?: boolean;
};

export type FirstTransactionDiscountSettingsRequest = Omit<
  FirstTransactionDiscountSettings,
  "isActiveNow"
> & { reason: string };

export function getFirstTransactionSettings(
  options?: RequestOptions
): Promise<FirstTransactionDiscountSettings> {
  return apiGet<FirstTransactionDiscountSettings>(
    `${BENEFITS}/first-transaction-discount/settings`,
    { errorMessage: "Failed to load first transaction discount settings", ...options }
  );
}

export function updateFirstTransactionSettings(
  body: FirstTransactionDiscountSettingsRequest
): Promise<FirstTransactionDiscountSettings> {
  return apiPut<FirstTransactionDiscountSettings>(
    `${BENEFITS}/first-transaction-discount/settings`,
    body,
    { errorMessage: "Failed to save first transaction discount settings" }
  );
}

/**
 * `GET /api/v1/customer-benefits/quote` → `PurchaseQuoteResponse`.
 *
 * What a membership plan or PT package would cost this customer right now,
 * priced by the same calculation `POST /api/v1/payments` uses: list price,
 * member discount, then the first transaction discount.
 */
export type PurchaseQuote = {
  price: number;
  /** Always 0 for a PT package. */
  memberDiscount: number;
  /** 0 when the customer is not eligible for this purchase. */
  firstTransactionDiscount: number;
  finalPrice: number;
  notes?: string | null;
};

export function getPurchaseQuote(
  params: { memberId: string } & (
    | { membershipPlanId: string; ptPackageId?: never }
    | { ptPackageId: string; membershipPlanId?: never }
  ),
  options?: RequestOptions
): Promise<PurchaseQuote> {
  return apiGet<PurchaseQuote>(`${BENEFITS}/quote${query(params)}`, {
    errorMessage: "Failed to load the price quote",
    ...options,
  });
}

/* Referral programme ------------------------------------------------------ */

export type ReferralQualificationEvent =
  | "FirstSuccessfulTransaction"
  | "FirstMembershipPurchase"
  | "Registration";

export const QUALIFICATION_LABELS: Record<string, string> = {
  FirstSuccessfulTransaction: "First successful transaction (recommended)",
  FirstMembershipPurchase: "First successful membership purchase",
  Registration: "Successful registration (no purchase needed)",
};

/** Short label for tables. */
export const QUALIFICATION_SHORT_LABELS: Record<string, string> = {
  FirstSuccessfulTransaction: "First successful transaction",
  FirstMembershipPurchase: "First membership purchase",
  Registration: "Registration",
};

export type ReferralSettings = {
  isEnabled: boolean;
  /** Points for the new customer. */
  refereePoints: number;
  /** Points for the existing customer who referred them. */
  referrerPoints: number;
  qualificationEvent: ReferralQualificationEvent | string;
  codePrefix: string;
  codeLength: number;
  startDate: string | null;
  endDate: string | null;
  /** Response only. */
  isActiveNow?: boolean;
  /** Response only. */
  availableQualificationEvents?: string[];
};

export type ReferralSettingsRequest = Omit<
  ReferralSettings,
  "isActiveNow" | "availableQualificationEvents"
> & { reason: string };

export function getReferralSettings(options?: RequestOptions): Promise<ReferralSettings> {
  return apiGet<ReferralSettings>(`${BENEFITS}/referral/settings`, {
    errorMessage: "Failed to load referral settings",
    ...options,
  });
}

export function updateReferralSettings(body: ReferralSettingsRequest): Promise<ReferralSettings> {
  return apiPut<ReferralSettings>(`${BENEFITS}/referral/settings`, body, {
    errorMessage: "Failed to save referral settings",
  });
}

/* Settings history -------------------------------------------------------- */

export type SettingsArea = "FirstTransactionDiscount" | "Referral" | "Loyalty";

export type SettingChangeLog = {
  id: string;
  area: SettingsArea | string;
  settingKey: string;
  oldValue: string | null;
  newValue: string;
  changedByUserId?: string | null;
  changedByName: string;
  reason: string;
  createdAt: string;
};

export async function listSettingsHistory(
  params: { area: SettingsArea; page: number; pageSize: number },
  options?: RequestOptions
): Promise<PageInfo<SettingChangeLog>> {
  const payload = await apiGet<Paged<SettingChangeLog> | SettingChangeLog[]>(
    `${BENEFITS}/settings-history${query(params)}`,
    { errorMessage: "Failed to load the change history", ...options }
  );
  return readPage(payload, params.pageSize);
}

/* Referrals --------------------------------------------------------------- */

export type ReferralStatus = "Pending" | "Qualified" | "Rewarded" | "Cancelled";

export const REFERRAL_STATUSES: ReferralStatus[] = [
  "Pending",
  "Qualified",
  "Rewarded",
  "Cancelled",
];

export type Referral = {
  id: string;
  referrerMemberId: string;
  referrerName: string;
  /** Member code of the referrer. */
  referrerCode: string;
  referredMemberId: string;
  referredName: string;
  /** Member code of the referred customer. */
  referredCode: string;
  referralCode: string;
  status: ReferralStatus | string;
  qualificationEvent: ReferralQualificationEvent | string;
  createdAt: string;
  qualifiedAt?: string | null;
  rewardedAt?: string | null;
  qualifyingPaymentId?: string | null;
  referrerPoints: number;
  referredPoints: number;
  notes: string;
};

export async function listReferrals(
  params: { page: number; pageSize: number; search?: string; status?: string },
  options?: RequestOptions
): Promise<PageInfo<Referral>> {
  const payload = await apiGet<Paged<Referral> | Referral[]>(
    `${REFERRALS}${query({
      page: params.page,
      pageSize: params.pageSize,
      search: params.search?.trim(),
      status: params.status,
    })}`,
    { errorMessage: "Failed to load referrals", ...options }
  );
  return readPage(payload, params.pageSize);
}

export function cancelReferral(id: string, reason: string): Promise<unknown> {
  return apiPost<unknown>(
    `${REFERRALS}/${encodeURIComponent(id)}/cancel`,
    { reason },
    { errorMessage: "Failed to cancel the referral" }
  );
}

/* A member's benefits ----------------------------------------------------- */

export type FirstTransactionStatus = {
  programActive: boolean;
  eligible: boolean;
  used: boolean;
  usedAt?: string | null;
  usedOnPaymentId?: string | null;
  usedOnInvoiceNo?: string | null;
  usedAmount?: number | null;
  discountType: DiscountType | string;
  amount: number;
  minimumTransaction: number;
  maximumDiscount?: number | null;
  endDate?: string | null;
  paymentCategories: number[];
  branchIds: string[];
  message: string;
};

export type MemberBenefits = {
  memberId: string;
  firstTransactionDiscount: FirstTransactionStatus;
  referralCode?: string | null;
  referredBy?: Referral | null;
  successfulReferrals: number;
};

export function getMemberBenefits(
  memberId: string,
  options?: RequestOptions
): Promise<MemberBenefits> {
  return apiGet<MemberBenefits>(`${BENEFITS}/members/${encodeURIComponent(memberId)}`, {
    errorMessage: "Failed to load the member's benefits",
    ...options,
  });
}
