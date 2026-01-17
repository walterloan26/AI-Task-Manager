"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { UiSubtask, Priority } from "../types/subtask";

interface Props {
  subtask: UiSubtask;
  onChange: (updated: UiSubtask) => void;
  onDelete: () => void;
  saving?: boolean; // shows saving indicator
  disabled?: boolean
}

export default function SubtaskCard({ subtask, onChange, onDelete, saving, disabled }: Props) {
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
      } ${disabled ? "opacity-60 pointer-events-none" : ""}`}
      onFocus={() => !disabled && setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setConfirmDelete(false);
      }}
      whileHover={
        !disabled
          ? { scale: 1.01 }
          : undefined
      }
    >
      {/* Completion + Title */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          disabled={disabled}
          checked={subtask.completed}
          onChange={(e) => update({ completed: e.target.checked })}
          className="w-4 h-4 accent-gray-900"
        />
        <div className="relative w-full">
          <input
            disabled={disabled}
            value={subtask.title}
            placeholder="Subtask title"
            onChange={(e) => update({ title: e.target.value })}
            className={`w-full text-sm font-medium placeholder-gray-400 focus:outline-none ${
              disabled
                ? "text-gray-400 cursor-not-allowed"
                : subtask.completed
                ? "line-through text-gray-400"
                : "text-gray-900"}
            }`}
          />
          {/* Saving indicator */}
          {saving && (
            <span className="absolute right-0 top-0 text-xs text-gray-500 animate-pulse">
              Saving…
            </span>
          )}
        </div>
      </div>

      {/* Priority */}
      <div className="flex items-center gap-2 pt-1">
        <label className="text-xs text-gray-500">Priority:</label>
        <select
          value={subtask.priority} // use actual value
          disabled={disabled}
          onChange={(e) => update({ priority: e.target.value as Priority })}
          className={`text-xs border rounded-md px-2 py-1 focus:outline-none ${
            disabled
              ? "text-gray-400 border-gray-200 bg-gray-50 cursor-not-allowed"
              : "text-gray-600 border-gray-200 focus:border-gray-900"
          }`}
        >
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
      </div>

      {/* Description */}
      <textarea
        disabled={disabled}
        value={subtask.description}
        placeholder="Details"
        rows={2}
        onChange={(e) => update({ description: e.target.value })}
        className={`w-full resize-none text-sm placeholder-gray-400 focus:outline-none ${
          disabled ? "text-gray-400 bg-gray-50 cursor-not-allowed" : "text-gray-600"
        }`}

      />

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <input
          type="number"
          disabled={disabled}
          min={0}
          value={subtask.estimateMinutes}
          onChange={(e) => update({ estimateMinutes: Number(e.target.value) })}
          className={`w-20 text-xs border rounded-md px-2 py-1 focus:outline-none ${
            disabled
              ? "text-gray-400 border-gray-200 bg-gray-50 cursor-not-allowed"
              : "text-gray-600 border-gray-200 focus:border-gray-900"
          }`}
        />
      
        {!disabled && (
          !confirmDelete ? (
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
          )
        )}
      </div>
    </motion.div>
  );
}
