'use client';

import { useState, useCallback } from 'react';
import { ToastData, ToastType } from '@/components/Toast';

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((
    type: ToastType,
    title: string,
    description?: string,
    duration?: number
  ) => {
    const id = crypto.randomUUID();
    const newToast: ToastData = {
      id,
      type,
      title,
      description,
      duration,
    };

    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback((title: string, description?: string, duration?: number) => {
    return addToast('success', title, description, duration);
  }, [addToast]);

  const error = useCallback((title: string, description?: string, duration?: number) => {
    return addToast('error', title, description, duration);
  }, [addToast]);

  const info = useCallback((title: string, description?: string, duration?: number) => {
    return addToast('info', title, description, duration);
  }, [addToast]);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
    clearAll,
  };
}