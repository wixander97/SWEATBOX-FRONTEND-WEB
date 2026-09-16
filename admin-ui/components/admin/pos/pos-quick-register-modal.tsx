"use client";

import { useMemo } from "react";

import { QuickRegisterModal } from "@/components/admin/quick-register-modal";
import {
  findDuplicateMember,
  getMember,
  memberDisplayName,
  type ApiMember,
} from "@/lib/api/members";
import type { Branch } from "@/lib/branches";
import type { RegisteredMember } from "@/lib/member-registration";
import { branchLabel, usePosBranch } from "@/lib/pos/branch-context";

type Props = {
  /** Prefilled from whatever the staff already typed into the customer search. */
  initialQuery?: string;
  onClose: () => void;
  onCreated: (member: ApiMember) => void;
};

/**
 * Front-desk quick registration from the till.
 *
 * The form itself is the portal's `QuickRegisterModal`: every personal field,
 * the waiver, the house rules and a drawn signature, posted to
 * `POST /api/v1/members/register` so a customer can never be created at the
 * desk without the agreements. What this wrapper adds is the till's side of
 * it — the search text carries over, the active POS branch is the default home
 * club, an existing customer is offered instead of a duplicate, and the new
 * member is handed back in the shape the POS customer panel selects.
 */
export function PosQuickRegisterModal({ initialQuery = "", onClose, onCreated }: Props) {
  const { branches, branchId } = usePosBranch();

  const registerBranches = useMemo<Branch[]>(
    () =>
      branches.map((b) => ({
        id: b.id,
        branchName: branchLabel(b),
        isActive: b.isActive !== false,
      })),
    [branches]
  );

  async function checkDuplicate(phoneNumber: string, email: string) {
    let existing: ApiMember | null = null;
    try {
      existing = await findDuplicateMember(phoneNumber, email);
    } catch {
      // The search is a courtesy; the backend still rejects a true duplicate.
      return null;
    }
    if (!existing) return null;

    const found = existing;
    return (
      <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <p className="text-warning text-xs font-bold uppercase">
          Customer already registered
        </p>
        <p className="text-sm text-fg mt-1">{memberDisplayName(found)}</p>
        <p className="text-xs text-fg-soft">
          {found.phoneNumber || "-"} · {found.email || "-"}
        </p>
        <button
          type="button"
          onClick={() => onCreated(found)}
          className="mt-2 w-full bg-sweat text-black py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition"
        >
          Use this customer
        </button>
      </div>
    );
  }

  async function handleRegistered(registered: RegisteredMember) {
    // The register response is deliberately small; the panel wants the full
    // record (credits, plan, expiry), so it is read back before selecting.
    try {
      const member = await getMember(registered.id);
      onCreated(member);
    } catch {
      onCreated({
        id: registered.id,
        userId: registered.userId,
        memberCode: registered.memberCode,
        fullName: registered.fullName,
        email: registered.email,
        phoneNumber: registered.phoneNumber,
        homeClubBranchId: registered.homeClubBranchId ?? null,
        membershipStatus: registered.membershipStatus,
        isWaiverSigned: true,
        isActive: true,
      });
    }
  }

  return (
    <QuickRegisterModal
      open
      onClose={onClose}
      branches={registerBranches}
      defaultBranchId={branchId || null}
      initialQuery={initialQuery}
      checkDuplicate={checkDuplicate}
      submitLabel="Register & Select"
      onRegistered={(member) => void handleRegistered(member)}
    />
  );
}
