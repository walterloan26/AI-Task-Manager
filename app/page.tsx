"use client"

import { useState } from "react";
import { Subtask } from "./types/subtask";
import SubtaskCard from "./components/subtaskCard";
import Image from "next/image";
import { POST } from "./api/breakdown/route";

const MOCK_SUBTASKS: Subtask [] = [
  {
    title: "Collect sales data",
    description: 
      "Export sales data from the POS system for the selected period.",
    estimateMinutes: 30,
  },
  {
    title: "Clean and validate data",
    description: 
      "Remove duplicates and verify totals match daily reports.",
    estimateMinutes: 20,
  },
  {
    title: "Create summary tables",
    description:
      "Generate tables for revenue, product categories, and trends.",
    estimateMinutes: 25,
  },
  {
    title: "Prepare presentation",
    description:
      "Create slides summarizing key findings and insights.",
    estimateMinutes: 15,
  }
]
export default function HomePage() {
  const [task, setTask] = useState("")
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [loading, setLoading] = useState(false)

  const handleBreakdown = async () => {
    setLoading(true)
    setSubtasks([])

    try {
      const res = await fetch("./api/breakdown", {
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
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">
        AI Task Breakdown
      </h1>
      <textarea
        className="w-full border p-3 rounded"
        rows={4}
        placeholder="Describe a task you want to break down..."
        value={task}
        onChange={(e) => setTask(e.target.value)}
      />
      <button
        className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
        disabled={!task || loading}
        onClick={handleBreakdown}
      >
        {loading ? "Breaking down..." : "Break down with AI"}
      </button>
      {subtasks.length > 0 && (
        <div className="space-y-4">
          {subtasks.map((subtask, index) => (
            <SubtaskCard
              key={index}
              subtask={subtask}
              onChange={(updated) =>
                updateSubtask(index, updated)
              }
              onDelete={() => deleteSubtask(index)}
            />
          ))}
        </div>
      )}
    </main>
  )
}
// export default function Home() {
//   return (
//     <main className="p-6">
//       <h1 className="text-2x1 font-bold">
//         AI Task Manager
//       </h1>
//       <p className="mt-2 text-gray-600">
//         First full-stack refresh project
//       </p>
//     </main>
//   )
// }