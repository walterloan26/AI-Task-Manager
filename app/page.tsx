"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import { PersistedSubtask, UiSubtask } from "./types/subtask";
import { useAutosaveSubtasks } from "./hooks/useAutosaveSubtasks";
import ConfirmModal from "./components/ConfirmModal";
import { useOnlineStatus } from "./hooks/onlineStatus";
import { useOfflineOrderQueue } from "./hooks/useOfflineOrderQueue";
import ReorderableSubtaskItem from "./hooks/reorderableSubtaskItem";
import SkeletonSubtaskCard from "./components/SkeletonSubtaskCard"; 
import SkeletonTaskList from "./components/SkeletonTaskList"; 
import ThemeToggle from "./components/ThemeToggle";

/* ------------------- HomePage ------------------- */
export default function HomePage() {
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
  const [filter, setFilter] = useState<{ completed?: boolean; priority?: "Low" | "Medium" | "High" }>({});
  const [sort, setSort] = useState<"priority" | "completed" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const userEditedRef = useRef(false);
  const [shouldHighlight, setShouldHighlight] = useState(false);
  const subtasksSectionRef = useRef<HTMLDivElement>(null);
  const isReorderingRef = useRef(false);
  const stableIdMap = useRef(new Map<string, string>());


  /* -------------------------- Connectivity -------------------------- */
  const online = useOnlineStatus();
  const { enqueue } = useOfflineOrderQueue(online);

  /* ------------------------ Derived Flags --------------------------- */
  const isBaseView = filter.completed === undefined && filter.priority === undefined && sort === null;
  const canReorder = Boolean(activeTaskId) && isBaseView && online;

  /* ------------------------- Transformers -------------------------- */
  
 const toUi = useCallback(
  (items: PersistedSubtask[] | undefined | null): UiSubtask[] => {
    console.log("🔄 toUi called with items:", items?.length || 0);
    console.log("📊 stableIdMap size:", stableIdMap.current.size);
    console.log("📊 Items IDs:", items?.map(s => s.id));
    
    return (items || []).map((s, index) => {
      let uiId = stableIdMap.current.get(s.id);
      const hadUiId = !!uiId;
      
      if (!uiId) {
        uiId = crypto.randomUUID();
        stableIdMap.current.set(s.id, uiId);
        console.log(`✨ Created new UI ID for ${s.id}: ${uiId}`);
      } else {
        console.log(`✅ Reusing UI ID for ${s.id}: ${uiId}`);
      }
      
      return {
        ...s,
        _uiId: uiId,
        completed: s.completed ?? false,
        priority: (s.priority?.toUpperCase() || "MEDIUM") as Priority,
        orderIndex: s.orderIndex ?? index,
        estimateMinutes: s.estimateMinutes > 0 ? s.estimateMinutes : 1,
      };
    });
  },
  []
);

  const toPersisted = (items: UiSubtask[]) =>
    items.map((s) => ({
      id: s.id, // Include ID if it exists (for updates)
      title: s.title || "",
      description: s.description || "",
      estimateMinutes: s.estimateMinutes > 0 ? s.estimateMinutes : 1, 
      completed: s.completed || false,
      priority: (s.priority?.toUpperCase() || "MEDIUM") as "HIGH" | "MEDIUM" | "LOW",
      orderIndex: s.orderIndex || 0,
    }));

  /* --------------------------- Fetching ---------------------------- */
  useEffect(() => {
    setLoadingTasks(true);
    fetch("/api/subtasks/breakdown")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        // Fix: Your API returns { success: true, data: [], count: 0 }
        // But your code expects { tasks: [] }
        console.log("API Response:", data); // Debug log
        
        // Ensure tasks have subtasks array
        const tasksWithSubtasks = (data.tasks || data.data || []).map((task: any) => ({
          ...task,
          subtasks: Array.isArray(task.subtasks) ? task.subtasks : []
        }));
      
        setTasks(tasksWithSubtasks);
        setLoadingTasks(false);
      })
      .catch((error) => {
        console.error("Failed to fetch tasks:", error);
        setTasks([]); // Set empty array on error
        setLoadingTasks(false);
      });
  }, []);

  /* --------------------------- Autosave ---------------------------- */
  const { saving, hasPendingChanges, saveError, retrySave } =
    useAutosaveSubtasks({
      activeTaskId,
      subtasks,
      toPersisted,
      onServerUpdate: (updatedTask) =>
        setTasks((prev) =>
          prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
        ),
      userEditedRef,
      isReorderingRef,   
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

  /* ---------------------------- Helpers ---------------------------- */
// Helper function to check if a subtask has meaningful changes
const hasMeaningfulChange = (current: UiSubtask, updated: UiSubtask): boolean => {
  // Note: We compare priority case-insensitively since parent normalizes to uppercase
  if (current.priority.toUpperCase() !== updated.priority.toUpperCase()) return true;
  if (current.title !== updated.title) return true;
  if (current.description !== updated.description) return true;
  if (current.completed !== updated.completed) return true;
  if (current.estimateMinutes !== updated.estimateMinutes) return true;
  return false;
};

/* ------------------------ Update Handler ------------------------ */
const updateSubtask = (updated: UiSubtask) => {
  console.log("🔄 updateSubtask called");
  
  // Find the current subtask
  const currentSubtask = subtasks.find(s => s._uiId === updated._uiId);
  
  if (!currentSubtask) {
    console.error("Subtask not found");
    return;
  }
  
  const normalizedUpdated = {
    ...updated,
    priority: updated.priority.toUpperCase() as Priority,
  };
  
  // Update local state
  setSubtasks((prev) => 
    prev.map((s) => (s._uiId === normalizedUpdated._uiId ? normalizedUpdated : s))
  );
  
  // Only trigger save if something actually changed
  if (hasMeaningfulChange(currentSubtask, normalizedUpdated)) {
    userEditedRef.current = true;
    setSavingSubtaskId(normalizedUpdated._uiId);
    console.log("Changes detected, setting saving state");
  } else {
    console.log("No meaningful changes detected, skipping save");
  }
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
        estimateMinutes: 30,
        completed: false,
        priority: "Medium",
        orderIndex: prev.length,
      },
    ]);
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
    console.log("🔄 handleReorder - Input:", next.map((s, i) => ({
    index: i,
    id: s.id,
    _uiId: s._uiId,
    orderIndex: s.orderIndex,
    title: s.title
  })));
    if (!canReorder || !activeTaskId) return;

    isReorderingRef.current = true;
    // RESET userEditedRef to prevent autosave during reorder
    userEditedRef.current = false;

    setSubtasks((prev) => {
      const normalized = normalizeOrder(next);

      console.log("📊 After normalizeOrder:", normalized.map((s, i) => ({
      index: i,
      id: s.id,
      orderIndex: s.orderIndex,
      title: s.title
    })));
      const diff = extractOrderDiff(prev, normalized);
      console.log("📤 Diff to send:", diff);

      // Check for duplicate orderIndex values
    const orderIndexes = diff.map(d => d.orderIndex);
    const hasDuplicates = new Set(orderIndexes).size !== orderIndexes.length;
    
    if (hasDuplicates) {
      console.error("❌ Duplicate orderIndex values detected:", orderIndexes);
      alert("Error: Duplicate order indexes detected. Please try reordering again.");
      isReorderingRef.current = false;
      return prev;
    }

      if (!diff.length) {
        isReorderingRef.current = false;
        return prev;
      }

      // Persist order (online)
      if (online) {
        fetch("/api/subtasks/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: activeTaskId,
            subtasks: diff,
          }),
        }).catch((err) => {
          console.error("Reorder failed, enqueueing", err);
          enqueue({
            taskId: activeTaskId,
            updates: diff,
            timestamp: Date.now(),
          });
        });
      } else {
        enqueue({
          taskId: activeTaskId,
          updates: diff,
          timestamp: Date.now(),
        });
      }

      return normalized;
    });

    // Release autosave suppression on next tick
    queueMicrotask(() => {
      isReorderingRef.current = false;
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
      
      // Check if response is ok first
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API error ${res.status}: ${errorText}`);
      }
      
      // Parse JSON directly
      const response = await res.json();
      console.log("API Response:", response);
      
      // Extract task data - your API returns { success: true, data: {...} }
      const taskData = response.data;
      
      if (!taskData) {
        throw new Error("No task data returned from API");
      }
      
      console.log("New task created:", {
        id: taskData.id,
        task: taskData.task,
        subtaskCount: taskData.subtasks?.length || 0
      });
      
      // Add to tasks list
      setTasks((prev) => [taskData, ...prev]);
      
      // Select this task
      setActiveTaskId(taskData.id);
      
      // Set subtasks (ensure it's an array)
      const subtasksArray = Array.isArray(taskData.subtasks) ? taskData.subtasks : [];
      setSubtasks(toUi(subtasksArray));
      
      // Reset
      // userEditedRef.current = false;
      setTaskInput("");
      
    } catch (error) {
      console.error("Breakdown failed:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const selectTask = useCallback((task: any) => {
    // If clicking the same task, deselect it
    if (activeTaskId === task.id) {
      setActiveTaskId(null);
      setSubtasks([]);
      return;
    }
    
    // Step 1: Set active ID immediately (instant visual feedback)
    setActiveTaskId(task.id);
    
    // Step 2: Prepare subtasks in a microtask (next tick)
    setTimeout(() => {
      const taskSubtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
      const uiSubtasks = taskSubtasks.map((s) => ({
        ...s,
        _uiId: crypto.randomUUID(),
        completed: s.completed ?? false,
        priority: s.priority ?? "Medium",
        orderIndex: s.orderIndex ?? 0,
        estimateMinutes: Math.max(1, s.estimateMinutes || 1),
      }));
      
      // Set subtasks
      setSubtasks(uiSubtasks);
      
      // Reset edit flag
      // userEditedRef.current = false;
      
      // Trigger highlight
      setShouldHighlight(true);
      
      // Step 3: Scroll after subtasks are rendered
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
        
        // Remove highlight
        setTimeout(() => setShouldHighlight(false), 1500);
      }, 50); // Small delay to ensure subtasks are rendered
    }, 0);
  }, [activeTaskId]); // Only depend on activeTaskId


  /* ----------------------------- UI ------------------------------- */
  return (
    <main className="max-w-md mx-auto px-4 py-10 space-y-8 bg-white">
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

      {/* Task List with Skeleton */}
      {loadingTasks ? (
        <SkeletonTaskList />
      ) : tasks && tasks.length > 0 ? (
        <section className="space-y-2">
          {tasks.map((t, index) => (
            <motion.div 
              key={t.id || `task-${index}`}
              layout
              className={`group relative rounded-lg border transition ${
                t.id === activeTaskId 
                  ? "bg-gray-900 dark:bg-gray-700 border-gray-900 dark:border-gray-600 shadow-lg" 
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
              }`}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <button
                onClick={() => selectTask(t)}
                aria-pressed={t.id === activeTaskId}
                className={`w-full text-left px-4 py-2 pr-10 rounded-lg text-sm transition ${
                  t.id === activeTaskId ? "text-white" : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {t.task}
              </button>
              
              {/* Delete Button (keep your existing delete button code) */}
              <button
                onClick={(e) => handleDeleteTask(t, e)}
                disabled={!!deletingTaskId}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded transition ${
                  t.id === activeTaskId 
                    ? "text-white hover:bg-white/20" 
                    : "text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                } ${deletingTaskId === t.id ? "opacity-50 cursor-not-allowed" : ""}`}
                aria-label={`Delete task: ${t.task}`}
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

      {/* Delete Current Task Modal (optional - you can remove if not needed) */}
      {activeTaskId && (
        <ConfirmModal
          isOpen={showDeleteModal}
          title="Delete Current Task?"
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

      {!online && activeTaskId && (
        <p className="text-xs text-yellow-600">Offline — editing is available, reordering is disabled</p>
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

      {/* AI Breakdown Loading Skeleton - SIMPLIFIED */}
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
                  priority: e.target.value ? (e.target.value as "Low" | "Medium" | "High") : undefined,
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
                onClick={() => setSort(label === "none" ? null : label)}
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
        {/* Add a visual indicator when task is selected */}
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
                  Viewing subtasks for <strong className="font-semibold">
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
        
        {activeTaskId && !canReorder && isBaseView && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Reordering is available only in the base view, while online and not saving.
          </p>
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
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            Reordering is available only in the base view while online and not saving
          </p>
        )}

        {activeTaskId && isBaseView && (
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
      </motion.section>
      {/* Back to Top Button - Shows when scrolled down */}
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
            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </motion.button>
      )}
    </main>
  );
}