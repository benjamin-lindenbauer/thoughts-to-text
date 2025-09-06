import { useState, useEffect, useCallback } from 'react';
import { pwaManager } from '@/lib/pwa';

export interface OfflineState {
  isOnline: boolean;
  isOffline: boolean;
  syncQueueLength: number;
  lastOnlineAt: Date | null;
  connectionType: string | null;
}

export const useOffline = () => {
  const [state, setState] = useState<OfflineState>({
    isOnline: navigator.onLine,
    isOffline: !navigator.onLine,
    syncQueueLength: pwaManager.queueLength,
    lastOnlineAt: navigator.onLine ? new Date() : null,
    connectionType: getConnectionType(),
  });

  const updateOnlineStatus = useCallback(() => {
    const isOnline = navigator.onLine;
    const now = new Date();
    
    setState(prev => ({
      ...prev,
      isOnline,
      isOffline: !isOnline,
      lastOnlineAt: isOnline ? now : prev.lastOnlineAt,
      connectionType: getConnectionType(),
    }));

    // Process sync queue when coming back online
    if (isOnline) {
      pwaManager.processSyncQueue();
    }
  }, []);

  const updateSyncQueue = useCallback(() => {
    setState(prev => ({
      ...prev,
      syncQueueLength: pwaManager.queueLength,
    }));
  }, []);

  useEffect(() => {
    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Listen for connection changes
    if ('connection' in navigator) {
      (navigator as any).connection.addEventListener('change', updateOnlineStatus);
    }

    // Listen for sync queue changes
    const handleSyncProcess = () => updateSyncQueue();
    window.addEventListener('pwa-sync-process', handleSyncProcess);

    // Periodic sync queue check
    const syncInterval = setInterval(() => {
      updateSyncQueue();
      if (navigator.onLine) {
        pwaManager.processSyncQueue();
      }
    }, 30000); // Check every 30 seconds

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('pwa-sync-process', handleSyncProcess);
      
      if ('connection' in navigator) {
        (navigator as any).connection.removeEventListener('change', updateOnlineStatus);
      }
      
      clearInterval(syncInterval);
    };
  }, [updateOnlineStatus, updateSyncQueue]);

  const addToSyncQueue = useCallback((type: 'transcription' | 'rewrite', data: any) => {
    const id = pwaManager.addToSyncQueue(type, data);
    updateSyncQueue();
    return id;
  }, [updateSyncQueue]);

  const processSyncQueue = useCallback(async () => {
    if (state.isOnline) {
      await pwaManager.processSyncQueue();
      updateSyncQueue();
    }
  }, [state.isOnline, updateSyncQueue]);

  const getOfflineDuration = useCallback((): number | null => {
    if (state.isOnline || !state.lastOnlineAt) {
      return null;
    }
    return Date.now() - state.lastOnlineAt.getTime();
  }, [state.isOnline, state.lastOnlineAt]);

  const getConnectionQuality = useCallback((): 'good' | 'poor' | 'offline' => {
    if (!state.isOnline) return 'offline';
    
    const connection = (navigator as any).connection;
    if (!connection) return 'good';
    
    const effectiveType = connection.effectiveType;
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      return 'poor';
    }
    
    return 'good';
  }, [state.isOnline]);

  return {
    ...state,
    addToSyncQueue,
    processSyncQueue,
    getOfflineDuration,
    getConnectionQuality,
    queueItems: pwaManager.queueItems,
  };
};

function getConnectionType(): string | null {
  const connection = (navigator as any).connection;
  if (!connection) return null;
  
  return connection.effectiveType || connection.type || null;
}

// Hook for PWA installation
export const usePWAInstall = () => {
  const [canInstall, setCanInstall] = useState(pwaManager.canInstall);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    setIsInstalled(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );

    // Listen for install prompt
    const handleBeforeInstallPrompt = () => {
      setCanInstall(true);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    const result = await pwaManager.showInstallPrompt();
    if (result) {
      setCanInstall(false);
    }
    return result;
  }, []);

  return {
    canInstall,
    isInstalled,
    install,
  };
};