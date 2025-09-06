'use client';

import { useState, useCallback } from 'react';
import { APIError } from '@/types';
import { errorLogger } from '@/lib/error-logging';
import { storageQuotaManager } from '@/lib/storage-quota';
import { useToast } from './useToast';

export interface ErrorState {
  error: APIError | Error | null;
  isRetrying: boolean;
  retryCount: number;
  canRetry: boolean;
}

export interface ErrorHandlingOptions {
  maxRetries?: number;
  showToast?: boolean;
  logError?: boolean;
  category?: 'api' | 'storage' | 'audio' | 'ui' | 'network' | 'unknown';
}

export function useErrorHandling(options: ErrorHandlingOptions = {}) {
  const {
    maxRetries = 3,
    showToast = true,
    logError = true,
    category = 'unknown',
  } = options;

  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isRetrying: false,
    retryCount: 0,
    canRetry: false,
  });

  const { error: showErrorToast, success } = useToast();

  // Handle different types of errors
  const handleError = useCallback(async (
    error: APIError | Error,
    context?: Record<string, any>
  ) => {
    // Log error if enabled
    if (logError) {
      if ('type' in error) {
        // APIError
        errorLogger.handleAPIError(error, context?.endpoint || 'unknown', errorState.retryCount);
      } else {
        // Regular Error
        errorLogger.error(category, error.message, context, error);
      }
    }

    // Determine if error is retryable
    const canRetry = errorState.retryCount < maxRetries && (
      ('retryable' in error && error.retryable) ||
      (!('retryable' in error) && !error.message.toLowerCase().includes('auth'))
    );

    // Update error state
    setErrorState(prev => ({
      error,
      isRetrying: false,
      retryCount: prev.retryCount,
      canRetry,
    }));

    // Show toast notification if enabled
    if (showToast) {
      const message = 'message' in error ? error.message : String(error);
      showErrorToast('Error occurred', message);
    }

    // Handle storage quota errors specifically
    if (error.message.toLowerCase().includes('storage') || 
        error.message.toLowerCase().includes('quota')) {
      try {
        await storageQuotaManager.handleQuotaExceeded(context?.operation || 'unknown');
      } catch (cleanupError) {
        console.error('Failed to handle storage quota error:', cleanupError);
      }
    }
  }, [errorState.retryCount, maxRetries, showToast, logError, category, showErrorToast]);

  // Clear error state
  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isRetrying: false,
      retryCount: 0,
      canRetry: false,
    });
  }, []);

  // Retry operation
  const retry = useCallback(async (operation: () => Promise<any>) => {
    if (!errorState.canRetry || errorState.isRetrying) {
      return;
    }

    setErrorState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: prev.retryCount + 1,
    }));

    try {
      const result = await operation();
      
      // Success - clear error state
      setErrorState({
        error: null,
        isRetrying: false,
        retryCount: 0,
        canRetry: false,
      });

      if (showToast) {
        success('Operation completed', 'The operation was successful after retry');
      }

      return result;
    } catch (error) {
      // Retry failed - handle the new error
      await handleError(error as APIError | Error);
    }
  }, [errorState.canRetry, errorState.isRetrying, handleError, showToast, success]);

  // Execute operation with error handling
  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T | null> => {
    try {
      clearError();
      return await operation();
    } catch (error) {
      await handleError(error as APIError | Error, context);
      return null;
    }
  }, [handleError, clearError]);

  // Get user-friendly error message
  const getErrorMessage = useCallback((): string => {
    if (!errorState.error) return '';

    if ('type' in errorState.error) {
      // APIError
      switch (errorState.error.type) {
        case 'auth':
          return 'Authentication failed. Please check your API key in settings.';
        case 'quota':
          return 'Rate limit exceeded. Please try again later.';
        case 'network':
          return 'Network error. Please check your internet connection.';
        case 'server':
          return 'Server error. Please try again in a few minutes.';
        default:
          return errorState.error.message || 'An unexpected error occurred.';
      }
    }

    // Regular Error
    if (errorState.error.message.toLowerCase().includes('storage')) {
      return 'Storage is full. Please delete some recordings to continue.';
    }

    if (errorState.error.message.toLowerCase().includes('network')) {
      return 'Network connection failed. Please check your internet connection.';
    }

    return errorState.error.message || 'An unexpected error occurred.';
  }, [errorState.error]);

  // Get recovery suggestions
  const getRecoverySuggestions = useCallback((): string[] => {
    if (!errorState.error) return [];

    const suggestions: string[] = [];

    if ('type' in errorState.error) {
      // APIError
      switch (errorState.error.type) {
        case 'auth':
          suggestions.push('Check your OpenAI API key in settings');
          suggestions.push('Ensure your API key has sufficient permissions');
          break;
        case 'quota':
          suggestions.push('Wait a few minutes before trying again');
          suggestions.push('Check your OpenAI usage limits');
          break;
        case 'network':
          suggestions.push('Check your internet connection');
          suggestions.push('Try again when you have better connectivity');
          break;
        case 'server':
          suggestions.push('Wait a few minutes and try again');
          suggestions.push('Check OpenAI status page for service issues');
          break;
      }
    } else {
      // Regular Error
      if (errorState.error.message.toLowerCase().includes('storage')) {
        suggestions.push('Delete old recordings to free up space');
        suggestions.push('Clear app data if the problem persists');
      } else if (errorState.error.message.toLowerCase().includes('network')) {
        suggestions.push('Check your internet connection');
        suggestions.push('Try again when connectivity is restored');
      }
    }

    if (errorState.canRetry) {
      suggestions.push('Try the operation again');
    }

    return suggestions;
  }, [errorState.error, errorState.canRetry]);

  return {
    errorState,
    handleError,
    clearError,
    retry,
    executeWithErrorHandling,
    getErrorMessage,
    getRecoverySuggestions,
  };
}