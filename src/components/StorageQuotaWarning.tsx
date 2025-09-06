'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X, Trash2, Info } from 'lucide-react';
import { storageQuotaManager, StorageQuotaStatus } from '@/lib/storage-quota';
import { useToast } from '@/hooks/useToast';

interface StorageQuotaWarningProps {
  onDismiss?: () => void;
  className?: string;
}

export function StorageQuotaWarning({ onDismiss, className = '' }: StorageQuotaWarningProps) {
  const [storageStatus, setStorageStatus] = useState<StorageQuotaStatus | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    checkStorageStatus();
    
    // Check storage status periodically
    const interval = setInterval(checkStorageStatus, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const checkStorageStatus = async () => {
    try {
      const status = await storageQuotaManager.getQuotaStatus();
      setStorageStatus(status);
      
      // Show warning if storage is near limit and not dismissed
      if ((status.isNearLimit || status.isAtLimit) && !isDismissed) {
        setIsVisible(true);
      } else if (!status.isNearLimit && !status.isAtLimit) {
        setIsVisible(false);
        setIsDismissed(false); // Reset dismissal when storage is healthy
      }
    } catch (err) {
      console.error('Failed to check storage status:', err);
    }
  };

  const handleCleanup = async () => {
    setIsCleaningUp(true);
    try {
      const result = await storageQuotaManager.performAutomaticCleanup();
      
      if (result.itemsRemoved > 0) {
        success(
          'Storage cleaned up',
          `Removed ${result.itemsRemoved} items, freed ${Math.round(result.freedBytes / (1024 * 1024))}MB`
        );
        
        // Refresh storage status
        await checkStorageStatus();
      } else {
        error('No items to clean up', 'Storage is already optimized');
      }
      
      if (result.errors.length > 0) {
        console.warn('Cleanup errors:', result.errors);
      }
    } catch (err) {
      error('Cleanup failed', 'Unable to free up storage space');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible || !storageStatus || (!storageStatus.isNearLimit && !storageStatus.isAtLimit)) {
    return null;
  }

  const getWarningLevel = () => {
    if (storageStatus.isAtLimit) return 'critical';
    if (storageStatus.isNearLimit) return 'warning';
    return 'info';
  };

  const getWarningStyles = () => {
    const level = getWarningLevel();
    switch (level) {
      case 'critical':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';
      case 'warning':
        return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
    }
  };

  const getIcon = () => {
    const level = getWarningLevel();
    const iconClass = "w-5 h-5 flex-shrink-0";
    
    switch (level) {
      case 'critical':
        return <AlertTriangle className={`${iconClass} text-red-500`} />;
      case 'warning':
        return <AlertTriangle className={`${iconClass} text-orange-500`} />;
      default:
        return <Info className={`${iconClass} text-blue-500`} />;
    }
  };

  const getTitle = () => {
    if (storageStatus.isAtLimit) return 'Storage Full';
    if (storageStatus.isNearLimit) return 'Storage Nearly Full';
    return 'Storage Information';
  };

  const getMessage = () => {
    return storageQuotaManager.getStorageStatusMessage(storageStatus);
  };

  const getRecommendations = () => {
    return storageQuotaManager.getCleanupRecommendations(storageStatus);
  };

  return (
    <div className={`border rounded-lg p-4 ${getWarningStyles()} ${className}`}>
      <div className="flex items-start gap-3">
        {getIcon()}
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium">
            {getTitle()}
          </h3>
          <p className="text-sm mt-1 opacity-90">
            {getMessage()}
          </p>
          
          {getRecommendations().length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium opacity-75 mb-1">Recommendations:</p>
              <ul className="text-xs opacity-75 space-y-1">
                {getRecommendations().map((recommendation, index) => (
                  <li key={index} className="flex items-start gap-1">
                    <span className="text-xs">•</span>
                    <span>{recommendation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleCleanup}
              disabled={isCleaningUp}
              className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
              {isCleaningUp ? 'Cleaning...' : 'Clean Up'}
            </button>
            
            <button
              onClick={handleDismiss}
              className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-medium transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Hook to use storage quota warnings
export function useStorageQuotaWarning() {
  const [shouldShowWarning, setShouldShowWarning] = useState(false);
  const [storageStatus, setStorageStatus] = useState<StorageQuotaStatus | null>(null);

  useEffect(() => {
    const checkStorage = async () => {
      try {
        const status = await storageQuotaManager.getQuotaStatus();
        setStorageStatus(status);
        setShouldShowWarning(status.isNearLimit || status.isAtLimit);
      } catch (err) {
        console.error('Failed to check storage status:', err);
      }
    };

    checkStorage();
    
    // Check periodically
    const interval = setInterval(checkStorage, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, []);

  return {
    shouldShowWarning,
    storageStatus,
    checkStorage: async () => {
      const status = await storageQuotaManager.getQuotaStatus();
      setStorageStatus(status);
      setShouldShowWarning(status.isNearLimit || status.isAtLimit);
      return status;
    },
  };
}