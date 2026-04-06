"use client";

import { useState } from "react";
import { classes } from "@/lib/mock-data";
import { CreateClassModal } from "@/components/admin/create-class-modal";

export function ClassesView() {
  const [modalOpen, setModalOpen] = useState(false);

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
            {classes.map((c) => {
              const pct = (c.enrolled / c.capacity) * 100;
              return (
                <tr key={c.id} className="table-row transition">
                  <td className="px-6 py-4 font-bold text-white">{c.time}</td>
                  <td className="px-6 py-4 font-medium text-white">{c.name}</td>
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
                    >
                      <i className="fas fa-edit" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="text-red-500 hover:text-red-400 mx-1"
                      aria-label="Delete"
                    >
                      <i className="fas fa-trash" aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CreateClassModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
