"use client";

import { useCallback, useState, type FormEvent } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreateClassModal({ open, onClose }: Props) {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitting(true);
      window.alert("Class created successfully! (Simulation)");
      setSubmitting(false);
      onClose();
    },
    [onClose]
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
            Create New Class
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
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    Trainer
                  </label>
                  <select
                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    name="trainer"
                    defaultValue="Coach Raka"
                  >
                    <option>Coach Raka</option>
                    <option>Coach Sarah</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">
                    Capacity
                  </label>
                  <input
                    type="number"
                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    defaultValue={20}
                    name="capacity"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Date</label>
                  <input
                    type="date"
                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    name="date"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Time</label>
                  <input
                    type="time"
                    className="w-full bg-sidebar border border-border text-white px-4 py-3 rounded-lg focus:outline-none focus:border-sweat"
                    name="time"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-sweat text-black font-bold py-3 rounded-lg mt-4 hover:bg-yellow-400 transition disabled:opacity-70"
              >
                Create Schedule
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
