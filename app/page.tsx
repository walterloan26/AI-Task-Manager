"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import SubtaskCard from "./components/subtaskCard";
import { PersistedSubtask, UiSubtask } from "./types/subtask";

export default function HomePage() {
  /* ----------------------------- State ----------------------------- */
  const [taskInput, setTaskInput] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [subtasks, setSubtasks] = useState<UiSubtask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ----------------------------- Refs ------------------------------ */
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const hasHydrated = useRef(false);

  /* ------------------------- Transformers -------------------------- */
  const toUi = useCallback(
    (items: PersistedSubtask[]): UiSubtask[] =>
      items.map((s) => ({
        ...s,
        _uiId: crypto.randomUUID(),
        completed: s.completed ?? false,
      })),
    []
  );

  const toPersisted = useCallback(
    (items: UiSubtask[]): PersistedSubtask[] =>
      items.map(({ _uiId, ...rest }) => rest),
    []
  );

  /* --------------------------- Fetching ---------------------------- */
  useEffect(() => {
    fetch("/api/breakdown")
      .then((res) => res.json())
      .then((data) => setTasks(data.tasks));
  }, []);

  /* --------------------------- Persistence ------------------------- */
  const saveSubtasks = useCallback(
    async (items: UiSubtask[]) => {
      if (!activeTaskId) return;

      if (saveTimeout.current) clearTimeout(saveTimeout.current);

      saveTimeout.current = setTimeout(async () => {
        setSaving(true);

        const res = await fetch(`/api/breakdown?id=${activeTaskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subtasks: toPersisted(items) }),
        });

        const updatedTask = await res.json();

        setTasks((prev) =>
          prev.map((t) => (t.id === activeTaskId ? updatedTask : t))
        );

        setSaving(false);
      }, 300);
    },
    [activeTaskId, toPersisted]
  );

  useEffect(() => {
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      return;
    }

    saveSubtasks(subtasks);
  }, [subtasks, saveSubtasks]);

  /* ------------------------ Subtask Actions ------------------------ */
  const updateSubtask = (updated: UiSubtask) => {
    setSubtasks((prev) =>
      prev.map((s) => (s._uiId === updated._uiId ? updated : s))
    );
  };

  const deleteSubtask = (id: string) => {
    setSubtasks((prev) => prev.filter((s) => s._uiId !== id));
  };

  const addSubtask = () => {
    const newSubtask: UiSubtask = {
      _uiId: crypto.randomUUID(),
      title: "",
      description: "",
      estimateMinutes: 0,
      completed: false,
    };

    setSubtasks((prev) => [...prev, newSubtask]);
  };

  /* -------------------------- Task Flow ---------------------------- */
  const handleBreakdown = async () => {
    setLoading(true);

    const res = await fetch("/api/breakdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: taskInput }),
    });

    const data = await res.json();

    setTasks((prev) => [data, ...prev]);
    setActiveTaskId(data.id);
    hasHydrated.current = false;
    setSubtasks(toUi(data.subtasks));
    setTaskInput("");
    setLoading(false);
  };

  const selectTask = (task: any) => {
    hasHydrated.current = false;
    setActiveTaskId(task.id);
    setSubtasks(toUi(task.subtasks));
  };

  /* ----------------------------- UI ------------------------------- */
  return (
    <main className="max-w-md mx-auto px-4 py-10 space-y-8 bg-white">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">AI Task Manager</h1>
        <p className="text-sm text-gray-500">
          Break down complex work into simple steps
        </p>
      </header>

      {/* Task List */}
      {tasks.length > 0 && (
        <section className="space-y-2">
          {tasks.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTask(t)}
              aria-pressed={t.id === activeTaskId}
              className={`w-full text-left px-4 py-2 rounded-lg text-sm border transition ${
                t.id === activeTaskId
                  ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                  : "bg-white border-gray-200 hover:bg-gray-50"
              }`}
            >
              {t.task}
            </button>
          ))}
        </section>
      )}

      {/* New Task */}
      <textarea
        rows={4}
        placeholder="Describe a task you want to break down…"
        className="w-full border border-gray-200 rounded-lg p-3 text-sm"
        value={taskInput}
        onChange={(e) => setTaskInput(e.target.value)}
      />

      <button
        onClick={handleBreakdown}
        disabled={!taskInput || loading}
        className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium"
      >
        {loading ? "Thinking…" : "Break down task"}
      </button>

      {/* Saving indicator */}
      <AnimatePresence mode="wait">
        {activeTaskId && (
          <motion.div
            key={saving ? "saving" : "saved"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-xs text-gray-400"
          >
            {saving ? "Saving…" : "Saved"}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtasks */}
      <section className="space-y-3">
        <Reorder.Group axis="y" values={subtasks} onReorder={setSubtasks}>
          {subtasks.map((s) => (
            <Reorder.Item key={s._uiId} value={s}>
              <SubtaskCard
                subtask={s}
                onChange={updateSubtask}
                onDelete={() => deleteSubtask(s._uiId)}
              />
            </Reorder.Item>
          ))}
        </Reorder.Group>

        <button
          onClick={addSubtask}
          className="w-full text-left text-sm text-gray-600 hover:text-gray-900"
        >
          + Add Subtask
        </button>
      </section>
    </main>
  );
}
