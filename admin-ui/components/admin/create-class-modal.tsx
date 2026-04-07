"use client";

import { useCallback, useState, type FormEvent } from "react";

export type ClassFormValues = {
  className: string;
  coachId: string;
  classDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  branchName: string;
  roomName: string;
  description: string;
  isActive: boolean;
  bookedCount?: number;
  remainingSlots?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  initialValues?: Partial<ClassFormValues>;
  submitLabel?: string;
  trainerOptions: Array<{ id: string; name: string }>;
  onSubmit: (values: ClassFormValues) => Promise<void>;
};

function toIsoDate(value: string) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toISOString();
}

export function CreateClassModal({
  open,
  onClose,
  title = "Create New Class",
  submitLabel = "Create Schedule",
  initialValues,
  trainerOptions,
  onSubmit,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");
      setSubmitting(true);
      const fd = new FormData(e.currentTarget);
      const payload: ClassFormValues = {
        className: String(fd.get("className") ?? ""),
        coachId: String(fd.get("coachId") ?? ""),
        classDate: toIsoDate(String(fd.get("classDate") ?? "")),
        startTime: String(fd.get("startTime") ?? ""),
        endTime: String(fd.get("endTime") ?? ""),
        capacity: Number(fd.get("capacity") ?? 0),
        branchName: String(fd.get("branchName") ?? ""),
        roomName: String(fd.get("roomName") ?? ""),
        description: String(fd.get("description") ?? ""),
        isActive: true,
      };

      try {
        await onSubmit(payload);
        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to submit";
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [onClose, onSubmit]
  );

  if (!open) return null;

  return (
    <div
      id="modal-overlay"
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-6"
        id="modal-box"
        role="dialog"
        aria-labelledby="modal-title"
      >
        <div className="flex justify-between items-center mb-6">
          <h3
            className="text-xl font-bold font-display uppercase"
            id="modal-title"
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div id="modal-content">
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">
                  Class Name
                </label>
                <input
                  type="text"
                  className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                  placeholder="e.g. Boxing 101"
                  name="className"
                  defaultValue={initialValues?.className ?? ""}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    Trainer
                  </label>
                  <select
                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    name="coachId"
                    defaultValue={initialValues?.coachId ?? ""}
                    required
                  >
                    <option value="" disabled>
                      Select trainer
                    </option>
                    {trainerOptions.map((trainer) => (
                      <option key={trainer.id} value={trainer.id}>
                        {trainer.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    Capacity
                  </label>
                  <input
                    type="number"
                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    defaultValue={initialValues?.capacity ?? 20}
                    name="capacity"
                    min={1}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    Class Date
                  </label>
                  <input
                    type="date"
                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    name="classDate"
                    defaultValue={
                      initialValues?.classDate
                        ? initialValues.classDate.slice(0, 10)
                        : ""
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    Start Time (HH:mm:ss)
                  </label>
                  <input
                    type="text"
                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    name="startTime"
                    defaultValue={initialValues?.startTime ?? "08:00:00"}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    End Time (HH:mm:ss)
                  </label>
                  <input
                    type="text"
                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    name="endTime"
                    defaultValue={initialValues?.endTime ?? "09:00:00"}
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    Branch
                  </label>
                  <input
                    type="text"
                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    name="branchName"
                    defaultValue={initialValues?.branchName ?? "Puri Indah"}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Room</label>
                <input
                  type="text"
                  className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                  name="roomName"
                  defaultValue={initialValues?.roomName ?? "Main Hall"}
                  required
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">
                  Description
                </label>
                <textarea
                  className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                  name="description"
                  defaultValue={initialValues?.description ?? ""}
                />
              </div>
              {error ? (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-sweat text-black font-bold py-3 rounded-lg mt-4 hover:bg-yellow-400 transition disabled:opacity-70"
              >
                {submitting ? "Submitting..." : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
