"use client"

import { useState } from "react";
import { Subtask } from "./types/subtask";
import SubtaskCard from "./components/subtaskCard";
import Image from "next/image";

export default function HomePage() {
  const [task, setTask] = useState("")
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [loading, setLoading] = useState(false)

  const handleBreakdown = async () => {
    setLoading(true)
    setSubtasks([])

    try {
      const res = await fetch("/api/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      })

      const data = await res.json()
      setSubtasks(data.subtasks)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const updateSubtask = (index: number, updated: Subtask) => {
    const copy = [...subtasks]
    copy[index] = updated
    setSubtasks(copy)
  }
  const deleteSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i!==index))
  }
  return (
    <main className="max-w-md mx-auto px-4 py-5 space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">
        AI Task Breakdown
      </h1>
      <p className="text-sm text-gray-500">
        Turn a task into clear, actionable steps
      </p>
      <textarea
        className="w-full border border-gray-300 rounded-lg p-4 text-base resize-none focus:outline-none focus:ring-2 focus:ring-black"
        rows={5}
        placeholder="Describe a task you want to break down…"
        value={task}
        onChange={(e) => setTask(e.target.value)}
        disabled={loading}
      />
      <button
        className="w-full bg-black text-white py-3 rounded-lg text-base font-medium disabled:opacity-50"
        disabled={!task || loading}
        onClick={handleBreakdown}
      >
        {loading ? "Breaking down…" : "Break down with AI"}
      </button>
      {subtasks.length > 0 && (
        <div className="space-y-3 pt-2">
          {subtasks.map((subtask, index) => (
            <SubtaskCard
              key={index}
              subtask={subtask}
              onChange={(updated) => updateSubtask(index, updated)}
              onDelete={() => deleteSubtask(index)}
            />
          ))}
        </div>
      )}
    </main>
  )
}