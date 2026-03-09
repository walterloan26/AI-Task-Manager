"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import { PersistedSubtask, UiSubtask, Priority } from "./types/subtask";
import { useAutosaveSubtasks } from "./hooks/useAutosaveSubtasks";
import ConfirmModal from "./components/ConfirmModal";
import { useOnlineStatus } from "./hooks/onlineStatus";
import { useOfflineOrderQueue } from "./hooks/useOfflineOrderQueue";
import ReorderableSubtaskItem from "./hooks/reorderableSubtaskItem";
import SkeletonSubtaskCard from "./components/SkeletonSubtaskCard";
import SkeletonTaskList from "./components/SkeletonTaskList";
import ThemeToggle from "./components/ThemeToggle";
import { nanoid } from "nanoid";
import { clientEvents } from '@/lib/events/clientEvents';

type TaskBoardProps = {
  userId: string;
  userEmail: string;
};

type FilterState = {
  completed?: boolean;
  priority?: Priority;
};

type SortState = "priority" | "completed" | null;

export default function TaskBoard({ userId, userEmail }: TaskBoardProps) {
  /* ----------------------------- State ----------------------------- */
  const [taskInput, setTaskInput] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [subtasks, setSubtasks] = useState<UiSubtask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [savingSubtaskId, setSavingSubtaskId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<any>(null);
  const [filter, setFilter] = useState<FilterState>({});
  const [sort, setSort] = useState<SortState>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [shouldHighlight, setShouldHighlight] = useState(false);
  
  /* ----------------------------- Refs ------------------------------ */
  const userEditedRef = useRef(false);
  const subtasksSectionRef = useRef<HTMLDivElement>(null);
  const isReorderingRef = useRef(false);
  const stableIdMap = useRef(new Map<string, string>());

  /* -------------------------- Connectivity -------------------------- */
  const online = useOnlineStatus();
  const { enqueue } = useOfflineOrderQueue(online);

  /* ------------------------- Helper Functions ----------------------- */
  const calculateTaskPriorityFromSubtasks = (subtasks: UiSubtask[]): Priority => {
    if (subtasks.length === 0) return "MEDIUM";
    
    const priorities = subtasks.map(s => s.priority);
    
    if (priorities.includes("HIGH")) return "HIGH";
    if (priorities.includes("MEDIUM")) return "MEDIUM";
    return "LOW";
  };

  const normalizePriority = (priority: unknown): Priority => {
    if (!priority) return "MEDIUM";
    
    const priorityStr = String(priority).toUpperCase().trim();
    if (priorityStr === "HIGH" || priorityStr === "MEDIUM" || priorityStr === "LOW") {
      return priorityStr;
    }
    return "MEDIUM";
  };

  const hasMeaningfulChange = (current: UiSubtask, updated: UiSubtask): boolean => {
    if (current.priority !== updated.priority) return true;
    if (current.title !== updated.title) return true;
    if (current.description !== updated.description) return true;
    if (current.completed !== updated.completed) return true;
    if (current.estimateMinutes !== updated.estimateMinutes) return true;
    return false;
  };

  const normalizeOrder = (items: UiSubtask[]) => 
    items.map((s, i) => ({ ...s, orderIndex: i }));

  const emitTaskChange = (taskId?: string) => {
    clientEvents.emit("tasks:changed", {
      taskId: taskId || activeTaskId,
      timestamp: Date.now()
    });
  };

  /* ------------------------- Transformers -------------------------- */
  const toUi = useCallback(
    (items: PersistedSubtask[] | undefined | null): UiSubtask[] => {
      return (items || []).map((s, index) => {
        let uiId = stableIdMap.current.get(s.id);
        
        if (!uiId) {
          uiId = crypto.randomUUID();
          stableIdMap.current.set(s.id, uiId);
        }
          
        return {
          ...s,
          _uiId: uiId,
          completed: s.completed ?? false,
          priority: normalizePriority(s.priority),
          orderIndex: s.orderIndex ?? index,
          estimateMinutes: s.estimateMinutes > 0 ? s.estimateMinutes : 1,
        };
      });
    },
    []
  );

  const toPersisted = (items: UiSubtask[]) =>
    items.map((s) => ({
      id: s.id,
      title: s.title || "",
      description: s.description || "",
      estimateMinutes: s.estimateMinutes > 0 ? s.estimateMinutes : 1,
      completed: s.completed || false,
      priority: normalizePriority(s.priority),
      orderIndex: s.orderIndex || 0,
    }));

  /* --------------------------- Fetching ---------------------------- */
  useEffect(() => {
    setLoadingTasks(true);
    fetch("/api/subtasks/breakdown")
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const tasksWithSubtasks = (data.tasks || data.data || []).map((task: any) => ({
          ...task,
          subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
          priority: task.priority || calculateTaskPriorityFromSubtasks(
            (task.subtasks || []).map((s: any) => ({ 
              ...s, 
              priority: normalizePriority(s.priority) 
            }))
          )
        }));

        setTasks(tasksWithSubtasks);
        setLoadingTasks(false);
      })
      .catch((error) => {
        console.error("Failed to fetch tasks:", error);
        setTasks([]);
        setLoadingTasks(false);
      });
  }, []);

  /* --------------------------- Autosave ---------------------------- */
  const { saving, hasPendingChanges, saveError, retrySave } = useAutosaveSubtasks({
    activeTaskId,
    subtasks,
    toPersisted,
    onServerUpdate: (updatedTask) => {
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    },
    userEditedRef,
    isReorderingRef,
    onSubtaskSaved: () => setSavingSubtaskId(null),
    onRollback: (items) => setSubtasks(items),
  });

  const isBaseView = !filter.completed && !filter.priority && !sort;
  const canReorder = true; // Simplified for now

  /* ------------------------ Update Handlers ------------------------ */
  const updateSubtask = (updated: UiSubtask) => {
    const currentSubtask = subtasks.find(s => s._uiId === updated._uiId);
    if (!currentSubtask) return;

    const normalizedPriority = normalizePriority(updated.priority);
    const normalizedUpdated = { ...updated, priority: normalizedPriority };

    setSubtasks(prev => {
      const newSubtasks = prev.map(s => 
        s._uiId === normalizedUpdated._uiId ? normalizedUpdated : s
      );

      const newTaskPriority = calculateTaskPriorityFromSubtasks(newSubtasks);

      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === activeTaskId 
            ? { 
                ...task, 
                priority: newTaskPriority,
                subtasks: newSubtasks.map(s => ({
                  ...s,
                  _uiId: undefined
                }))
              } 
            : task
        )
      );

      return newSubtasks;
    });

    if (hasMeaningfulChange(currentSubtask, normalizedUpdated)) {
      userEditedRef.current = true;
      setSavingSubtaskId(normalizedUpdated._uiId);
      emitTaskChange(activeTaskId);
    }
  };

  const deleteSubtask = (uiId: string) => {
    userEditedRef.current = true;
    
    setSubtasks((prev) => {
      const newSubtasks = normalizeOrder(prev.filter((s) => s._uiId !== uiId));
      const newTaskPriority = calculateTaskPriorityFromSubtasks(newSubtasks);

      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === activeTaskId 
            ? { 
                ...task, 
                priority: newTaskPriority,
                subtasks: newSubtasks.map(s => ({
                  ...s,
                  _uiId: undefined
                }))
              } 
            : task
        )
      );

      return newSubtasks;
    });

    emitTaskChange(activeTaskId);
  };

  const addSubtask = () => {
    if (!activeTaskId) return;
    
    userEditedRef.current = true;
    
    const newSubtask = {
      _uiId: nanoid(),
      title: "",
      description: "",
      estimateMinutes: 30,
      completed: false,
      priority: "MEDIUM" as Priority,
      orderIndex: subtasks.length,
    };

    setSubtasks((prev) => {
      const newSubtasks = [...prev, newSubtask];
      const newTaskPriority = calculateTaskPriorityFromSubtasks(newSubtasks);

      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === activeTaskId 
            ? { ...task, priority: newTaskPriority } 
            : task
        )
      );

      return newSubtasks;
    });

    emitTaskChange(activeTaskId);
  };

  /* ------------------------ Task Deletion ------------------------ */
  const handleDeleteTask = (task: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setTaskToDelete(task);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;

    setDeletingTaskId(taskToDelete.id);

    try {
      const res = await fetch(`/api/subtasks/breakdown?id=${taskToDelete.id}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to delete task: ${res.status} - ${errorText}`);
      }

      setTasks(prev => prev.filter(t => t.id !== taskToDelete.id));
      emitTaskChange(taskToDelete.id);

      if (activeTaskId === taskToDelete.id) {
        setActiveTaskId(null);
        setSubtasks([]);
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete task");
    } finally {
      setTaskToDelete(null);
      setDeletingTaskId(null);
    }
  };

  /* ------------------------ Filters & Sorting ------------------------ */
  const applyFilters = (list: UiSubtask[]) => {
    let filtered = list;
    if (filter.completed !== undefined) {
      filtered = filtered.filter((s) => s.completed === filter.completed);
    }
    if (filter.priority) {
      filtered = filtered.filter((s) => s.priority === filter.priority);
    }
    return filtered;
  };

  const applySort = (list: UiSubtask[]) => {
    if (sort === "completed") {
      return [...list].sort((a, b) =>
        sortDirection === "asc" 
          ? Number(a.completed) - Number(b.completed)
          : Number(b.completed) - Number(a.completed)
      );
    }
    
    if (sort === "priority") {
      const priorityWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return [...list].sort((a, b) =>
        sortDirection === "asc"
          ? priorityWeight[a.priority] - priorityWeight[b.priority]
          : priorityWeight[b.priority] - priorityWeight[a.priority]
      );
    }
    
    return list;
  };

  const visibleSubtasks = applySort(
    applyFilters([...subtasks].sort((a, b) => a.orderIndex - b.orderIndex))
  );

  /* ------------------------ Reorder Handler ------------------------ */
  const handleReorder = (newOrder: UiSubtask[]) => {
    if (!canReorder || !activeTaskId) return;

    isReorderingRef.current = true;

    const withOrder = newOrder.map((s, index) => ({
      ...s,
      orderIndex: index,
    }));

    setSubtasks(withOrder);
    setTasks((prev) =>
      prev.map((t) =>
        t.id !== activeTaskId
          ? t
          : {
              ...t,
              subtasks: withOrder.map((s) => ({
                ...s,
                _uiId: undefined,
              })),
            }
      )
    );

    const payload = withOrder
      .filter(s => s.id)
      .map(s => ({
        id: s.id!,
        orderIndex: s.orderIndex,
      }));

    if (!online) {
      enqueue({
        taskId: activeTaskId,
        updates: payload,
        timestamp: Date.now(),
      });
      isReorderingRef.current = false;
      return;
    }

    fetch("/api/subtasks/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: activeTaskId,
        subtasks: payload,
      }),
    }).finally(() => {
      isReorderingRef.current = false;
      emitTaskChange(activeTaskId);
    });
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
    if (!taskInput.trim()) return;

    setLoading(true);

    try {
      const res = await fetch("/api/subtasks/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: taskInput }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API error ${res.status}: ${errorText}`);
      }

      const response = await res.json();
      const taskData = response.data;

      if (!taskData) {
        throw new Error("No task data returned from API");
      }

      setTasks((prev) => [taskData, ...prev]);
      setActiveTaskId(taskData.id);

      const subtasksArray = Array.isArray(taskData.subtasks) ? taskData.subtasks : [];
      setSubtasks(toUi(subtasksArray));

      setTaskInput("");
      emitTaskChange(taskData.id);
    } catch (error: any) {
      console.error("Breakdown failed:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const selectTask = useCallback((task: any) => {
    if (activeTaskId === task.id) {
      setActiveTaskId(null);
      setSubtasks([]);
      return;
    }

    setActiveTaskId(task.id);

    setTimeout(() => {
      const taskSubtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
      setSubtasks(toUi(taskSubtasks));
      setShouldHighlight(true);

      setTimeout(() => {
        if (subtasksSectionRef.current) {
          const headerOffset = 80;
          const elementPosition = subtasksSectionRef.current.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }

        setTimeout(() => setShouldHighlight(false), 1500);
      }, 50);
    }, 0);
  }, [activeTaskId, toUi]);

  const listToRender = isBaseView ? subtasks : visibleSubtasks;

  /* ----------------------------- UI ------------------------------- */
  return (
    <main className="max-w-md mx-auto px-4 py-10 space-y-8 bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            AI Task Manager
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Break down complex work into simple steps
          </p>
        </div>
        <ThemeToggle />
      </header>

      {/* Task List */}
      {loadingTasks ? (
        <SkeletonTaskList />
      ) : tasks.length > 0 ? (
        <section className="space-y-2">
          {tasks.map((task, index) => (
            <motion.div
              key={task.id || `task-${index}`}
              layout
              className={`group relative rounded-lg border transition ${
                task.id === activeTaskId
                  ? "bg-gray-900 dark:bg-gray-700 border-gray-900 dark:border-gray-600 shadow-lg"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
              }`}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <button
                onClick={() => selectTask(task)}
                aria-pressed={task.id === activeTaskId}
                className={`w-full text-left px-4 py-2 pr-10 rounded-lg text-sm transition ${
                  task.id === activeTaskId
                    ? "text-white"
                    : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {task.task}
              </button>

              <button
                onClick={(e) => handleDeleteTask(task, e)}
                disabled={!!deletingTaskId}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded transition ${
                  task.id === activeTaskId
                    ? "text-white hover:bg-white/20"
                    : "text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                } ${deletingTaskId === task.id ? "opacity-50 cursor-not-allowed" : ""}`}
                aria-label={`Delete task: ${task.task}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </motion.div>
          ))}
        </section>
      ) : null}

      {/* Delete Task Confirmation Modal */}
      <ConfirmModal
        isOpen={!!taskToDelete}
        title="Delete Task?"
        description={`This task "${taskToDelete?.task}" and all its subtasks will be permanently deleted. This action cannot be undone.`}
        onCancel={() => {
          setTaskToDelete(null);
          setDeletingTaskId(null);
        }}
        onConfirm={confirmDeleteTask}
        confirmText="Delete"
        confirmDisabled={!!deletingTaskId}
        showLoadingSpinner={!!deletingTaskId}
        variant="danger"
      />

      {/* Delete Current Task Modal */}
      {activeTaskId && (
        <ConfirmModal
          isOpen={showDeleteModal}
          title="Delete Current Task?"
          description="This task and all its subtasks will be permanently deleted. This action cannot be undone."
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={async () => {
            try {
              const res = await fetch(`/api/subtasks/breakdown?id=${activeTaskId}`, {
                method: "DELETE"
              });
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

      {/* New Task Input */}
      <div className="space-y-2">
        <textarea
          rows={4}
          placeholder="Describe a task you want to break down…"
          className="w-full border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm
                    focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-300
                    focus:border-transparent transition
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                    placeholder-gray-500 dark:placeholder-gray-400"
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          disabled={loading}
        />

        <button
          onClick={handleBreakdown}
          disabled={!taskInput.trim() || loading}
          className={`w-full rounded-lg py-2.5 text-sm font-medium transition-all ${
            !taskInput.trim() || loading
              ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              : "bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600 active:scale-[0.99]"
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Breaking down task…</span>
            </div>
          ) : (
            "Break down task"
          )}
        </button>
      </div>

      {/* AI Breakdown Loading Skeleton */}
      {loading && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse" />
            <div className="space-y-1">
              <div className="h-3 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
              <div className="h-2 w-24 bg-gray-200 dark:bg-gray-500 rounded animate-pulse" />
            </div>
          </div>

          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonSubtaskCard key={i} />
            ))}
          </div>
        </motion.div>
      )}

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
                <button onClick={retrySave} className="underline text-xs">
                  Retry
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters & Sorting */}
      {activeTaskId && subtasks.length > 0 && (
        <div className="flex flex-col gap-2 mb-2">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400">Show:</span>
            {["All", "Completed", "Incomplete"].map((label) => {
              const val = label === "Completed" ? true : label === "Incomplete" ? false : undefined;
              return (
                <button
                  key={label}
                  onClick={() => setFilter({ ...filter, completed: val })}
                  className={`px-2 py-1 rounded text-xs transition ${
                    filter.completed === val
                      ? "bg-gray-900 dark:bg-gray-700 text-white"
                      : "border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
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
                  priority: e.target.value ? (e.target.value as Priority) : undefined,
                }))
              }
              className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-xs
                        focus:outline-none focus:ring-1 focus:ring-gray-900 dark:focus:ring-gray-300
                        bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              <option value="">All Priorities</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400">Sort by:</span>
            {["completed", "priority", "none"].map((label) => (
              <button
                key={label}
                onClick={() => setSort(label === "none" ? null : label as SortState)}
                className={`px-2 py-1 rounded text-xs transition ${
                  sort === label
                    ? "bg-gray-900 dark:bg-gray-700 text-white"
                    : "border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                {label === "completed" ? "Completion" : label === "priority" ? "Priority" : "None"}
              </button>
            ))}
            {sort && (
              <button
                onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-xs
                          text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
              >
                {sortDirection === "asc" ? "↑" : "↓"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Subtasks Section */}
      <motion.section
        ref={subtasksSectionRef}
        className="space-y-3"
        animate={shouldHighlight ? {
          scale: [1, 1.01, 1],
          transition: { duration: 1 }
        } : {}}
      >
        {activeTaskId && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  Viewing subtasks for{" "}
                  <strong className="font-semibold">
                    {tasks.find(t => t.id === activeTaskId)?.task || "Selected Task"}
                  </strong>
                </span>
              </div>
              <button
                onClick={() => {
                  setActiveTaskId(null);
                  setSubtasks([]);
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}

        {activeTaskId && (
          <div className="space-y-3">
            {!isBaseView && (
              <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                <strong>Note:</strong> Clear filters and sorting to reorder subtasks.
              </div>
            )}

            {!online && (
              <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-200 dark:border-amber-800">
                <strong>Offline:</strong> reordering is available and will sync when you’re back online.
              </div>
            )}

            <Reorder.Group
              axis="y"
              values={subtasks}
              onReorder={handleReorder}
              className="space-y-3"
            >
              {subtasks.map((s) => (
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

            {isBaseView && (
              <button
                onClick={addSubtask}
                disabled={saving}
                className={`w-full text-left text-sm transition ${
                  saving
                    ? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
                }`}
              >
                + Add Subtask
              </button>
            )}
          </div>
        )}
      </motion.section>

      {/* Back to Top Button */}
      {activeTaskId && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-gray-900 dark:bg-gray-700 text-white shadow-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
          aria-label="Scroll to top"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
        </motion.button>
      )}
    </main>
  );
}