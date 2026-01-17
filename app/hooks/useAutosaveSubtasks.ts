"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { UiSubtask, PersistedSubtask } from "../types/subtask";

interface Params {
  activeTaskId: string | null;
  subtasks: UiSubtask[];
  toPersisted: (items: UiSubtask[]) => PersistedSubtask[];
  onServerUpdate: (updatedTask: any) => void;
  onRollback?: (items: UiSubtask[]) => void;
  userEditedRef?: React.MutableRefObject<boolean>;
  onSubtaskSaved?: () => void;
}

const AUTOSAVE_DELAY = 500;
const MIN_SAVING_DURATION = 500;

export function useAutosaveSubtasks({
  activeTaskId,
  subtasks,
  toPersisted,
  onServerUpdate,
  onRollback,
  userEditedRef,
  onSubtaskSaved
}: Params) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hydratedRef = useRef(false);
  const lastSavedRef = useRef<string>("");
  const pendingSnapshotRef = useRef<string | null>(null);
  const savingStartRef = useRef<number>(0);
  const lastSavedOrderRef = useRef<string>("");
  const lastGoodSubtasksRef = useRef<UiSubtask[]>([]);



  const [saving, setSaving] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const contentSnapshot = (items: UiSubtask[]) =>
    JSON.stringify(
      items.map(({ title, description, estimateMinutes, completed, priority, orderIndex }) => ({
        title,
        description,
        estimateMinutes,
        completed,
        priority,
        orderIndex
      })
    )
  );

  const orderSnapshot = (items: UiSubtask[]) =>
    JSON.stringify(items.map((s) => s.orderIndex));


  const persist = useCallback(
    (items: UiSubtask[], snapshot: string) => {
      if (!activeTaskId || pendingSnapshotRef.current === snapshot) return;

      pendingSnapshotRef.current = snapshot;
      setHasPendingChanges(true);
      setSaving(true);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(async () => {
        savingStartRef.current = Date.now();
        setSaveError(null);

        try {
          const res = await fetch(`/api/subtasks/breakdown?id=${activeTaskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subtasks: toPersisted(items) }),
          });

          if (!res.ok) throw new Error("Failed to save subtasks");

          const updatedTask = await res.json();

          lastSavedRef.current = snapshot;
          lastSavedOrderRef.current = orderSnapshot(items);
          pendingSnapshotRef.current = null;
          lastGoodSubtasksRef.current = items.map((s) => ({ ...s }));


          onServerUpdate(updatedTask);

          const elapsed = Date.now() - savingStartRef.current;
          const remaining = MIN_SAVING_DURATION - elapsed;
          const finishSaving = () => {
            setSaving(false);
            setHasPendingChanges(false);
            if (onSubtaskSaved) onSubtaskSaved()
          };

          if (remaining > 0) {
            setTimeout(finishSaving, remaining);
          } else {
            finishSaving();
          }
        } catch (err) {
          console.error(err);
          setSaving(false);
          setSaveError("Failed to save changes");
          pendingSnapshotRef.current = null;

          // rollback optimistic changes locally
          if (lastGoodSubtasksRef.current.length && onRollback) {
            onRollback(lastGoodSubtasksRef.current);
          }
        } finally {
        }
      }, AUTOSAVE_DELAY);
    },
    [activeTaskId, onServerUpdate, toPersisted, onRollback]
  );

  const retrySave = useCallback(() => {
    if (!activeTaskId) return;

    const snapshot = contentSnapshot(subtasks);

    // Clear pending guard so retry is allowed
    pendingSnapshotRef.current = null;

    persist(subtasks, snapshot);
  }, [activeTaskId, subtasks, persist]);



  useEffect(() => {
    if (!activeTaskId) return;

    if (!hydratedRef.current) {
      hydratedRef.current = true;
      lastSavedRef.current = contentSnapshot(subtasks);
      lastSavedOrderRef.current = orderSnapshot(subtasks);
      lastGoodSubtasksRef.current = subtasks.map((s) => ({ ...s }));

      return;
    }

    const snapshot = contentSnapshot(subtasks);
    const currentOrder = orderSnapshot(subtasks);

    const contentUnchanged = snapshot === lastSavedRef.current;
    const orderUnchanged = currentOrder === lastSavedOrderRef.current;

    if (contentUnchanged && orderUnchanged) return;

    persist(subtasks, snapshot);
  }, [subtasks, activeTaskId, persist]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { saving, hasPendingChanges, saveError, retrySave };
}
