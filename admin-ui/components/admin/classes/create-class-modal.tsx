"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { API_BASE_URL } from "@/lib/auth/constants";
import { authFetch } from "@/lib/auth/client-fetch";

export type ClassFormValues = {
  className: string;
  coachId: string;
  classDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  branchId: string;
  roomName: string;
  description: string;
  classType: string;
  difficultyLevel: string;
  isActive: boolean;
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

type Branch = {
  id: string;
  branchName: string;
  isActive: boolean;
};

type ClassFormState = {
  className: string;
  coachId: string;
  branchId: string;
  classDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  roomName: string;
  description: string;
  classType: string;
  difficultyLevel: string;
};

function emptyClassForm(): ClassFormState {
  return {
    className: "",
    coachId: "",
    branchId: "",
    classDate: "",
    startTime: "08:00",
    endTime: "09:00",
    capacity: 20,
    roomName: "Main Hall",
    description: "",
    classType: "",
    difficultyLevel: "",
  };
}

// Normalize HH:mm to HH:mm:ss for backend compatibility
function normalizeTime(time: string): string {
  if (!time) return "";
  // If already in HH:mm:ss format, return as-is
  if (time.split(":").length === 3) return time;
  // Append :00 seconds for HH:mm format
  return `${time}:00`;
}

function toIsoDate(value: string) {
  if (!value) return "";
  return new Date(`${value}T00:00:00.000Z`).toISOString();
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
  const [form, setForm] = useState<ClassFormState>(emptyClassForm());
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  // Load branches
  useEffect(() => {
    async function loadBranches() {
      try {
        const res = await authFetch(`${API_BASE_URL}/api/v1/branches`);
        if (res.ok) {
          const data = (await res.json()) as Branch[];
          setBranches(data.filter((b) => b.isActive));
        }
      } catch {
        // silently fail, branches will be empty
      } finally {
        setBranchesLoading(false);
      }
    }
    void loadBranches();
  }, []);
  // Sync form state when initialValues changes (edit mode)
  useEffect(() => {
    if (!open) return;
    if (initialValues) {
      setForm({
        className: initialValues.className ?? "",
        coachId: initialValues.coachId ?? "",
        branchId: initialValues.branchId ?? "",
        classDate: initialValues.classDate
          ? initialValues.classDate.slice(0, 10)
          : "",
        startTime: initialValues.startTime ? initialValues.startTime.slice(0, 5) : "08:00",
        endTime: initialValues.endTime ? initialValues.endTime.slice(0, 5) : "09:00",
        capacity: initialValues.capacity ?? 20,
        roomName: initialValues.roomName ?? "Main Hall",
        description: initialValues.description ?? "",
        classType: initialValues.classType ?? "",
        difficultyLevel: initialValues.difficultyLevel ?? "",
      });
    } else {
      setForm(emptyClassForm());
    }
  }, [open, initialValues]);



  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");
      setSubmitting(true);

      const payload: ClassFormValues = {
        ...form,
        classDate: toIsoDate(form.classDate),
        startTime: normalizeTime(form.startTime),
        endTime: normalizeTime(form.endTime),
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
    [onClose, onSubmit, form]
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
        className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
        id="modal-box"
        role="dialog"
        aria-labelledby="modal-title"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold font-display uppercase" id="modal-title">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
            aria-label="Close"
          >

          </button>
        </div>
        <div id="modal-content">
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Class Name */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">
                  Class Name
                </label>
                <input
                  type="text"
                  className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                  placeholder="e.g. Boxing 101"
                  name="className"
                  value={form.className}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, className: e.target.value }))
                  }
                  required
                />
              </div>

              {/* Trainer + Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    Trainer
                  </label>
                  <select
                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    name="coachId"
                    value={form.coachId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, coachId: e.target.value }))
                    }
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
                    name="capacity"
                    value={form.capacity}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        capacity: Number(e.target.value),
                      }))
                    }
                    min={1}
                    required
                  />
                </div>
              </div>

              {/* Class Date + Start Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    Class Date
                  </label>
                  <input
                    type="date"
                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    style={{ colorScheme: 'dark' }}
                    name="classDate"
                    value={form.classDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, classDate: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    style={{ colorScheme: 'dark' }}
                    name="startTime"
                    value={form.startTime}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startTime: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              {/* End Time + Branch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    style={{ colorScheme: 'dark' }}
                    name="endTime"
                    value={form.endTime}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endTime: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    Branch
                  </label>
                  <select
                    value={form.branchId}
                    onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                    disabled={branchesLoading}
                    className="mt-1 w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sweat disabled:opacity-50"
                  >
                    <option value="">{branchesLoading ? "Memuat branch..." : "Pilih Branch..."}</option>

                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.branchName}
                      </option>

                    ))}
                    {!branchesLoading && branches.length === 0 && (
                      <option value="" disabled>Tidak ada branch aktif</option>
                    )}
                    {!branchesLoading && form.branchId && !branches.find((b) => b.id === form.branchId) && (
                      <option value={form.branchId} disabled>
                        ⚠️ Branch tidak ditemukan (ID: {form.branchId})
                      </option>
                    )}
                  </select>
                </div>



              </div>

              {/* Room */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">
                  Room
                </label>
                <input
                  type="text"
                  className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                  name="roomName"
                  value={form.roomName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, roomName: e.target.value }))
                  }
                  placeholder="Main Hall"
                  required
                />
              </div>

              {/* Class Type + Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    Class Type
                  </label>
                  <select
                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    name="classType"
                    value={form.classType}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, classType: e.target.value }))
                    }
                    required
                  >
                    <option value="" disabled>
                      Select type
                    </option>
                    {[
                      "HIIT",
                      "Boxing",
                      "Yoga",
                      "Dance",
                      "Strength",
                      "Cardio",
                      "Other",
                    ].map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    Difficulty
                  </label>
                  <select
                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    name="difficultyLevel"
                    value={form.difficultyLevel}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        difficultyLevel: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="" disabled>
                      Select difficulty
                    </option>
                    {["Beginner", "Intermediate", "Advanced"].map(
                      (level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">
                  Description
                </label>
                <textarea
                  className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                  name="description"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={3}
                />
              </div>

              {/* Error */}
              {error ? (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
                  {error}
                </p>
              ) : null}

              {/* Submit */}
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
      </div >
    </div >
  );
}