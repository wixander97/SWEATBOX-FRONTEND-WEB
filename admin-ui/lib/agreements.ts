/**
 * The waiver and house rules, as `AgreementDocumentResponse` defines them.
 *
 * Activating a version stands the previous one down on the backend, so exactly
 * one version of each type is current at a time. The admin screen says so
 * rather than letting someone believe two can be live at once.
 */

export const DOCUMENT_TYPES = [
  { value: "Waiver", label: "Waiver" },
  { value: "HouseRules", label: "House Rules" },
] as const;

export type AgreementDocumentType =
  (typeof DOCUMENT_TYPES)[number]["value"];

export function documentTypeLabel(value?: string | null): string {
  if (!value) return "-";
  return (
    DOCUMENT_TYPES.find((type) => type.value === value)?.label ?? value
  );
}

export type AgreementDocument = {
  id: string;
  documentType: string;
  version: string;
  title: string;
  content: string;
  isActive: boolean;
  effectiveFrom: string;
};

export type AgreementDocumentRequest = {
  documentType: string;
  version: string;
  title: string;
  content: string;
  isActive: boolean;
};

/** A member's acceptance record, returned per member. */
export type MemberAgreement = {
  id: string;
  memberId: string;
  documentType: string;
  agreementDocumentId?: string | null;
  documentVersion?: string | null;
  isAccepted: boolean;
  acceptedAt: string;
  signatureImageData?: string | null;
  witnessedByUserId?: string | null;
};
