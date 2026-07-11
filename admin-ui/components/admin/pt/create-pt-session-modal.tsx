"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type PtPackage,
  type SelectOption,
  normalizeTime,
  toIsoDateTime,
} from "@/components/admin/pt/pt-types";
import { formatCountInput, parseCountInput } from "@/lib/number-input";

export type PtSessionFormValues = {
  ptPackageId: string;
  memberIds: string[];
  coachId: string;
  branchId: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  trainingType: "Private" | "Group";
  maxParticipants: number;
  notes: string;
};

type FormState = {
  ptPackageId: string;
  memberIds: string[];
  coachId: string;
  branchId: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  trainingType: "Private" | "Group";
  maxParticipants: number;
  notes: string;
};

function emptyForm(): FormState {
  return {
    ptPackageId: "",
    memberIds: [],
    coachId: "",
    branchId: "",
    sessionDate: "",
    startTime: "08:00",
    endTime: "09:00",
    trainingType: "Private",
    maxParticipants: 1,
    notes: "",
  };
}

type Props = {
  packages: PtPackage[];
  coachOptions: SelectOption[];
  branchOptions: SelectOption[];
  memberOptions: SelectOption[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: PtSessionFormValues) => Promise<void>;
};

export function CreatePtSessionModal({
  packages,
  coachOptions,
  branchOptions,
  memberOptions,
  saving,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [error, setError] = useState("");

  // Derive package options from packages prop
  const packageOptions = useMemo(
    () => packages.map((p) => ({ id: p.id, label: p.name })),
    [packages]
  );

  // Derive current package member info
  const packageMemberId = useMemo(() => {
    if (!form.ptPackageId) return null;
    const pkg = packages.find((p) => p.id === form.ptPackageId);
    return pkg?.memberId ?? null;
  }, [form.ptPackageId, packages]);

  const packageMemberName = useMemo(() => {
    if (!form.ptPackageId) return null;
    const pkg = packages.find((p) => p.id === form.ptPackageId);
    return pkg?.memberName ?? null;
  }, [form.ptPackageId, packages]);

  // Auto-populate memberIds from selected package; reset on package or type change
  useEffect(() => {
    if (!packageMemberId) return;
    setForm((f) => ({ ...f, memberIds: [packageMemberId] }));
  }, [packageMemberId, form.trainingType]);

  const filteredMemberOptions = useMemo(() => {
    if (!memberSearch.trim()) return memberOptions;
    const q = memberSearch.toLowerCase();
    return memberOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [memberOptions, memberSearch]);

  function addMember(id: string) {
    setForm((f) => {
      if (f.memberIds.includes(id)) return f;
      return { ...f, memberIds: [...f.memberIds, id] };
    });
    setMemberSearch("");
  }

  function removeMember(id: string) {
    if (id === packageMemberId) return;
    setForm((f) => ({ ...f, memberIds: f.memberIds.filter((m) => m !== id) }));
  }

  const submitDisabled =
    saving ||
    !form.ptPackageId ||
    !form.coachId ||
    !form.branchId ||
    !form.sessionDate ||
    !form.startTime ||
    !form.endTime ||
    !form.notes.trim() ||
    !(form.maxParticipants >= 1);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      if (!packageMemberId) {
        setError("Selected package has no associated member");
        return;
      }
      if (form.trainingType === "Private" && form.memberIds.length !== 1) {
        setError("Private session requires exactly 1 member");
        return;
      }
      if (form.trainingType === "Group" && form.memberIds.length < 1) {
        setError("Group session requires at least 1 member");
        return;
      }
      if (!form.ptPackageId || !form.coachId || !form.branchId || !form.sessionDate) {
        setError("Package, coach, branch, and date are required");
        return;
      }
      if (!form.startTime || !form.endTime) {
        setError("Start time and end time are required");
        return;
      }
      if (!(form.maxParticipants >= 1)) {
        setError("Max participants must be at least 1");
        return;
      }
      if (!form.notes.trim()) {
        setError("Notes are required");
        return;
      }
      try {
        await onSubmit({
          ...form,
          sessionDate: toIsoDateTime(form.sessionDate),
          startTime: normalizeTime(form.startTime),
          endTime: normalizeTime(form.endTime),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit");
      }
    },
    [form, onSubmit, packageMemberId]
  );

  function selectedLabels(): string[] {
    return form.memberIds.map((id) => memberOptions.find((o) => o.id === id)?.label || id);
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold font-display uppercase text-white">Create PT Session</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
            aria-label="Close"
          >
            <i className="fas fa-times" aria-hidden />
          </button>
        </div>

        {error && (
          <div className="mb-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-2 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                PT Package <span className="text-red-400">*</span>
              </label>
              <select
                value={form.ptPackageId}
                onChange={(e) => setForm((f) => ({ ...f, ptPackageId: e.target.value }))}
                className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                required
              >
                <option value="">Pilih package...</option>
                {packageOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                Training Type <span className="text-red-400">*</span>
              </label>
              <select
                value={form.trainingType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    trainingType: e.target.value as "Private" | "Group",
                    maxParticipants:
                      e.target.value === "Private" ? 1 : Math.max(1, f.maxParticipants),
                  }))
                }
                className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                required
              >
                <option value="Private">Private</option>
                <option value="Group">Group</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                Coach <span className="text-red-400">*</span>
              </label>
              <select
                value={form.coachId}
                onChange={(e) => setForm((f) => ({ ...f, coachId: e.target.value }))}
                className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                required
              >
                <option value="">Pilih coach...</option>
                {coachOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                Branch <span className="text-red-400">*</span>
              </label>
              <select
                value={form.branchId}
                onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                required
              >
                <option value="">Pilih branch...</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                Session Date <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.sessionDate}
                onChange={(e) => setForm((f) => ({ ...f, sessionDate: e.target.value }))}
                className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                Start Time <span className="text-red-400">*</span>
              </label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                End Time <span className="text-red-400">*</span>
              </label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                required
              />
            </div>
          </div>

          {form.trainingType === "Group" && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                Max Participants <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatCountInput(form.maxParticipants)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxParticipants: parseCountInput(e.target.value) }))
                }
                className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                required
              />
            </div>
          )}

          {/* Member picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
              {form.trainingType === "Private" ? "Member (1)" : "Members (multiple)"}{" "}
              <span className="text-red-400">*</span>
            </label>

            {/* Selected chips */}
            {form.memberIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {form.memberIds.map((id, idx) => {
                  const isPkgMember = id === packageMemberId;
                  const label = selectedLabels()[idx] + (isPkgMember ? " (Package Member)" : "");
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-2 bg-sweat/15 text-sweat px-3 py-1 rounded-full text-xs font-semibold"
                    >
                      {label}
                      {!isPkgMember && (
                        <button
                          type="button"
                          onClick={() => removeMember(id)}
                          className="hover:text-white"
                          aria-label="Remove member"
                        >
                          <i className="fas fa-times" aria-hidden />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}

            {form.trainingType === "Private" ? (
              form.ptPackageId && !packageMemberId ? (
                <p className="text-xs text-red-400">Selected package has no associated member</p>
              ) : null
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMemberDropdownOpen((o) => !o)}
                  className="w-full bg-sidebar border border-border rounded-lg px-3 py-2 text-left text-sm text-white focus:outline-none focus:border-sweat flex items-center justify-between"
                >
                  <span className="text-gray-400">
                    {form.memberIds.length > 0
                      ? `${form.memberIds.length} member dipilih`
                      : "Tambah member..."}
                  </span>
                  <i className="fas fa-chevron-down w-4 text-gray-400" aria-hidden />
                </button>
                {memberDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-sidebar border border-border rounded-lg shadow-lg overflow-hidden">
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Cari member..."
                      className="w-full bg-card border-b border-border px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                      autoFocus
                    />
                    <div className="max-h-48 overflow-y-auto">
                      {filteredMemberOptions.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
                      ) : (
                        filteredMemberOptions.map((o) => {
                          const selected = form.memberIds.includes(o.id);
                          return (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => addMember(o.id)}
                              className={`w-full px-3 py-2 text-sm text-left cursor-pointer flex items-center justify-between transition-colors ${
                                selected
                                  ? "bg-sweat/10 text-sweat"
                                  : "text-gray-300 hover:bg-white/5"
                              }`}
                            >
                              <span>{o.label}</span>
                              {selected && <i className="fas fa-check w-4 text-sweat" aria-hidden />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
              Notes <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat resize-none"
              rows={3}
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-sidebar border border-border text-gray-300 px-4 py-3 rounded-lg font-semibold hover:bg-sidebar/80 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="flex-1 bg-sweat text-black px-4 py-3 rounded-lg font-semibold hover:bg-yellow-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
