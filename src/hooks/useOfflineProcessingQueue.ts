"use client";

import { useEffect, useState } from "react";
import {
  getPendingOfflineNoteIds,
  OFFLINE_QUEUE_CHANGE_EVENT,
} from "@/lib/offline-processing";

export function useOfflineProcessingQueue(): string[] {
  const [queueIds, setQueueIds] = useState<string[]>(() => {
    return typeof window === "undefined" ? [] : getPendingOfflineNoteIds();
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateQueue = () => {
      setQueueIds(getPendingOfflineNoteIds());
    };

    const handleQueueChange = (event: Event) => {
      if (event instanceof CustomEvent && Array.isArray(event.detail)) {
        setQueueIds(event.detail as string[]);
      } else {
        updateQueue();
      }
    };

    updateQueue();

    window.addEventListener(
      OFFLINE_QUEUE_CHANGE_EVENT,
      handleQueueChange as EventListener
    );
    window.addEventListener("storage", updateQueue);

    return () => {
      window.removeEventListener(
        OFFLINE_QUEUE_CHANGE_EVENT,
        handleQueueChange as EventListener
      );
      window.removeEventListener("storage", updateQueue);
    };
  }, []);

  return queueIds;
}
