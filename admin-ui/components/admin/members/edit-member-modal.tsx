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
        fullName: form.fullName || null,
        phoneNumber: form.phoneNumber || null,
        gender: form.gender || null,
        dateOfBirth: dateToIso(form.dateOfBirth),
        emergencyContactName: form.emergencyContactName || null,
        emergencyContactPhone: form.emergencyContactPhone || null,
        membershipSource: form.membershipSource || null,
        remainingCredits: parseIntSafe(form.remainingCredits),
        remainingPtSessions: parseIntSafe(form.remainingPtSessions),
        expiryDate: dateToIso(form.expiryDate),
        homeClubBranchId: form.homeClubBranchId || null,
        address: form.address || null,
        city: form.city || null,
        heightCm: parseIntSafe(form.heightCm),
        weightKg: parseIntSafe(form.weightKg),
        profileImageUrl: form.profileImageUrl || null,
        notes: form.notes || null,
        isWaiverSigned: form.isWaiverSigned,
        isPtMember: form.isPtMember,
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
