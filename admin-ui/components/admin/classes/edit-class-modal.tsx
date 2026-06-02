"use client";

import { useCallback, useEffect, useState } from "react";
import { CreateClassModal, type ClassFormValues } from "./create-class-modal";
import { authFetch } from "@/lib/auth/client-fetch";
import { API_BASE_URL } from "@/lib/auth/constants";
import { redirectToLoginIfUnauthorized } from "@/lib/auth/client-guard";
import type { ApiClass } from "./classes.types";

type Props = {
  cls: ApiClass | null;
  open: boolean;
  onClose: () => void;
  trainerOptions: Array<{ id: string; name: string }>;
  onSuccess: () => void;
};

export function EditClassModal({ cls, open, onClose, trainerOptions, onSuccess }: Props) {
  const handleSubmit = useCallback(
    async (values: ClassFormValues) => {
      if (!cls) return;
      const res = await authFetch(`${API_BASE_URL}/api/v1/class-schedules/${cls.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (redirectToLoginIfUnauthorized(res.status)) return;
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        throw new Error(payload.message || "Update class gagal");
      }
      onSuccess();
    },
    [cls, onSuccess]
  );

  const initialValues = cls
    ? {
      className: cls.className,
      coachId: cls.coachId,
      classDate: cls.classDate,
      startTime: cls.startTime,
      endTime: cls.endTime,
      capacity: cls.capacity,
      branchId: cls.branchId || "",
      roomName: cls.roomName || "",
      description: cls.description || "",
      classType: cls.classType || "",
      difficultyLevel: cls.difficultyLevel || "",
    }
    : undefined;

  return (
    <CreateClassModal
      open={open}
      onClose={onClose}
      title="Edit Class"
      submitLabel="Save Changes"
      initialValues={initialValues}
      trainerOptions={trainerOptions}
      onSubmit={handleSubmit}
    />
  );
}