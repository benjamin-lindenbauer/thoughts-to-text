// Error logging utility for debugging without exposing sensitive data

export interface ErrorLog {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  category: 'api' | 'storage' | 'audio' | 'ui' | 'network' | 'unknown';
  message: string;
  details?: Record<string, any>;
  userAgent: string;
  url: string;
  userId?: string; // Optional anonymous user ID
}

export interface StorageError extends Error {
  quota?: number;
  usage?: number;
  available?: number;
}

class ErrorLogger {
  private maxLogs = 50;
  private storageKey = 'app-error-logs';
  private sensitiveKeys = ['apiKey', 'password', 'token', 'secret', 'key'];

  // Sanitize data to remove sensitive information
  private sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = this.sensitiveKeys.some(sensitiveKey => 
        lowerKey.includes(sensitiveKey)
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  // Log an error with context
  log(
    level: ErrorLog['level'],
    category: ErrorLog['category'],
    message: string,
    details?: Record<string, any>,
    error?: Error
  ): string {
    const errorId = crypto.randomUUID();
    
    const errorLog: ErrorLog = {
      id: errorId,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details: details ? this.sanitizeData(details) : undefined,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Add error stack if provided (limited to prevent bloat)
    if (error) {
      errorLog.details = {
        ...errorLog.details,
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      };
    }

    // Store in localStorage
    try {
      const existingLogs = this.getLogs();
      existingLogs.push(errorLog);
      
      // Keep only recent logs
      const recentLogs = existingLogs.slice(-this.maxLogs);
      localStorage.setItem(this.storageKey, JSON.stringify(recentLogs));
    } catch (storageError) {
      console.warn('Failed to store error log:', storageError);
    }

    // Also log to console for development
    const consoleMethod = level === 'error' ? console.error : 
                         level === 'warn' ? console.warn : console.info;
    consoleMethod(`[${category.toUpperCase()}] ${message}`, errorLog);

    return errorId;
  }

  // Convenience methods for different error types
  error(category: ErrorLog['category'], message: string, details?: Record<string, any>, error?: Error): string {
    return this.log('error', category, message, details, error);
  }

  warn(category: ErrorLog['category'], message: string, details?: Record<string, any>): string {
    return this.log('warn', category, message, details);
  }

  info(category: ErrorLog['category'], message: string, details?: Record<string, any>): string {
    return this.log('info', category, message, details);
  }

  // Get all stored logs
  getLogs(): ErrorLog[] {
    try {
      const logs = localStorage.getItem(this.storageKey);
      return logs ? JSON.parse(logs) : [];
    } catch {
      return [];
    }
  }

  // Clear all logs
  clearLogs(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('Failed to clear error logs:', error);
    }
  }

  // Get logs by category
  getLogsByCategory(category: ErrorLog['category']): ErrorLog[] {
    return this.getLogs().filter(log => log.category === category);
  }

  // Get recent logs (last N logs)
  getRecentLogs(count: number = 10): ErrorLog[] {
    return this.getLogs().slice(-count);
  }

  // Export logs for debugging
  exportLogs(): string {
    const logs = this.getLogs();
    return JSON.stringify(logs, null, 2);
  }

  // Handle storage quota exceeded errors
  handleStorageQuotaError(error: StorageError, operation: string): string {
    const details = {
      operation,
      quota: error.quota,
      usage: error.usage,
      available: error.available,
    };

    return this.error('storage', 'Storage quota exceeded', details, error);
  }

  // Handle API errors with retry information
  handleAPIError(error: any, endpoint: string, retryCount: number = 0): string {
    const details = {
      endpoint,
      retryCount,
      errorType: error.type,
      retryable: error.retryable,
      retryAfter: error.retryAfter,
    };

    return this.error('api', `API error: ${error.message}`, details, error);
  }

  // Handle audio recording errors
  handleAudioError(error: Error, operation: string, deviceInfo?: MediaDeviceInfo[]): string {
    const details = {
      operation,
      deviceCount: deviceInfo?.length,
      hasAudioInput: deviceInfo?.some(device => device.kind === 'audioinput'),
    };

    return this.error('audio', `Audio error: ${error.message}`, details, error);
  }

  // Handle network errors
  handleNetworkError(error: Error, isOnline: boolean): string {
    const details = {
      isOnline,
      connectionType: (navigator as any).connection?.effectiveType,
      downlink: (navigator as any).connection?.downlink,
    };

    return this.error('network', `Network error: ${error.message}`, details, error);
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger();

// Utility functions for common error scenarios
export function logStorageError(error: StorageError, operation: string): string {
  return errorLogger.handleStorageQuotaError(error, operation);
}

export function logAPIError(error: any, endpoint: string, retryCount?: number): string {
  return errorLogger.handleAPIError(error, endpoint, retryCount);
}

export function logAudioError(error: Error, operation: string, deviceInfo?: MediaDeviceInfo[]): string {
  return errorLogger.handleAudioError(error, operation, deviceInfo);
}

export function logNetworkError(error: Error, isOnline: boolean): string {
  return errorLogger.handleNetworkError(error, isOnline);
}

// Global error handler for unhandled promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    errorLogger.error(
      'unknown',
      'Unhandled promise rejection',
      {
        reason: event.reason?.toString(),
        promise: event.promise?.toString(),
      },
      event.reason instanceof Error ? event.reason : undefined
    );
  });

  // Global error handler for uncaught errors
  window.addEventListener('error', (event) => {
    errorLogger.error(
      'unknown',
      'Uncaught error',
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
      event.error
    );
  });
}