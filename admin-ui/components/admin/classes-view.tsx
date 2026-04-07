"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CreateClassModal,
  type ClassFormValues,
} from "@/components/admin/create-class-modal";

type ApiClass = {
  id: string;
  className: string;
  coachId: string;
  coachName?: string | null;
  classDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount?: number;
  remainingSlots?: number;
  branchName?: string | null;
  roomName?: string | null;
  description?: string | null;
  isActive: boolean;
};

type ApiCoach = {
  id: string;
  fullName?: string | null;
  name?: string | null;
};

export function ClassesView() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [classes, setClasses] = useState<ApiClass[]>([]);
  const [selected, setSelected] = useState<ApiClass | null>(null);
  const [trainers, setTrainers] = useState<Array<{ id: string; name: string }>>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadClasses = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/classes", { cache: "no-store" });
    const payload = (await res.json().catch(() => [])) as ApiClass[] | { message?: string };
    if (!res.ok) {
      const msg =
        typeof payload === "object" && !Array.isArray(payload)
          ? payload.message
          : "Gagal mengambil class schedule";
      setError(msg || "Gagal mengambil class schedule");
      setLoading(false);
      return;
    }
    setClasses(Array.isArray(payload) ? payload : []);
    setLoading(false);
  }, []);

  const loadCoaches = useCallback(async () => {
    const res = await fetch("/api/coaches", { cache: "no-store" });
    const payload = (await res.json().catch(() => [])) as ApiCoach[];
    if (!res.ok || !Array.isArray(payload)) {
      setTrainers([]);
      return;
    }
    setTrainers(
      payload.map((c) => ({
        id: c.id,
        name: c.fullName || c.name || c.id,
      }))
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadClasses();
    void loadCoaches();
  }, [loadClasses, loadCoaches]);

  const mappedRows = useMemo(() => {
    return classes.map((c) => {
      const enrolled =
        c.bookedCount ?? Math.max(0, c.capacity - (c.remainingSlots ?? c.capacity));
      const time = c.startTime?.slice(0, 5) || "-";
      const trainer = c.coachName || c.coachId;
      const location = c.branchName || "-";
      return { ...c, enrolled, time, trainer, location };
    });
  }, [classes]);

  async function createClass(values: ClassFormValues) {
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      throw new Error(payload.message || "Create class gagal");
    }
    await loadClasses();
  }

  async function updateClass(values: ClassFormValues) {
    if (!selected) return;
    const enrolled =
      selected.bookedCount ??
      Math.max(0, selected.capacity - (selected.remainingSlots ?? selected.capacity));
    const body = {
      ...values,
      bookedCount: enrolled,
      remainingSlots: Math.max(0, values.capacity - enrolled),
    };
    const res = await fetch(`/api/classes/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      throw new Error(payload.message || "Update class gagal");
    }
    await loadClasses();
  }

  async function deleteClass(id: string) {
    const yes = window.confirm("Delete this class schedule?");
    if (!yes) return;
    const res = await fetch(`/api/classes/${id}`, { method: "DELETE" });
    const payload = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      window.alert(payload.message || "Delete class gagal");
      return;
    }
    await loadClasses();
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <div className="flex gap-4">
            <input
              type="date"
              className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-sweat"
            />
            <select className="bg-sidebar border border-border text-white px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-sweat">
              <option>All Locations</option>
              <option>Puri Indah</option>
              <option>PIK Avenue</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="bg-sweat text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-yellow-400 transition flex items-center gap-2"
           >
            <i className="fas fa-plus" aria-hidden />
            Create New Class
          </button>
        </div>
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-sidebar text-xs uppercase font-bold text-gray-500">
            <tr>
              <th className="px-6 py-4">Time</th>
              <th className="px-6 py-4">Class Name</th>
              <th className="px-6 py-4">Trainer</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Capacity</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td className="px-6 py-6 text-gray-400" colSpan={6}>
                  Loading...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td className="px-6 py-6 text-red-400" colSpan={6}>
                  {error}
                </td>
              </tr>
            ) : mappedRows.length === 0 ? (
              <tr>
                <td className="px-6 py-6 text-gray-400" colSpan={6}>
                  Belum ada data class.
                </td>
              </tr>
            ) : (
              mappedRows.map((c) => {
                const pct = c.capacity > 0 ? (c.enrolled / c.capacity) * 100 : 0;
              return (
                <tr key={c.id} className="table-row transition">
                  <td className="px-6 py-4 font-bold text-white">{c.time}</td>
                  <td className="px-6 py-4 font-medium text-white">{c.className}</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-gray-700 shrink-0" />
                      {c.trainer}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-300">
                      {c.location}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="bg-gray-700 h-2 rounded-full overflow-hidden w-24">
                      <div
                        className="bg-sweat h-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs mt-1 block">
                      {c.enrolled} / {c.capacity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      className="text-gray-400 hover:text-white mx-1"
                      aria-label="Edit"
                      onClick={() => {
                        setSelected(c);
                        setEditOpen(true);
                      }}
                    >
                      <i className="fas fa-edit" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="text-red-500 hover:text-red-400 mx-1"
                      aria-label="Delete"
                      onClick={() => void deleteClass(c.id)}
                    >
                      <i className="fas fa-trash" aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>

      <CreateClassModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        trainerOptions={trainers}
        onSubmit={createClass}
      />
      <CreateClassModal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        title="Edit Class"
        submitLabel="Save Changes"
        trainerOptions={trainers}
        initialValues={
          selected
            ? {
                className: selected.className,
                coachId: selected.coachId,
                classDate: selected.classDate,
                startTime: selected.startTime,
                endTime: selected.endTime,
                capacity: selected.capacity,
                branchName: selected.branchName || "",
                roomName: selected.roomName || "",
                description: selected.description || "",
              }
            : undefined
        }
        onSubmit={updateClass}
      />
    </>
  );
}
