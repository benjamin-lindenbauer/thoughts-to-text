'use client';

import { useEffect, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { StatePersistence } from '@/lib/state-persistence';

interface InitializationState {
  isInitialized: boolean;
  isHydrating: boolean;
  initializationError: string | null;
}

// Hook for managing app initialization and hydration
export function useAppInitialization() {
  const { state, dispatch } = useAppContext();
  const [initState, setInitState] = useState<InitializationState>({
    isInitialized: false,
    isHydrating: true,
    initializationError: null
  });

  useEffect(() => {
    // Check if app is fully initialized
    const isFullyLoaded = state.isSettingsLoaded && state.isNotesLoaded;
    
    if (isFullyLoaded && initState.isHydrating) {
      setInitState({
        isInitialized: true,
        isHydrating: false,
        initializationError: null
      });
    }
  }, [state.isSettingsLoaded, state.isNotesLoaded, initState.isHydrating]);

  // Handle initialization errors
  useEffect(() => {
    if (state.error && initState.isHydrating) {
      setInitState(prev => ({
        ...prev,
        isHydrating: false,
        initializationError: state.error
      }));
    }
  }, [state.error, initState.isHydrating]);

  // Retry initialization
  const retryInitialization = async () => {
    setInitState({
      isInitialized: false,
      isHydrating: true,
      initializationError: null
    });

    // Clear any existing errors
    dispatch({ type: 'SET_ERROR', payload: null });

    // Force re-initialization by clearing and reloading
    try {
      await StatePersistence.initialize();
      // The useEffect in AppProvider will handle the rest
    } catch (error) {
      console.error('Failed to retry initialization:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to initialize app' });
    }
  };

  // Clear all data and restart
  const resetApp = async () => {
    try {
      setInitState({
        isInitialized: false,
        isHydrating: true,
        initializationError: null
      });

      // Clear all persisted data
      StatePersistence.clearPersistedState();
      StatePersistence.clearOfflineQueue();
      
      // Clear error and trigger re-initialization
      dispatch({ type: 'SET_ERROR', payload: null });
      
      // Reload the page to fully reset
      window.location.reload();
    } catch (error) {
      console.error('Failed to reset app:', error);
      setInitState(prev => ({
        ...prev,
        initializationError: 'Failed to reset app'
      }));
    }
  };

  return {
    ...initState,
    retryInitialization,
    resetApp,
    // Convenience flags
    isReady: initState.isInitialized && !initState.isHydrating,
    hasError: !!initState.initializationError
  };
}

// Hook for monitoring storage health
export function useStorageHealth() {
  const [storageInfo, setStorageInfo] = useState({
    used: 0,
    available: 0,
    percentage: 0,
    isHealthy: true,
    lastChecked: Date.now()
  });

  const checkStorageHealth = async () => {
    try {
      const info = await StatePersistence.getStorageInfo();
      const isHealthy = info.percentage < 90; // Consider unhealthy if > 90% full
      
      setStorageInfo({
        ...info,
        isHealthy,
        lastChecked: Date.now()
      });
      
      return { ...info, isHealthy };
    } catch (error) {
      console.error('Failed to check storage health:', error);
      return null;
    }
  };

  // Check storage health on mount and periodically
  useEffect(() => {
    checkStorageHealth();
    
    // Check every 5 minutes
    const interval = setInterval(checkStorageHealth, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const cleanupStorage = () => {
    StatePersistence.cleanupStorage();
    checkStorageHealth(); // Re-check after cleanup
  };

  return {
    storageInfo,
    checkStorageHealth,
    cleanupStorage,
    isStorageHealthy: storageInfo.isHealthy,
    storageUsagePercentage: storageInfo.percentage
  };
}