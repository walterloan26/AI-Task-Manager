"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { UiSubtask } from "../types/subtask";

interface Props {
  subtask: UiSubtask;
  onChange: (updated: UiSubtask) => void;
  onDelete: () => void;
}

export default function SubtaskCard({ subtask, onChange, onDelete }: Props) {
  /* ----------------------------- State ----------------------------- */
  const [focused, setFocused] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* ---------------------------- Helpers ---------------------------- */
  const update = (patch: Partial<UiSubtask>) => {
    onChange({ ...subtask, ...patch });
  };

  /* ------------------------------ UI ------------------------------- */
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      className={`rounded-2xl border bg-white p-4 space-y-3 transition-all ${
        focused ? "border-gray-900 shadow-md" : "border-gray-200"
      }`}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setConfirmDelete(false);
      }}
    >
      {/* Completion + Title */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={subtask.completed}
          onChange={(e) => update({ completed: e.target.checked })}
          className="w-4 h-4 accent-gray-900"
        />

        <input
          value={subtask.title}
          placeholder="Subtask title"
          onChange={(e) => update({ title: e.target.value })}
          className={`w-full text-sm font-medium placeholder-gray-400 focus:outline-none ${
            subtask.completed
              ? "line-through text-gray-400"
              : "text-gray-900"
          }`}
        />
      </div>

      {/* Description */}
      <textarea
        value={subtask.description}
        placeholder="Details"
        rows={2}
        onChange={(e) => update({ description: e.target.value })}
        className="w-full resize-none text-sm text-gray-600 placeholder-gray-400 focus:outline-none"
      />

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <input
          type="number"
          min={0}
          value={subtask.estimateMinutes}
          onChange={(e) => update({ estimateMinutes: Number(e.target.value) })}
          className="w-20 text-xs text-gray-600 border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:border-gray-900"
        />

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-gray-400 hover:text-red-500 transition"
          >
            Delete
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onDelete}
              className="text-xs text-red-600 font-medium"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-gray-400"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
