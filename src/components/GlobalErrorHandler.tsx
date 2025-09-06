'use client';

import { useEffect } from 'react';
import { errorLogger } from '@/lib/error-logging';
import { useToast } from '@/hooks/useToast';
import { StorageQuotaWarning } from './StorageQuotaWarning';

interface GlobalErrorHandlerProps {
  children: React.ReactNode;
}

export function GlobalErrorHandler({ children }: GlobalErrorHandlerProps) {
  const { error: showError } = useToast();

  useEffect(() => {
    // Handle service worker messages for background sync errors
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const { data } = event;
      
      if (data.type === 'SYNC_ERROR') {
        errorLogger.error('network', 'Background sync failed', {
          operation: data.operation,
          error: data.error,
        });
        
        showError(
          'Sync failed',
          'Some operations failed to sync. They will be retried when you\'re back online.'
        );
      }
      
      if (data.type === 'QUOTA_EXCEEDED') {
        errorLogger.error('storage', 'Storage quota exceeded during background sync', {
          operation: data.operation,
        });
        
        showError(
          'Storage full',
          'Unable to save data due to storage limitations. Please free up space.'
        );
      }
    };

    // Listen for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    // Handle online/offline status changes
    const handleOnline = () => {
      errorLogger.info('network', 'Connection restored');
    };

    const handleOffline = () => {
      errorLogger.warn('network', 'Connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Handle visibility change (for detecting when app comes back to foreground)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // App came back to foreground - check for any pending errors
        const recentErrors = errorLogger.getRecentLogs(5);
        const criticalErrors = recentErrors.filter(log => 
          log.level === 'error' && 
          (log.category === 'storage' || log.category === 'api')
        );
        
        if (criticalErrors.length > 0) {
          const latestError = criticalErrors[0];
          if (latestError.category === 'storage' && 
              latestError.message.toLowerCase().includes('quota')) {
            showError(
              'Storage issue detected',
              'Your device storage may be full. Consider deleting old recordings.'
            );
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showError]);

  return (
    <>
      {children}
      <StorageQuotaWarning />
    </>
  );
}