"use client";

import { useState } from "react";
import { motion, useDragControls } from "framer-motion";
import { UiSubtask, Priority } from "../types/subtask";

interface Props {
  subtask: UiSubtask;
  onChange: (updated: UiSubtask) => void;
  onDelete: () => void;
  saving?: boolean; // visual indicator only
  showReorderHandle?: boolean;
  dragControls?: ReturnType<typeof useDragControls>;
}

export default function SubtaskCard({
  subtask,
  onChange,
  onDelete,
  saving,
  showReorderHandle = false,
  dragControls
}: Props) {
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
      whileHover={{ scale: 1.01 }}
    >
      {/* Completion + Title */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={subtask.completed}
          onChange={(e) => update({ completed: e.target.checked })}
          className="w-4 h-4 accent-gray-900"
        />

        <div className="relative w-full flex items-center gap-2">
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

          {/* Saving indicator */}
          {saving && (
            <span className="text-xs text-gray-500 animate-pulse">
              Saving…
            </span>
          )}

          {/* Reorder affordance (visual only) */}
          {showReorderHandle && dragControls && (
            <span
              aria-hidden
              onPointerDown={(e) => dragControls.start(e)}
              className="ml-2 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-400"
            >

              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M7 4h2v2H7V4zm4 0h2v2h-2V4zM7 9h2v2H7V9zm4 0h2v2h-2V9zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
              </svg>
            </span>
          )}
        </div>
      </div>

      {/* Priority */}
      <div className="flex items-center gap-2 pt-1">
        <label className="text-xs text-gray-500">Priority:</label>
        <select
          value={subtask.priority}
          onChange={(e) => update({ priority: e.target.value as Priority })}
          className="text-xs border rounded-md px-2 py-1 text-gray-600 border-gray-200 focus:outline-none focus:border-gray-900"
        >
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
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
          onChange={(e) =>
            update({ estimateMinutes: Number(e.target.value) })
          }
          className="w-20 text-xs border rounded-md px-2 py-1 text-gray-600 border-gray-200 focus:outline-none focus:border-gray-900"
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
