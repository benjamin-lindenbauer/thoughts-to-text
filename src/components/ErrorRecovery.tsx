'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Download, Settings } from 'lucide-react';
import { APIError, StorageQuota } from '@/types';
import { storageQuotaManager, StorageQuotaStatus } from '@/lib/storage-quota';
import { errorLogger } from '@/lib/error-logging';
import { useToast } from '@/hooks/useToast';

interface ErrorRecoveryProps {
  error: APIError | Error | null;
  onRetry?: () => void;
  onRecover?: () => void;
  className?: string;
}

export function ErrorRecovery({ error, onRetry, onRecover, className = '' }: ErrorRecoveryProps) {
  const [isRecovering, setIsRecovering] = useState(false);
  const [storageStatus, setStorageStatus] = useState<StorageQuotaStatus | null>(null);
  const { success, error: showError } = useToast();

  useEffect(() => {
    // Check storage status when component mounts
    checkStorageStatus();
  }, []);

  const checkStorageStatus = async () => {
    try {
      const status = await storageQuotaManager.getQuotaStatus();
      setStorageStatus(status);
    } catch (err) {
      console.error('Failed to check storage status:', err);
    }
  };

  const handleRetry = async () => {
    if (!onRetry) return;
    
    setIsRecovering(true);
    try {
      await onRetry();
      success('Operation retried successfully');
    } catch (err) {
      showError('Retry failed', 'Please try again or contact support');
    } finally {
      setIsRecovering(false);
    }
  };

  const handleStorageCleanup = async () => {
    setIsRecovering(true);
    try {
      const result = await storageQuotaManager.performAutomaticCleanup();
      
      if (result.itemsRemoved > 0) {
        success(
          'Storage cleaned up',
          `Removed ${result.itemsRemoved} items, freed ${Math.round(result.freedBytes / (1024 * 1024))}MB`
        );
        
        // Refresh storage status
        await checkStorageStatus();
        
        // Try to recover if callback provided
        if (onRecover) {
          await onRecover();
        }
      } else {
        showError('No items to clean up', 'Storage is already optimized');
      }
      
      if (result.errors.length > 0) {
        console.warn('Cleanup errors:', result.errors);
      }
    } catch (err) {
      showError('Cleanup failed', 'Unable to free up storage space');
      errorLogger.error('storage', 'Manual cleanup failed', {}, err as Error);
    } finally {
      setIsRecovering(false);
    }
  };

  const handleExportData = async () => {
    try {
      // Export error logs for debugging
      const logs = errorLogger.exportLogs();
      const blob = new Blob([logs], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `error-logs-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      success('Error logs exported', 'Check your downloads folder');
    } catch (err) {
      showError('Export failed', 'Unable to export error logs');
    }
  };

  const handleClearAllData = async () => {
    if (!confirm('This will delete ALL your recordings and settings. Are you sure?')) {
      return;
    }
    
    if (!confirm('This action cannot be undone. Continue?')) {
      return;
    }

    setIsRecovering(true);
    try {
      const { clearAllData } = await import('@/lib/storage');
      await clearAllData();
      
      success('All data cleared', 'App has been reset to initial state');
      
      // Reload the page to start fresh
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      showError('Failed to clear data', 'Please try refreshing the page');
      errorLogger.error('storage', 'Failed to clear all data', {}, err as Error);
    } finally {
      setIsRecovering(false);
    }
  };

  const getErrorType = (): 'api' | 'storage' | 'network' | 'unknown' => {
    if (!error) return 'unknown';
    
    if ('type' in error) {
      // APIError
      if (error.type === 'network') return 'network';
      if (error.type === 'quota') return 'storage';
      return 'api';
    }
    
    // Regular Error
    if (error.message.toLowerCase().includes('storage') || 
        error.message.toLowerCase().includes('quota')) {
      return 'storage';
    }
    
    if (error.message.toLowerCase().includes('network') ||
        error.message.toLowerCase().includes('fetch')) {
      return 'network';
    }
    
    return 'unknown';
  };

  const getErrorMessage = (): string => {
    if (!error) return 'An unknown error occurred';
    
    if ('type' in error && 'message' in error) {
      // APIError
      return error.message;
    }
    
    // Regular Error
    return error.message;
  };

  const getRecoveryActions = () => {
    const errorType = getErrorType();
    const actions = [];

    // Always show retry if available
    if (onRetry) {
      actions.push(
        <button
          key="retry"
          onClick={handleRetry}
          disabled={isRecovering}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRecovering ? 'animate-spin' : ''}`} />
          Retry
        </button>
      );
    }

    // Storage-specific actions
    if (errorType === 'storage' || (storageStatus?.isNearLimit || storageStatus?.isAtLimit)) {
      actions.push(
        <button
          key="cleanup"
          onClick={handleStorageCleanup}
          disabled={isRecovering}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          Free Up Space
        </button>
      );
    }

    // Export logs for debugging
    actions.push(
      <button
        key="export"
        onClick={handleExportData}
        className="flex items-center gap-2 px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
      >
        <Download className="w-4 h-4" />
        Export Logs
      </button>
    );

    // Nuclear option - clear all data
    if (errorType === 'storage' || storageStatus?.isAtLimit) {
      actions.push(
        <button
          key="reset"
          onClick={handleClearAllData}
          disabled={isRecovering}
          className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          <Settings className="w-4 h-4" />
          Reset App
        </button>
      );
    }

    return actions;
  };

  if (!error) return null;

  return (
    <div className={`border rounded-lg p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
            Error Recovery
          </h3>
          <p className="text-sm mt-1 text-red-700 dark:text-red-300">
            {getErrorMessage()}
          </p>
          
          {storageStatus && (storageStatus.isNearLimit || storageStatus.isAtLimit) && (
            <div className="mt-2 p-2 bg-orange-100 dark:bg-orange-900/30 rounded text-xs text-orange-800 dark:text-orange-200">
              <p className="font-medium">Storage Issue Detected</p>
              <p>{storageQuotaManager.getStorageStatusMessage(storageStatus)}</p>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2 mt-3">
            {getRecoveryActions()}
          </div>
          
          {isRecovering && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              Recovery in progress...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}