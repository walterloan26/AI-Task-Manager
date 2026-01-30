"use client";

import { useEffect, useRef, useCallback  } from "react";

type OrderUpdate = {
  taskId: string;
  updates: { id: string; orderIndex: number }[];
  timestamp: number;
};

const STORAGE_KEY = "offline-order-queue";

function loadQueue(): OrderUpdate[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: OrderUpdate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function useOfflineOrderQueue(online: boolean) {
  const queueRef = useRef<OrderUpdate[]>(loadQueue());
  const flushingRef = useRef(false);

  const enqueue = (update: OrderUpdate) => {
    queueRef.current = queueRef.current.filter(
      (u) => u.taskId !== update.taskId
    );
    queueRef.current.push(update);
    saveQueue(queueRef.current);
  };

  const flush = useCallback(async () => {
    if (!online) return;
    if (flushingRef.current) return;
    if (queueRef.current.length === 0) return;

    flushingRef.current = true;

    try {
      while (queueRef.current.length) {
        const next = queueRef.current[0];

        const res = await fetch("/api/subtasks/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: next.taskId,
            subtasks: next.updates,
          }),
        });

        if (!res.ok) throw new Error("Order flush failed");

        queueRef.current.shift();
        saveQueue(queueRef.current);
      }
    } catch (err) {
      console.error("Failed to flush order queue", err);
    } finally {
      flushingRef.current = false;
    }
  }, [online])

  useEffect(() => {
      if (online) flush();
    }, [online, flush]);

    return { enqueue };
}