"use client";

import { useCallback, useEffect, useState } from "react";

import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import { CreateMemberModal } from "@/components/admin/members/create-member-modal";
import {
  type ApiMember,
  type Branch,
  type MemberFormState,
  type MembershipPlan,
  dateToIso,
  dateTimeToIso,
  memberToForm,
  parseIntSafe,
} from "@/components/admin/members/members.types";

type Props = {
  member: ApiMember;
  branches: Branch[];
  branchesLoading: boolean;
  membershipPlans: MembershipPlan[];
  membershipPlansLoading: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function EditMemberModal({
  member,
  branches,
  branchesLoading,
  membershipPlans,
  membershipPlansLoading,
  onClose,
  onSuccess,
}: Props) {
  const [initialValues, setInitialValues] = useState<Partial<MemberFormState>>(
    memberToForm(member)
  );

  // Prefetch full member detail to hydrate the form accurately.
  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      const res = await authFetch(`${API_BASE_URL}/api/v1/members/${member.id}`, {
        cache: "no-store",
      });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as ApiMember | null;
        if (data && !cancelled) {
          setInitialValues(memberToForm(data));
        }
      }
    }
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [member.id]);

  const handleSubmit = useCallback(
    async (form: MemberFormState) => {
      const body: Record<string, unknown> = {
        fullName: form.fullName ?? "",
        phoneNumber: form.phoneNumber ?? "",
        gender: form.gender ?? "",
        dateOfBirth: dateToIso(form.dateOfBirth),
        emergencyContactName: form.emergencyContactName ?? "",
        emergencyContactPhone: form.emergencyContactPhone ?? "",
        membershipPlanId: form.membershipPlanId ?? "",
        membershipStatus: form.membershipStatus ?? "",
        paymentStatus: form.paymentStatus ?? "",
        remainingCredits: parseIntSafe(form.remainingCredits),
        remainingPtSessions: parseIntSafe(form.remainingPtSessions),
        expiryDate: dateToIso(form.expiryDate),
        freezeStartDate: dateTimeToIso(form.freezeStartDate),
        freezeEndDate: dateTimeToIso(form.freezeEndDate),
        homeClubBranchId: form.homeClubBranchId ?? "",
        membershipSource: form.membershipSource ?? "",
        address: form.address ?? "",
        city: form.city ?? "",
        heightCm: parseIntSafe(form.heightCm),
        weightKg: parseIntSafe(form.weightKg),
        profileImageUrl: form.profileImageUrl ?? "",
        notes: form.notes ?? "",
        isWaiverSigned: form.isWaiverSigned,
        isPtMember: form.isPtMember,
        isActive: form.isActive,
      };
      const res = await authFetch(`${API_BASE_URL}/api/v1/members/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        throw new Error(data.message ?? "Gagal memperbarui member.");
      }
      onSuccess();
    },
    [member.id, onSuccess]
  );

  return (
    <CreateMemberModal
      title="Edit member"
      submitLabel="Save changes"
      initialValues={initialValues}
      branches={branches}
      branchesLoading={branchesLoading}
      membershipPlans={membershipPlans}
      membershipPlansLoading={membershipPlansLoading}
      onClose={onClose}
      onSubmit={handleSubmit}
    />
  );
}
