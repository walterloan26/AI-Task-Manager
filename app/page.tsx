"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import SubtaskCard from "./components/subtaskCard";
import { PersistedSubtask, UiSubtask } from "./types/subtask";
import { useAutosaveSubtasks } from "./hooks/useAutosaveSubtasks";
import ConfirmModal from "./components/ConfirmModal";

export default function HomePage() {
  /* ----------------------------- State ----------------------------- */
  const [taskInput, setTaskInput] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [subtasks, setSubtasks] = useState<UiSubtask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingSubtaskId, setSavingSubtaskId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [filter, setFilter] = useState<{ completed?: boolean; priority?: "Low" | "Medium" | "High" }>({});
  const [sort, setSort] = useState<"priority" | "completed" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const userEditedRef = useRef(false);

  const isBaseView =
    filter.completed === undefined &&
    filter.priority === undefined &&
    sort === null;

  /* ------------------------- Transformers -------------------------- */
  const toUi = useCallback(
    (items: PersistedSubtask[]): UiSubtask[] =>
      items.map((s) => ({
        ...s,
        _uiId: crypto.randomUUID(),
        completed: s.completed ?? false,
        priority: s.priority ?? "Medium",
        orderIndex: s.orderIndex, // ← ENSURE THIS EXISTS
      })),
    []
  );

  const toPersisted = (items: UiSubtask[]) =>
    items.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      estimateMinutes: s.estimateMinutes,
      completed: s.completed,
      priority: s.priority ?? "Medium",
      orderIndex: s.orderIndex,
  }));


  /* --------------------------- Fetching ---------------------------- */
  useEffect(() => {
    fetch("/api/subtasks/breakdown")
      .then((res) => res.json())
      .then((data) => setTasks(data.tasks));
  }, []);

  /* --------------------------- Autosave Hook ------------------------ */
  const { saving, hasPendingChanges, saveError, retrySave } = useAutosaveSubtasks({
    activeTaskId,
    subtasks,
    toPersisted,
    onServerUpdate: (updatedTask) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
      );
    },
    userEditedRef,
    onSubtaskSaved: () => setSavingSubtaskId(null),
    onRollback: (items) => {
    setSubtasks(items);
  },

  });

  /* ------------------------ Subtask Actions ------------------------ */
  const updateSubtask = (updated: UiSubtask) => {
    userEditedRef.current = true;
    setSubtasks((prev) =>
      prev.map((s) => (s._uiId === updated._uiId ? updated : s))
    );
    setSavingSubtaskId(updated._uiId);
  };

  const deleteSubtask = (id: string) => {
    userEditedRef.current = true;
    setSubtasks((prev) => prev.filter((s) => s._uiId !== id));
  };

  const addSubtask = () => {
    if (!activeTaskId) return;
    userEditedRef.current = true;
    const newSubtask: UiSubtask = {
      _uiId: crypto.randomUUID(),
      title: "",
      description: "",
      estimateMinutes: 0,
      completed: false,
      priority: "Medium",
      orderIndex: subtasks.length, // ← ADD THIS
    };
    setSubtasks((prev) => [...prev, newSubtask]);
  };

  /* -------------------------- Task Flow ---------------------------- */
  const handleBreakdown = async () => {
    setLoading(true);
    const res = await fetch("/api/subtasks/breakdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: taskInput }),
    });
    const data = await res.json();
    setTasks((prev) => [data, ...prev]);
    setActiveTaskId(data.id);
    userEditedRef.current = false;
    setSubtasks(toUi(data.subtasks));
    setTaskInput("");
    setLoading(false);
  };

  const selectTask = (task: any) => {
    setActiveTaskId(task.id);
    setSubtasks(toUi(task.subtasks));
    userEditedRef.current = false;
  };

  /* ------------------------ Save Status --------------------------- */
  const saveStatus = (() => {
    if (!activeTaskId) return "idle";
    if (saveError) return "error";
    if (saving || hasPendingChanges) return "saving";
    return "saved";
  })();

  const baseOrderedSubtasks = [...subtasks].sort(
    (a, b) => a.orderIndex - b.orderIndex
  );

  /* ------------------------ Filtering ---------------------------- */
  const filteredSubtasks = baseOrderedSubtasks.filter((s) => {
    if (filter.completed !== undefined && s.completed !== filter.completed) return false;
    if (filter.priority && s.priority !== filter.priority) return false;
    return true;
  });

  // NOTE: sortedSubtasks is visual-only.
  // Never persist orderIndex changes derived from sorting or filtering.

  /* ------------------------ Sorting ------------------------------- */
  const sortedSubtasks = [...filteredSubtasks].sort((a, b) => {
    if (!sort) return 0;
    if (sort === "completed") {
      return sortDirection === "asc"
        ? Number(a.completed) - Number(b.completed)
        : Number(b.completed) - Number(a.completed);
    }
    if (sort === "priority") {
      const priorityValue = { High: 3, Medium: 2, Low: 1 };
      return sortDirection === "asc"
        ? priorityValue[a.priority] - priorityValue[b.priority]
        : priorityValue[b.priority] - priorityValue[a.priority];
    }
    return 0;
  });

  const normalizeOrder = (items: UiSubtask[]): UiSubtask[] =>
    items.map((s, index) => ({
      ...s,
      orderIndex: index,
  }));

  const preserveOrderIndex = (items: UiSubtask[]) =>
  items.map((s) => ({ ...s }));


  /* ----------------------------- UI ------------------------------- */
  return (
    <main className="max-w-md mx-auto px-4 py-10 space-y-8 bg-white">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">AI Task Manager</h1>
        <p className="text-sm text-gray-500">Break down complex work into simple steps</p>
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

      {/* Delete Task Button & Modal */}
      {activeTaskId && (
        <>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center justify-center w-full sm:w-auto px-4 py-2 mt-4 text-sm font-medium text-red-600 border border-red-600 rounded-2xl transition-all hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
          >
            {/* Trash Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Delete Task
          </button>

          <ConfirmModal
            isOpen={showDeleteModal}
            title="Delete Task?"
            description="This task and all its subtasks will be permanently deleted. This action cannot be undone."
            onCancel={() => setShowDeleteModal(false)}
            onConfirm={async () => {
              try {
                const res = await fetch(`/api/subtasks/breakdown?id=${activeTaskId}`, { method: "DELETE" });
                if (!res.ok) throw new Error("Failed to delete task");
                setTasks((prev) => prev.filter((t) => t.id !== activeTaskId));
                setActiveTaskId(null);
                setSubtasks([]);
              } catch (err) {
                console.error(err);
                alert("Failed to delete task");
              } finally {
                setShowDeleteModal(false);
              }
            }}
          />
        </>
      )}

      {/* New Task Input */}
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

      {/* Global Save Status */}
      <AnimatePresence mode="wait">
        {activeTaskId && saveStatus !== "idle" && (
          <motion.div
            key={saveStatus}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className={`text-xs ${saveStatus === "error" ? "text-red-500" : "text-gray-400"}`}
          >
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "error" && (
              <>
                Error saving
                <button 
                  onClick={retrySave}
                  className="underline text-xs ml-1"
                >
                  Retry
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter + Sort Toolbar */}
      {activeTaskId && subtasks.length > 0 && (
        <div className="flex flex-col gap-2 mb-2">
          {/* Status + Priority Filters */}
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs text-gray-500">Show:</span>
            <button
              onClick={() => setFilter({ ...filter, completed: true })}
              className={filter.completed === true ? "bg-gray-900 text-white px-2 py-1 rounded text-xs" : "px-2 py-1 border rounded text-xs"}
            >
              Completed
            </button>
            <button
              onClick={() => setFilter({ ...filter, completed: false })}
              className={filter.completed === false ? "bg-gray-900 text-white px-2 py-1 rounded text-xs" : "px-2 py-1 border rounded text-xs"}
            >
              Incomplete
            </button>
            <button
              onClick={() => setFilter({ ...filter, completed: undefined })}
              className={filter.completed === undefined ? "bg-gray-900 text-white px-2 py-1 rounded text-xs" : "px-2 py-1 border rounded text-xs"}
            >
              All
            </button>

            <select
              value={filter.priority || ""}
              onChange={(e) => setFilter((prev) => ({
                ...prev,
                priority: e.target.value ? (e.target.value as "Low" | "Medium" | "High") : undefined
              }))}
              className="px-2 py-1 border rounded text-xs"
            >
              <option value="">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Sorting */}
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs text-gray-500">Sort by:</span>
            <button
              onClick={() => setSort("completed")}
              className={sort === "completed" ? "bg-gray-900 text-white px-2 py-1 rounded text-xs" : "px-2 py-1 border rounded text-xs"}
            >
              Completion
            </button>
            <button
              onClick={() => setSort("priority")}
              className={sort === "priority" ? "bg-gray-900 text-white px-2 py-1 rounded text-xs" : "px-2 py-1 border rounded text-xs"}
            >
              Priority
            </button>
            <button
              onClick={() => setSort(null)}
              className={sort === null ? "bg-gray-900 text-white px-2 py-1 rounded text-xs" : "px-2 py-1 border rounded text-xs"}
            >
              None
            </button>

            {sort && (
              <button
                onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                className="px-2 py-1 border rounded text-xs"
              >
                {sortDirection === "asc" ? "↑" : "↓"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Subtasks */}
      <section className="space-y-3">
        <Reorder.Group
          axis="y"
          values={sortedSubtasks}
          dragListener={!saving && isBaseView}
          onReorder={(newOrder) => {
            if (!isBaseView) return;

            userEditedRef.current = true;

            const baseIds = new Set(baseOrderedSubtasks.map(s => s._uiId));

            const reordered = newOrder.filter(s => baseIds.has(s._uiId));

            const normalized = normalizeOrder(reordered);

            setSubtasks(normalized);
          }}
        >
          {sortedSubtasks.map((s) => (
            <Reorder.Item 
              key={s._uiId} 
              value={s} 
              dragListener={isBaseView && !saving} 
              className={
                isBaseView && !saving 
                ? "cursor-grab active:cursor-grabbing" 
                : "cursor-not-allowed opacity-70"}>
              <SubtaskCard
                subtask={s}
                onChange={updateSubtask}
                onDelete={() => deleteSubtask(s._uiId)}
                saving={s._uiId === savingSubtaskId}
                disabled={saving}
              />
            </Reorder.Item>
          ))}
        </Reorder.Group>

        {activeTaskId && isBaseView && (
          <button
            onClick={addSubtask}
            disabled={saving}
            className={`w-full text-left text-sm 
              ${saving 
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-600 hover:text-gray-900"
            }` }
          >
            + Add Subtask
          </button>
        )}
        {activeTaskId && !isBaseView && (
          <p className="text-xs text-gray-400 italic">
            Clear filters and sorting to add a new subtask
          </p>
        )}

      </section>
    </main>
  );
}
