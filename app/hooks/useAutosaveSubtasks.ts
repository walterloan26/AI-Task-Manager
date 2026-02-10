"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UiSubtask, PersistedSubtask } from "../types/subtask";
import { clientEvents } from '@/lib/events/clientEvents';

interface Params {
  activeTaskId: string | null;
  subtasks: UiSubtask[];
  toPersisted: (items: UiSubtask[]) => PersistedSubtask[];
  onServerUpdate: (updatedTask: any) => void;
  onRollback?: (items: UiSubtask[]) => void;
  onSubtaskSaved?: () => void;
  isReorderingRef: React.MutableRefObject<boolean>;
  userEditedRef: React.MutableRefObject<boolean>; // Add this back
}

const AUTOSAVE_DELAY = 800;
const MIN_SAVING_DURATION = 500;

export function useAutosaveSubtasks({
  activeTaskId,
  subtasks,
  toPersisted,
  onServerUpdate,
  onRollback,
  onSubtaskSaved,
  isReorderingRef,
  userEditedRef, // Add this
}: Params) {
  /* ----------------------------- refs ----------------------------- */
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hydratedRef = useRef(false);
  const lastSavedContentRef = useRef<string>("");
  const lastSavedOrderRef = useRef<string>("");
  const pendingSnapshotRef = useRef<string | null>(null);
  const savingStartRef = useRef<number>(0);
  const lastGoodSubtasksRef = useRef<UiSubtask[]>([]);

  /* ----------------------------- state ---------------------------- */
  const [saving, setSaving] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /* ---------------------------- helpers --------------------------- */
  const contentSnapshot = (items: UiSubtask[]) =>
    JSON.stringify(
      items.map(
        ({
          title,
          description,
          estimateMinutes,
          completed,
          priority,
        }) => ({
          title,
          description,
          estimateMinutes,
          completed,
          priority,
        })
      )
    );

  const orderSnapshot = (items: UiSubtask[]) =>
    JSON.stringify(items.map((s) => s.orderIndex));

  const calculateNewlyCompleted = (currentItems: UiSubtask[], previousItems: UiSubtask[]): number => {
    if (!previousItems || previousItems.length === 0) return 0;
    
    const previousCompleted = previousItems.filter(s => s.completed).length;
    const currentCompleted = currentItems.filter(s => s.completed).length;
    
    return currentCompleted - previousCompleted;
  };

  /* ---------------------------- persist --------------------------- */
  const persist = useCallback(
    (items: UiSubtask[], contentSnap: string) => {
      // Don't save if user hasn't edited (except for initial hydration)
      if (!userEditedRef.current && hydratedRef.current) {
        return;
      }

      // Don't autosave while actively reordering
      if (isReorderingRef.current) {
        return;
      }

      if (!activeTaskId) {
        return;
      }

      const taskIdAtSchedule = activeTaskId;
      const orderSnap = orderSnapshot(items);
      const combinedSnapshot = `${contentSnap}|${orderSnap}`;

      if (pendingSnapshotRef.current === combinedSnapshot) {
        return;
      }

      pendingSnapshotRef.current = combinedSnapshot;
      setHasPendingChanges(true);
      setSaving(true);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(async () => {
        if (taskIdAtSchedule !== activeTaskId) {
          pendingSnapshotRef.current = null;
          setSaving(false);
          setHasPendingChanges(false);
          return;
        }

        savingStartRef.current = Date.now();
        setSaveError(null);

        try {
          const persisted = toPersisted(items);

          const res = await fetch(
            `/api/subtasks/breakdown?id=${activeTaskId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ subtasks: persisted }),
            }
          );

          if (res.status === 429) {
            const error = "Rate limit reached. Will retry automatically.";
            pendingSnapshotRef.current = null;
            setSaving(false);
            setHasPendingChanges(false);
            setSaveError(error);
            return;
          }

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Save failed: ${res.status} - ${errorText}`);
          }

          const response = await res.json();

          if (!response.success || !response.data) {
            throw new Error("Invalid response from server");
          }

          const updatedTask = response.data;

          clientEvents.emit('task:updated', {
            taskId: activeTaskId,
            serverSaved: true,
            subtaskCount: items.length
          });

          const newlyCompletedCount = calculateNewlyCompleted(items, lastGoodSubtasksRef.current);
          if (newlyCompletedCount !== 0) { // Changed from > 0 to !== 0
            clientEvents.emit('subtask:toggled', {
              taskId: activeTaskId,
              newlyCompletedCount: Math.abs(newlyCompletedCount),
              wasCompleted: newlyCompletedCount > 0,
              serverConfirmed: true
            });
          }
          
          // Update refs
          lastSavedContentRef.current = contentSnap;
          lastSavedOrderRef.current = orderSnap;
          lastGoodSubtasksRef.current = items.map((s) => ({ ...s }));
          pendingSnapshotRef.current = null;

          // Reset user edited flag
          userEditedRef.current = false;

          onServerUpdate(updatedTask);

          // Ensure minimum saving duration for better UX
          const elapsed = Date.now() - savingStartRef.current;
          const remaining = MIN_SAVING_DURATION - elapsed;

          setTimeout(() => {
            setSaving(false);
            setHasPendingChanges(false);
            onSubtaskSaved?.();
          }, Math.max(0, remaining));

        } catch (err: any) {
          pendingSnapshotRef.current = null;
          setSaving(false);
          setHasPendingChanges(false);
          setSaveError(err?.message ?? "Failed to save changes");

          // Rollback if we have a previous good state
          if (lastGoodSubtasksRef.current.length && onRollback) {
            onRollback(lastGoodSubtasksRef.current);
          }
        }
      }, AUTOSAVE_DELAY);
    },
    [
      activeTaskId,
      toPersisted,
      onServerUpdate,
      onRollback,
      onSubtaskSaved,
      isReorderingRef,
      userEditedRef,
    ]
  );

  /* -------------------------- autosave ---------------------------- */
  useEffect(() => {
    if (!activeTaskId) return;

    // Initial hydration
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      lastSavedContentRef.current = contentSnapshot(subtasks);
      lastSavedOrderRef.current = orderSnapshot(subtasks);
      lastGoodSubtasksRef.current = subtasks.map((s) => ({ ...s }));
      return;
    }

    // Don't save during reordering
    if (isReorderingRef.current) {
      return;
    }

    // Don't save if user hasn't edited
    if (!userEditedRef.current) {
      return;
    }

    const contentSnap = contentSnapshot(subtasks);
    const orderSnap = orderSnapshot(subtasks);

    const contentUnchanged = contentSnap === lastSavedContentRef.current;
    const orderUnchanged = orderSnap === lastSavedOrderRef.current;

    if (contentUnchanged && orderUnchanged) {
      return;
    }

    persist(subtasks, contentSnap);
  }, [subtasks, activeTaskId, persist, isReorderingRef, userEditedRef]);

  /* --------------------------- cleanup ---------------------------- */
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  /* ---------------------------- api ------------------------------- */
  const retrySave = useCallback(() => {
    if (!activeTaskId) return;
    if (isReorderingRef.current) return;

    pendingSnapshotRef.current = null;
    userEditedRef.current = true; // Mark as edited
    persist(subtasks, contentSnapshot(subtasks));
  }, [activeTaskId, subtasks, persist, isReorderingRef, userEditedRef]);

  return {
    saving,
    hasPendingChanges,
    saveError,
    retrySave,
  };
}