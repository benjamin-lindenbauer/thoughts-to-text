'use client';

import { useOffline } from '@/hooks/useOffline';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function OfflineIndicator({ className, showDetails = false }: OfflineIndicatorProps) {
  const { 
    isOnline, 
    isOffline, 
    syncQueueLength,  
    getConnectionQuality,
    processSyncQueue 
  } = useOffline();

  const connectionQuality = getConnectionQuality();

  // Don't render anything during SSR or if online with no queue and no details requested
  if (typeof window === 'undefined' || (isOnline && syncQueueLength === 0 && !showDetails)) {
    return null;
  }

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
      isOffline 
        ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400" 
        : syncQueueLength > 0
        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
        : connectionQuality === 'poor'
        ? "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400"
        : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
      className
    )}>
      {isOffline ? (
        <WifiOff className="h-4 w-4" />
      ) : (
        <Wifi className={cn(
          "h-4 w-4",
          connectionQuality === 'poor' && "text-orange-500"
        )} />
      )}
      
      <div className="flex items-center gap-2">
        {isOffline ? (
          <div className="flex items-center gap-2">
            <span>Offline</span>
          </div>
        ) : (
          <span>
            {connectionQuality === 'poor' ? 'Poor connection' : 'Online'}
          </span>
        )}

        {syncQueueLength > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs">
              {syncQueueLength} pending
            </span>
            {isOnline && (
              <button
                onClick={processSyncQueue}
                className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                title="Retry sync"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Compact version for mobile navigation
export function OfflineIndicatorCompact({ className }: { className?: string }) {
  const { isOnline, syncQueueLength } = useOffline();

  // Don't render anything during SSR or if online with no queue
  if (typeof window === 'undefined' || (isOnline && syncQueueLength === 0)) {
    return null;
  }

  return (
    <div className={cn(
      "flex items-center justify-center w-2 h-2 rounded-full",
      isOnline 
        ? "bg-yellow-500" 
        : "bg-red-500",
      className
    )} />
  );
}