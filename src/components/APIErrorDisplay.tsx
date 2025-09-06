'use client';

import { APIError } from '@/types';
import { getErrorMessage, isRetryableError } from '@/lib/api';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

interface APIErrorDisplayProps {
  error: APIError;
  onRetry?: () => void;
  onDismiss?: () => void;
  isRetrying?: boolean;
  className?: string;
}

export function APIErrorDisplay({
  error,
  onRetry,
  onDismiss,
  isRetrying = false,
  className = '',
}: APIErrorDisplayProps) {
  const message = getErrorMessage(error);
  const canRetry = isRetryableError(error);

  const getErrorColor = (type: APIError['type']) => {
    switch (type) {
      case 'auth':
        return 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-200';
      case 'quota':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200';
      case 'network':
        return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200';
      default:
        return 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200';
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${getErrorColor(error.type)} ${className}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {error.type === 'auth' && 'Authentication Error'}
            {error.type === 'quota' && 'Rate Limit Exceeded'}
            {error.type === 'network' && 'Network Error'}
            {error.type === 'server' && 'Server Error'}
            {error.type === 'unknown' && 'Error'}
          </p>
          <p className="text-sm mt-1 opacity-90">
            {message}
          </p>
          
          {error.retryAfter && (
            <p className="text-xs mt-2 opacity-75">
              Retry available in {error.retryAfter} seconds
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {canRetry && onRetry && (
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              title="Retry"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            </button>
          )}
          
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}