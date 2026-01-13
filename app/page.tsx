"use client"

import { useEffect, useRef, useState } from "react"
import SubtaskCard from "./components/subtaskCard"
import { PersistedSubtask, UiSubtask } from "./types/subtask"
import { AnimatePresence, motion } from "framer-motion"

export default function HomePage() {
  const [task, setTask] = useState("")
  const [tasks, setTasks] = useState<any[]>([])
  const [subtasks, setSubtasks] = useState<UiSubtask[]>([])
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const saveTimeout = useRef<NodeJS.Timeout | null>(null)

  // 🔒 FIX 1: prevent autosave on initial hydration / task switch
  const hasHydrated = useRef(false)

  const toUi = (items: PersistedSubtask[]): UiSubtask[] =>
    items.map(s => ({
      ...s,
      _uiId: crypto.randomUUID(),
    }))

  const toPersisted = (items: UiSubtask[]): PersistedSubtask[] =>
    items.map(({ _uiId, ...rest }) => rest)

  // Load tasks on boot
  useEffect(() => {
    fetch("/api/breakdown")
      .then(res => res.json())
      .then(data => setTasks(data.tasks))
  }, [])

  // 🔄 AUTOSAVE — SINGLE SOURCE OF TRUTH
  useEffect(() => {
    if (!activeTaskId) return

    // 🛑 Skip autosave on first hydration
    if (!hasHydrated.current) {
      hasHydrated.current = true
      return
    }

    if (saveTimeout.current) clearTimeout(saveTimeout.current)

    saveTimeout.current = setTimeout(async () => {
      setSaving(true)

      const res = await fetch(`/api/breakdown?id=${activeTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtasks: toPersisted(subtasks),
        }),
      })

      const updatedTask = await res.json()

      // 🔧 FIX 2: keep task list in sync with backend
      setTasks(prev =>
        prev.map(t =>
          t.id === activeTaskId ? updatedTask : t
        )
      )

      setSaving(false)
    }, 500)

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [subtasks, activeTaskId])

  const handleBreakdown = async () => {
    setLoading(true)

    const res = await fetch("/api/breakdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task }),
    })

    const data = await res.json()

    setTasks(prev => [data, ...prev])
    setActiveTaskId(data.id)

    // 🔒 FIX 3: reset hydration on new task load
    hasHydrated.current = false
    setSubtasks(toUi(data.subtasks))

    setTask("")
    setLoading(false)
  }

  return (
    <main className="max-w-md mx-auto px-4 py-10 space-y-8 bg-white">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">
          AI Task Manager
        </h1>
        <p className="text-sm text-gray-500">
          Break down complex work into simple steps
        </p>
      </header>

      {tasks.length > 0 && (
        <section className="space-y-2">
          {tasks.map(t => (
            <button
              key={t.id}
              onClick={() => {
                // 🔒 reset hydration when switching tasks
                hasHydrated.current = false
                setActiveTaskId(t.id)
                setSubtasks(toUi(t.subtasks))
              }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm border transition ${
                t.id === activeTaskId
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white border-gray-200 hover:bg-gray-50"
              }`}
            >
              {t.task}
            </button>
          ))}
        </section>
      )}

      <textarea
        rows={4}
        placeholder="Describe a task you want to break down…"
        className="w-full border border-gray-200 rounded-lg p-3 text-sm"
        value={task}
        onChange={e => setTask(e.target.value)}
      />

      <button
        onClick={handleBreakdown}
        disabled={!task || loading}
        className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium"
      >
        {loading ? "Thinking…" : "Break down task"}
      </button>

      <AnimatePresence>
        {activeTaskId && (
          <motion.p
            key={saving ? "saving" : "saved"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`text-xs ${
              saving ? "text-blue-600" : "text-gray-400"
            }`}
          >
            {saving ? "Saving changes…" : "All changes saved"}
          </motion.p>
        )}
      </AnimatePresence>

      <section className="space-y-4">
        <AnimatePresence>
          {subtasks.map(s => (
            <SubtaskCard
              key={s._uiId}
              subtask={s}
              onChange={updated =>
                setSubtasks(prev =>
                  prev.map(p =>
                    p._uiId === updated._uiId ? updated : p
                  )
                )
              }
              onDelete={() =>
                setSubtasks(prev =>
                  prev.filter(p => p._uiId !== s._uiId)
                )
              }
            />
          ))}
        </AnimatePresence>
      </section>
    </main>
  )
}
