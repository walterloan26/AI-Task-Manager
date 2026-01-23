"use client";

import { useState } from "react";
import { motion, useDragControls } from "framer-motion";
import { UiSubtask, Priority } from "../types/subtask";
import { useNumberInput } from "../hooks/numberInputs";

interface Props {
  subtask: UiSubtask;
  onChange: (updated: UiSubtask) => void;
  onDelete: () => void;
  saving?: boolean;
  showReorderHandle?: boolean;
  dragControls?: ReturnType<typeof useDragControls>;
}

// Constants for better organization
const PRIORITY_COLORS = {
  Low: "bg-green-100 text-green-800 border-green-200",
  Medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  High: "bg-red-100 text-red-800 border-red-200",
} as const;

const TIME_COLORS = {
  short: "bg-green-50 text-green-700 border-green-200",
  medium: "bg-blue-50 text-blue-700 border-blue-200",
  long: "bg-amber-50 text-amber-700 border-amber-200",
  veryLong: "bg-red-50 text-red-700 border-red-200",
} as const;

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

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h${remainingMinutes ? ` ${remainingMinutes}m` : ''}`;
  };

  const getTimeColor = (minutes: number) => {
    if (minutes <= 30) return TIME_COLORS.short;
    if (minutes <= 120) return TIME_COLORS.medium;
    if (minutes <= 240) return TIME_COLORS.long;
    return TIME_COLORS.veryLong;
  };

  const estimateInput = useNumberInput(
    subtask.estimateMinutes,
    (value) => update({ estimateMinutes: value })
  );

  /* ------------------------ Event Handlers ------------------------- */
  const handleMouseEnter = () => setFocused(true);
  const handleMouseLeave = () => {
    if (!confirmDelete) {
      setFocused(false);
    }
  };

  const handleDeleteClick = () => {
    setConfirmDelete(true);
    setFocused(true); // Keep card focused during delete confirmation
  };

  const handleCancelDelete = () => {
    setConfirmDelete(false);
    setFocused(false);
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
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      // Removed whileHover scale effect to prevent movement on delete click
    >
      {/* Completion + Title */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={subtask.completed}
          onChange={(e) => update({ completed: e.target.checked })}
          className="w-4 h-4 accent-gray-900 cursor-pointer"
          aria-label={`Mark "${subtask.title}" as ${subtask.completed ? 'incomplete' : 'complete'}`}
        />

        <div className="relative w-full flex items-center gap-2">
          <input
            value={subtask.title}
            placeholder="Subtask title"
            onChange={(e) => update({ title: e.target.value })}
            className={`w-full text-sm font-medium placeholder-gray-400 focus:outline-none bg-transparent ${
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

          {/* Reorder handle */}
          {showReorderHandle && dragControls && (
            <button
              aria-label={`Drag to reorder "${subtask.title}"`}
              onPointerDown={(e) => dragControls.start(e)}
              className="ml-2 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M7 4h2v2H7V4zm4 0h2v2h-2V4zM7 9h2v2H7V9zm4 0h2v2h-2V9zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Priority */}
      <div className="flex items-center gap-2 pt-1">
        <span className={`text-xs px-2 py-1 rounded-full border ${PRIORITY_COLORS[subtask.priority]}`}>
          {subtask.priority}
        </span>
        
        {/* Quick priority change buttons */}
        <div className="flex gap-1">
          {(["Low", "Medium", "High"] as Priority[]).map((p) => (
            <button
              key={p}
              onClick={() => update({ priority: p })}
              className={`w-2 h-2 rounded-full transition-colors ${
                p === subtask.priority 
                  ? PRIORITY_COLORS[p].split(' ')[0] 
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
              aria-label={`Set priority to ${p}`}
              title={`Set priority to ${p}`}
            />
          ))}
        </div>
      </div>

      {/* Description */}
      <textarea
        value={subtask.description}
        placeholder="Add details..."
        rows={2}
        onChange={(e) => update({ description: e.target.value })}
        className="w-full resize-none text-sm text-gray-600 placeholder-gray-400 focus:outline-none bg-transparent border-0 focus:ring-0"
      />

      {/* Divider line between description and footer */}
      <div className="border-t border-gray-100 pt-3">
        {/* Footer */}
        <div className="flex items-center justify-between">
          {/* Time Input Section */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={estimateInput.stringValue}
              onChange={estimateInput.handleChange}
              onBlur={estimateInput.handleBlur}
              className="w-16 text-xs border rounded-lg px-2 py-1.5 text-gray-700 border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="0"
              aria-label={`Time estimate in minutes for ${subtask.title}`}
            />
          
            {/* Time Display Badge */}
            <span className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${getTimeColor(subtask.estimateMinutes)}`}>
              {formatTime(subtask.estimateMinutes)}
            </span>
          </div>

          {/* Delete Button Section */}
          <div>
            {!confirmDelete ? (
              <button
                onClick={handleDeleteClick}
                className="group flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 transition-all px-3 py-1.5 rounded-lg hover:bg-red-50 border border-gray-200 hover:border-red-200"
                aria-label={`Delete subtask: ${subtask.title}`}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-50 rounded-lg p-1.5 border border-red-100">
                <span className="text-xs text-red-700 font-medium px-1">Delete?</span>
                <button
                  onClick={onDelete}
                  className="flex items-center gap-1 text-xs font-medium text-red-700 px-2 py-1 rounded-md bg-white hover:bg-red-100 border border-red-200 transition-colors"
                  aria-label="Confirm delete"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Yes
                </button>
                <button
                  onClick={handleCancelDelete}
                  className="text-xs text-gray-600 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
                  aria-label="Cancel delete"
                >
                  No
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}