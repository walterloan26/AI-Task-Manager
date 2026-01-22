"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import { PersistedSubtask, UiSubtask } from "./types/subtask";
import { useAutosaveSubtasks } from "./hooks/useAutosaveSubtasks";
import ConfirmModal from "./components/ConfirmModal";
import { useOnlineStatus } from "./hooks/onlineStatus";
import { useOfflineOrderQueue } from "./hooks/useOfflineOrderQueue";
import ReorderableSubtaskItem from "./hooks/reorderableSubtaskItem";

/* ------------------- HomePage ------------------- */
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

  /* -------------------------- Connectivity -------------------------- */
  const online = useOnlineStatus();
  const { enqueue } = useOfflineOrderQueue(online);

  /* ------------------------ Derived Flags --------------------------- */
  const isBaseView = filter.completed === undefined && filter.priority === undefined && sort === null;
  const canReorder = Boolean(activeTaskId) && isBaseView && online;

  /* ------------------------- Transformers -------------------------- */
  const toUi = useCallback(
    (items: PersistedSubtask[]): UiSubtask[] =>
      items.map((s) => ({
        ...s,
        _uiId: crypto.randomUUID(),
        completed: s.completed ?? false,
        priority: s.priority ?? "Medium",
        orderIndex: s.orderIndex,
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

  /* --------------------------- Autosave ---------------------------- */
  const { saving, hasPendingChanges, saveError, retrySave } =
    useAutosaveSubtasks({
      activeTaskId,
      subtasks,
      toPersisted,
      onServerUpdate: (updatedTask) =>
        setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))),
      userEditedRef,
      onSubtaskSaved: () => setSavingSubtaskId(null),
      onRollback: (items) => setSubtasks(items),
    });

  /* ------------------------ Helpers ------------------------------- */
  const normalizeOrder = (items: UiSubtask[]) => items.map((s, i) => ({ ...s, orderIndex: i }));

  const extractOrderDiff = (prev: UiSubtask[], next: UiSubtask[]) => {
    const prevMap = new Map(prev.filter((s) => s.id).map((s) => [s.id!, s.orderIndex]));
    return next
      .filter((s) => s.id && prevMap.get(s.id) !== s.orderIndex)
      .map((s) => ({ id: s.id!, orderIndex: s.orderIndex }));
  };

  const updateSubtask = (updated: UiSubtask) => {
    userEditedRef.current = true;
    setSubtasks((prev) => prev.map((s) => (s._uiId === updated._uiId ? updated : s)));
    setSavingSubtaskId(updated._uiId);
  };

  const deleteSubtask = (uiId: string) => {
    userEditedRef.current = true;
    setSubtasks((prev) => normalizeOrder(prev.filter((s) => s._uiId !== uiId)));
  };

  const addSubtask = () => {
    if (!activeTaskId) return;
    userEditedRef.current = true;
    setSubtasks((prev) => [
      ...prev,
      {
        _uiId: crypto.randomUUID(),
        title: "",
        description: "",
        estimateMinutes: 0,
        completed: false,
        priority: "Medium",
        orderIndex: prev.length,
      },
    ]);
  };

  /* ------------------------ Filters & Sorting ------------------------ */
  const applyFilters = (list: UiSubtask[]) => {
    if (filter.completed !== undefined) list = list.filter((s) => s.completed === filter.completed);
    if (filter.priority) list = list.filter((s) => s.priority === filter.priority);
    return list;
  };

  const applySort = (list: UiSubtask[]) => {
    if (sort === "completed")
      return [...list].sort((a, b) =>
        sortDirection === "asc" ? Number(a.completed) - Number(b.completed) : Number(b.completed) - Number(a.completed)
      );
    if (sort === "priority") {
      const p = { High: 3, Medium: 2, Low: 1 };
      return [...list].sort((a, b) =>
        sortDirection === "asc" ? p[a.priority] - p[b.priority] : p[b.priority] - p[a.priority]
      );
    }
    return list;
  };

  const visibleSubtasks = applySort(applyFilters([...subtasks].sort((a, b) => a.orderIndex - b.orderIndex)));

  /* ------------------------ Reorder Handler ------------------------ */
  const handleReorder = (next: UiSubtask[]) => {
    if (!canReorder || !activeTaskId) return;
    userEditedRef.current = true;
    const normalized = normalizeOrder(next);
    setSubtasks(normalized);
    const diff = extractOrderDiff([...subtasks], normalized);
    if (!diff.length) return;
    if (!online) enqueue({ taskId: activeTaskId, updates: diff, timestamp: Date.now() });
  };

  /* ------------------------ Save Status ---------------------------- */
  const saveStatus = !activeTaskId
    ? "idle"
    : saveError
    ? "error"
    : saving || hasPendingChanges
    ? "saving"
    : "saved";

  /* ------------------------ Task Flow ---------------------------- */
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
    setSubtasks(toUi(data.subtasks));
    userEditedRef.current = false;
    setTaskInput("");
    setLoading(false);
  };

  const selectTask = (task: any) => {
    setActiveTaskId(task.id);
    setSubtasks(toUi(task.subtasks));
    userEditedRef.current = false;
  };

  /* ----------------------------- UI ------------------------------- */
  return (
    <main className="max-w-md mx-auto px-4 py-10 space-y-8 bg-white">
      {/* Header */}
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
                t.id === activeTaskId ? "bg-gray-900 text-white border-gray-900 shadow-sm" : "bg-white border-gray-200 hover:bg-gray-50"
              }`}
            >
              {t.task}
            </button>
          ))}
        </section>
      )}

      {/* Delete Task */}
      {activeTaskId && (
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
      )}

      {!online && activeTaskId && <p className="text-xs text-yellow-600">Offline — editing is available, reordering is disabled</p>}

      {/* New Task Input */}
      <textarea
        rows={4}
        placeholder="Describe a task you want to break down…"
        className="w-full border border-gray-200 rounded-lg p-3 text-sm"
        value={taskInput}
        onChange={(e) => setTaskInput(e.target.value)}
      />
      <button onClick={handleBreakdown} disabled={!taskInput || loading} className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium">
        {loading ? "Thinking…" : "Break down task"}
      </button>

      {/* Save Status */}
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
            {saveStatus === "error" && hasPendingChanges && (
              <div className="flex items-center gap-1">
                <span>Changes not saved</span>
                <button onClick={retrySave} className="underline text-xs">Retry</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters & Sorting Toolbar */}
      {activeTaskId && subtasks.length > 0 && (
        <div className="flex flex-col gap-2 mb-2">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs text-gray-500">Show:</span>
            {["All", "Completed", "Incomplete"].map((label) => {
              const val = label === "Completed" ? true : label === "Incomplete" ? false : undefined;
              return (
                <button
                  key={label}
                  onClick={() => setFilter({ ...filter, completed: val })}
                  className={filter.completed === val ? "bg-gray-900 text-white px-2 py-1 rounded text-xs" : "px-2 py-1 border rounded text-xs"}
                >
                  {label}
                </button>
              );
            })}
            <select
              value={filter.priority || ""}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  priority: e.target.value ? (e.target.value as "Low" | "Medium" | "High") : undefined,
                }))
              }
              className="px-2 py-1 border rounded text-xs"
            >
              <option value="">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs text-gray-500">Sort by:</span>
            {["completed", "priority", "none"].map((label) => (
              <button
                key={label}
                onClick={() => setSort(label === "none" ? null : (label as "completed" | "priority"))}
                className={sort === label ? "bg-gray-900 text-white px-2 py-1 rounded text-xs" : "px-2 py-1 border rounded text-xs"}
              >
                {label === "completed" ? "Completion" : label === "priority" ? "Priority" : "None"}
              </button>
            ))}
            {sort && (
              <button onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")} className="px-2 py-1 border rounded text-xs">
                {sortDirection === "asc" ? "↑" : "↓"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Subtasks */}
      <section className="space-y-3">
        {activeTaskId && !canReorder && isBaseView && (
          <p className="text-xs text-gray-400">Reordering is available only in the base view, while online and not saving.</p>
        )}

        <Reorder.Group axis="y" values={visibleSubtasks} onReorder={handleReorder}>
          {visibleSubtasks.map((s) => (
            <ReorderableSubtaskItem
              key={s._uiId}
              subtask={s}
              canReorder={canReorder}
              onChange={updateSubtask}
              onDelete={() => deleteSubtask(s._uiId)}
              saving={s._uiId === savingSubtaskId}
            />
          ))}
        </Reorder.Group>

        {!canReorder && activeTaskId && (
          <p className="text-xs text-gray-400 italic">Reordering is available only in the base view while online and not saving</p>
        )}

        {activeTaskId && isBaseView && (
          <button
            onClick={addSubtask}
            disabled={saving}
            className={`w-full text-left text-sm ${saving ? "text-gray-400 cursor-not-allowed" : "text-gray-600 hover:text-gray-900"}`}
          >
            + Add Subtask
          </button>
        )}
      </section>
    </main>
  );
}
