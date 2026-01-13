"use client"

import { UiSubtask } from "../types/subtask"
import { motion } from "framer-motion"

interface Props {
  subtask: UiSubtask
  onChange: (updated: UiSubtask) => void
  onDelete: () => void
}

export default function SubtaskCard({ subtask, onChange, onDelete }: Props) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3 shadow-sm"
    >
      <input
        className="w-full bg-white border rounded-md px-3 py-2 text-sm"
        value={subtask.title}
        onChange={e =>
          onChange({ ...subtask, title: e.target.value })
        }
      />

      <textarea
        className="w-full bg-white border rounded-md px-3 py-2 text-sm resize-none"
        rows={3}
        value={subtask.description}
        onChange={e =>
          onChange({ ...subtask, description: e.target.value })
        }
      />

      <div className="flex justify-between items-center">
        <input
          type="number"
          className="w-20 bg-white border rounded-md px-2 py-1 text-sm"
          value={subtask.estimateMinutes}
          onChange={e =>
            onChange({
              ...subtask,
              estimateMinutes: Number(e.target.value),
            })
          }
        />

        <button
          onClick={onDelete}
          className="text-xs text-red-500 font-medium"
        >
          Delete
        </button>
      </div>
    </motion.div>
  )
}
