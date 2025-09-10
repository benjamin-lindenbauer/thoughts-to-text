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
    isOnline: true, // Default to online for SSR
    isOffline: false,
    syncQueueLength: 0, // Default to 0 for SSR
    lastOnlineAt: null,
    connectionType: null,
  });
  const [isMounted, setIsMounted] = useState(false);

  const updateOnlineStatus = useCallback(() => {
    if (typeof navigator === 'undefined') return;
    
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

  // Track client-side mounting
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize state after mounting
  useEffect(() => {
    if (!isMounted) return;

    // Set initial state based on actual browser state
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const now = new Date();
    
    setState({
      isOnline,
      isOffline: !isOnline,
      syncQueueLength: pwaManager.queueLength,
      lastOnlineAt: isOnline ? now : null,
      connectionType: getConnectionType(),
    });
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) return;

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
      if (typeof navigator !== 'undefined' && navigator.onLine) {
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
  }, [updateOnlineStatus, updateSyncQueue, isMounted]);

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

  const getConnectionQuality = useCallback((): 'good' | 'poor' | 'offline' => {
    if (!state.isOnline) return 'offline';
    
    if (typeof navigator === 'undefined') return 'good';
    
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
    getConnectionQuality,
    queueItems: pwaManager.queueItems,
  };
};

function getConnectionType(): string | null {
  if (typeof navigator === 'undefined') return null;
  
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
      setIsInstalled(true);
    }
    return result;
  }, []);

  return {
    canInstall,
    isInstalled,
    install,
  };
};