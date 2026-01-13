"use client";

import { UiSubtask } from "../types/subtask";
import { motion } from "framer-motion";
import { useState } from "react";

interface Props {
  subtask: UiSubtask;
  onChange: (updated: UiSubtask) => void;
  onDelete: () => void;
}

export default function SubtaskCard({ subtask, onChange, onDelete }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      className={`rounded-2xl border bg-white p-4 space-y-3 transition
        ${focused ? "border-gray-900 shadow-sm" : "border-gray-200"}
      `}
    >
      {/* Title */}
      <input
        value={subtask.title}
        placeholder="Subtask title"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) =>
          onChange({ ...subtask, title: e.target.value })
        }
        className="w-full text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none"
      />

      {/* Description */}
      <textarea
        value={subtask.description}
        placeholder="Details"
        rows={2}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) =>
          onChange({ ...subtask, description: e.target.value })
        }
        className="w-full resize-none text-sm text-gray-600 placeholder-gray-400 focus:outline-none"
      />

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <input
          type="number"
          min={0}
          value={subtask.estimateMinutes}
          onChange={(e) =>
            onChange({
              ...subtask,
              estimateMinutes: Number(e.target.value),
            })
          }
          className="w-20 text-xs text-gray-600 border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:border-gray-900"
        />

        <button
          onClick={onDelete}
          className="text-xs text-gray-400 hover:text-red-500 transition"
        >
          Delete
        </button>
      </div>
    </motion.div>
  );
}
